import { type SeasonManager } from '../training/season'
import { type LatestQuiz, type QuizHistory } from './history'
import { modeFor, pickQuestion } from './picker'
import { answerTimeFor } from './answer'
import { type QuizPublisher } from './publisher'
import type { BotConfig } from '../config/env'
import { findQuizQuestion, isSignalQuestion, QUIZ_BATCHES, QUIZ_QUESTIONS } from './data'
import { type PartResult } from '../training/announcer'
import { type QuizMode, type QuizQuestion } from './question'
import { type QuizStats, quizStats } from './stats'
import { withTimeout } from '../shared/async'
import { armAt } from '../shared/time'
import { formatDateTimeLocale } from '../shared/formatters'
import { errorMessage, log } from '../shared/logger'
import { type ChatTarget } from '../telegram/sender'

// Above the history read's own bound (each MTProto request times out and retries once), so a stuck
// post always ends in a logged error rather than silence. It also frees the queue for the next post.
const POST_TIMEOUT_MS = 3 * 60_000
const RETRY_DELAY_MS = 10 * 60_000

/**
 * Posts the rules quiz: one poll the day before each training, picked from the rules chat history,
 * then its answer behind a spoiler, RULES_ANSWER_DELAY_MINUTES later.
 */
export class RulesQuizService {
  private readonly config: BotConfig['rulesQuiz']
  private readonly publisher: QuizPublisher
  private readonly seasonManager: SeasonManager
  private readonly history: QuizHistory
  // Posts and answers run one after another: two overlapping ones would read the same history,
  // and could post the same question or answer the same poll twice
  private queue: Promise<unknown> = Promise.resolve()
  private answerTimer?: NodeJS.Timeout
  private retryTimer?: NodeJS.Timeout
  private pendingAnswer?: { quizMessageId: number; questionId: string; at: Date }
  // What this process posted and answered. Search only sees a message seconds after it is sent, so
  // right after /quiz_post it would miss the new poll, and right after an answer, the answer
  private lastPosted?: LatestQuiz
  private readonly answeredIds = new Set<number>()

  constructor(config: BotConfig['rulesQuiz'], publisher: QuizPublisher, seasonManager: SeasonManager, history: QuizHistory) {
    this.config = config
    this.publisher = publisher
    this.seasonManager = seasonManager
    this.history = history
  }

  /**
   * Called by the training job: never throws, so a quiz failure never affects the training post.
   * A failed post is retried once, later: a network blip at send time must not cost the quiz.
   */
  async sendScheduled(): Promise<PartResult> {
    if (!this.config.enabled) {
      log.scheduler('Rules quiz disabled, skipping')
      return { status: 'skipped', reason: 'off' }
    }

    clearTimeout(this.retryTimer)
    log.scheduler('❓ Sending rules quiz')

    try {
      await this.postNext()
      return { status: 'sent' }
    } catch (error) {
      log.error('Sending rules quiz', error)
      log.scheduler(`🔁 Rules quiz retry in ${RETRY_DELAY_MS / 60_000} min`)
      this.retryTimer = setTimeout(() => { void this.retryScheduled() }, RETRY_DELAY_MS)
      return { status: 'failed', error: `${errorMessage(error)}, retrying in ${RETRY_DELAY_MS / 60_000} min` }
    }
  }

  private async retryScheduled(): Promise<void> {
    try {
      await this.postNext()
    } catch (error) {
      log.error('Retrying rules quiz (giving up until the next training)', error)
    }
  }

  /** Posts the next question to the rules chat, even when the quiz is disabled (used by /quiz_post). */
  async postNext(): Promise<QuizQuestion> {
    const { question, quizMessageId } = await this.enqueue(() =>
      withTimeout(this.pickAndPost(), POST_TIMEOUT_MS, `Rules quiz post timed out after ${POST_TIMEOUT_MS / 60_000} min`)
    )
    const postedAt = new Date()
    this.lastPosted = { messageId: quizMessageId, questionId: question.id, postedAt, answered: false }
    // Armed from the post itself, not a history lookup that would not see this poll yet
    if (this.config.enabled) this.armAnswerFor(quizMessageId, question.id, postedAt)
    return question
  }

  /** Answers the newest poll now, unless it already was (used by /quiz_answer and the answer timer). */
  async answerLatest(): Promise<QuizQuestion | undefined> {
    return await this.enqueue(() => this.answerLatestQuiz())
  }

  /**
   * Arms the answer for the newest poll found in the history, on startup. A time already passed
   * fires at once (catch-up); the history check keeps it from answering twice. Never throws.
   */
  async armAnswer(): Promise<void> {
    if (!this.config.enabled) return

    try {
      const latest = await this.findLatestQuiz(this.rulesChat())
      if (latest && !latest.answered) this.armAnswerFor(latest.messageId, latest.questionId, latest.postedAt)
    } catch (error) {
      log.error('Arming rules quiz answer', error)
    }
  }

  private armAnswerFor(quizMessageId: number, questionId: string, postedAt: Date): void {
    clearTimeout(this.answerTimer)

    const answerAt = answerTimeFor(postedAt, this.config.answerDelayMinutes)
    log.scheduler(`⏰ Rules quiz answer armed for ${answerAt <= new Date() ? 'now (catch-up)' : formatDateTimeLocale(answerAt)}`)

    this.pendingAnswer = { quizMessageId, questionId, at: answerAt }
    this.answerTimer = armAt(answerAt, () => {
      this.pendingAnswer = undefined
      void this.answerOnTimer(quizMessageId)
    })
  }

  /** Disarms the pending answer and retry. */
  stop(): void {
    clearTimeout(this.answerTimer)
    clearTimeout(this.retryTimer)
    this.pendingAnswer = undefined
  }

  /** The answer the timer will post, unless /quiz_answer already did. */
  answerDue(): { questionId: string; at: Date } | undefined {
    const pending = this.pendingAnswer
    return pending && !this.answeredIds.has(pending.quizMessageId) ? { questionId: pending.questionId, at: pending.at } : undefined
  }

  /**
   * Answers only the poll the timer was armed for: a post queued just before it fires makes a
   * newer poll the latest, and that one's answer is not due yet.
   */
  private async answerOnTimer(quizMessageId: number): Promise<void> {
    try {
      await this.enqueue(() => this.answerLatestQuiz(quizMessageId))
    } catch (error) {
      log.error('Answering rules quiz', error)
    }
  }

  /** A failed task must not block the ones queued after it. */
  private async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task)
    this.queue = run.catch(() => undefined)
    return await run
  }

  private async pickAndPost(): Promise<{ question: QuizQuestion; quizMessageId: number }> {
    const chat = this.rulesChat()
    const question = await this.pickNext(chat)
    const quizMessageId = await this.publisher.post(chat, question)
    log.scheduler(`❓ Rules quiz posted: ${question.id} (${question.difficulty})`)
    return { question, quizMessageId }
  }

  private async answerLatestQuiz(onlyQuizMessageId?: number): Promise<QuizQuestion | undefined> {
    const chat = this.rulesChat()
    const latest = this.unansweredPost(onlyQuizMessageId) ?? await this.findLatestQuiz(chat)
    const skipReason = this.answerSkipReason(latest, onlyQuizMessageId)

    if (!latest || skipReason) {
      log.scheduler(`⏭️  Rules quiz answer skipped - ${skipReason}`)
      return undefined
    }

    const question = findQuizQuestion(latest.questionId)
    if (!question) {
      log.warn('Rules quiz', `Question ${latest.questionId} is no longer in the bank - not answering`)
      return undefined
    }

    await this.publisher.answer(chat, question, latest.messageId)
    this.answeredIds.add(latest.messageId)
    log.scheduler(`✅ Rules quiz answered: ${question.id}`)
    return question
  }

  private answerSkipReason(latest: LatestQuiz | undefined, onlyQuizMessageId?: number): string | undefined {
    if (!latest) return 'no quiz posted'
    if (onlyQuizMessageId !== undefined && latest.messageId !== onlyQuizMessageId) return 'a newer quiz was posted'
    if (latest.answered || this.answeredIds.has(latest.messageId)) return 'already answered'
    return undefined
  }

  /**
   * The poll this process posted, while it is unanswered: it is the quiz to answer even when
   * search does not see it yet, or sees a newer /quiz_preview (answered with it) first.
   */
  private unansweredPost(onlyQuizMessageId?: number): LatestQuiz | undefined {
    const post = this.lastPosted
    if (!post || this.answeredIds.has(post.messageId)) return undefined
    if (onlyQuizMessageId !== undefined && post.messageId !== onlyQuizMessageId) return undefined
    return post
  }

  private async findLatestQuiz(chat: ChatTarget): Promise<LatestQuiz | undefined> {
    return await this.history.getLatestQuiz(chat.chatId, chat.threadId)
  }

  /** Picks the way the scheduler does: the next training's season mode, minus what the rules chat already got (hand signals every other one with RULES_SIGNALS_EVERY_OTHER). */
  async pickNext(chat: ChatTarget = this.rulesChat()): Promise<QuizQuestion> {
    const asked = await this.history.getAskedQuizzes(chat.chatId, chat.threadId)
    return pickQuestion(QUIZ_QUESTIONS, this.mode(), asked.map(quiz => quiz.questionId), Math.random, this.focus())
  }

  /** Where the rounds stand, from one read of the rules chat history. */
  async stats(): Promise<QuizStats> {
    const chat = this.rulesChat()
    const asked = await this.history.getAskedQuizzes(chat.chatId, chat.threadId)
    return quizStats(QUIZ_BATCHES, asked, this.mode(), this.focus())
  }

  private mode(): QuizMode {
    return modeFor(this.seasonManager.nextTraining().season)
  }

  private focus(): ((id: string) => boolean) | undefined {
    return this.config.signalsEveryOther ? isSignalQuestion : undefined
  }

  private rulesChat(): ChatTarget {
    const { chat } = this.config
    if (!chat) throw new Error('RULES_CHAT_ID is not set')
    return chat
  }
}
