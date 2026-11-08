import type TelegramBot from 'node-telegram-bot-api'
import { type SeasonManager } from './SeasonManager'
import { type LatestQuiz, type ReactionReader } from './ReactionReader'
import { buildQuizPost, modeFor, pickQuestion } from './quizPicker'
import { answerTimeFor, buildAnswer } from './quizAnswer'
import { config } from '../config'
import { findQuizBatch, findQuizQuestion, QUIZ_QUESTIONS } from '../data/rules-quiz'
import { type QuizBatch, type QuizQuestion } from '../types'
import { withTimeout } from '../utils/async'
import { getEffectiveDate } from '../utils/dateHelpers'
import { formatDateTimeLocale } from '../utils/formatters'
import { log } from '../utils/logger'
import { noLinkPreview, replyOptions, threadOptions } from '../utils/telegram'

// Above the history read's own bound (each MTProto request times out and retries once), so a stuck
// post always ends in a logged error rather than silence. It also frees the queue for the next post.
const POST_TIMEOUT_MS = 3 * 60_000
const RETRY_DELAY_MS = 10 * 60_000

interface Chat {
  chatId: string;
  threadId?: string;
}

/**
 * Posts the rules quiz: one poll the day before each training, picked from the rules chat history,
 * then its answer behind a spoiler, RULES_ANSWER_DELAY_MINUTES later.
 */
export class RulesQuizService {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly reactionReader: ReactionReader
  // Posts and answers run one after another: two overlapping ones would read the same history,
  // and could post the same question or answer the same poll twice
  private queue: Promise<unknown> = Promise.resolve()
  private botUsername?: Promise<string>
  private answerTimer?: NodeJS.Timeout
  private retryTimer?: NodeJS.Timeout
  // What this process posted and answered. Search only sees a message seconds after it is sent, so
  // right after /send_rule it would miss the new poll, and right after an answer, the answer
  private lastPosted?: LatestQuiz
  private readonly answeredIds = new Set<number>()

  constructor(bot: TelegramBot, seasonManager: SeasonManager, reactionReader: ReactionReader) {
    this.bot = bot
    this.seasonManager = seasonManager
    this.reactionReader = reactionReader
  }

  /**
   * Called by the training job: never throws, so a quiz failure never affects the training post.
   * A failed post is retried once, later: a network blip at send time must not cost the quiz.
   */
  async sendScheduled(): Promise<void> {
    if (!config.rulesQuiz.enabled) {
      log.scheduler('Rules quiz disabled, skipping')
      return
    }

    clearTimeout(this.retryTimer)
    log.scheduler('❓ Sending rules quiz')

    try {
      await this.postNext()
    } catch (error) {
      log.error('Sending rules quiz', error)
      log.scheduler(`🔁 Rules quiz retry in ${RETRY_DELAY_MS / 60_000} min`)
      this.retryTimer = setTimeout(() => { void this.retryScheduled() }, RETRY_DELAY_MS)
    }
  }

  private async retryScheduled(): Promise<void> {
    try {
      await this.postNext()
    } catch (error) {
      log.error('Retrying rules quiz (giving up until the next training)', error)
    }
  }

  /** Posts the next question to the rules chat, even when the quiz is disabled (used by /send_rule). */
  async postNext(): Promise<QuizQuestion> {
    const { question, pollMessageId } = await this.enqueue(() =>
      withTimeout(this.pickAndPost(), POST_TIMEOUT_MS, `Rules quiz post timed out after ${POST_TIMEOUT_MS / 60_000} min`)
    )
    const postedAt = new Date()
    this.lastPosted = { messageId: pollMessageId, questionId: question.id, postedAt, answered: false }
    // Armed from the post itself, not a history lookup that would not see this poll yet
    if (config.rulesQuiz.enabled) this.armAnswerFor(pollMessageId, postedAt)
    return question
  }

  /** Answers the newest poll now, unless it already was (used by /answer_rule and the answer timer). */
  async answerLatest(): Promise<QuizQuestion | undefined> {
    return await this.enqueue(() => this.answerLatestPoll())
  }

  /**
   * Arms the answer for the newest poll found in the history, on startup. A time already passed
   * fires at once (catch-up); the history check keeps it from answering twice. Never throws.
   */
  async armAnswer(): Promise<void> {
    if (!config.rulesQuiz.enabled) return

    try {
      const latest = await this.findLatestQuiz(this.rulesChat())
      if (latest && !latest.answered) this.armAnswerFor(latest.messageId, latest.postedAt)
    } catch (error) {
      log.error('Arming rules quiz answer', error)
    }
  }

  private armAnswerFor(pollMessageId: number, postedAt: Date): void {
    clearTimeout(this.answerTimer)

    const answerAt = answerTimeFor(postedAt, config.rulesQuiz.answerDelayMinutes)
    const delay = Math.max(0, answerAt.getTime() - getEffectiveDate(new Date()).getTime())
    log.scheduler(`⏰ Rules quiz answer armed for ${delay === 0 ? 'now (catch-up)' : formatDateTimeLocale(answerAt)}`)

    this.answerTimer = setTimeout(() => { void this.answerOnTimer(pollMessageId) }, delay)
  }

  /**
   * Answers only the poll the timer was armed for: a post queued just before it fires makes a
   * newer poll the latest, and that one's answer is not due yet.
   */
  private async answerOnTimer(pollMessageId: number): Promise<void> {
    try {
      await this.enqueue(() => this.answerLatestPoll(pollMessageId))
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

  private async pickAndPost(): Promise<{ question: QuizQuestion; pollMessageId: number }> {
    const chat = this.rulesChat()
    const question = await this.pickNext(chat)
    const pollMessageId = await this.post(chat, question)
    log.scheduler(`❓ Rules quiz posted: ${question.id} (${question.difficulty})`)
    return { question, pollMessageId }
  }

  private async answerLatestPoll(onlyPollMessageId?: number): Promise<QuizQuestion | undefined> {
    const chat = this.rulesChat()
    const latest = this.unansweredPost(onlyPollMessageId) ?? await this.findLatestQuiz(chat)
    const skipReason = this.answerSkipReason(latest, onlyPollMessageId)

    if (!latest || skipReason) {
      log.scheduler(`⏭️  Rules quiz answer skipped - ${skipReason}`)
      return undefined
    }

    const question = findQuizQuestion(latest.questionId)
    if (!question) {
      log.warn('Rules quiz', `Question ${latest.questionId} is no longer in the bank - not answering`)
      return undefined
    }

    // The poll stays open: whoever reads the chat later can still vote
    await this.sendAnswer(chat, question, buildAnswer(question, this.sourceOf(question)), latest.messageId)
    this.answeredIds.add(latest.messageId)
    log.scheduler(`✅ Rules quiz answered: ${question.id}`)
    return question
  }

  private sourceOf(question: QuizQuestion): QuizBatch['source'] {
    const batch = findQuizBatch(question.id)
    if (!batch) throw new Error(`Question ${question.id} has no batch`)
    return batch.source
  }

  private answerSkipReason(latest: LatestQuiz | undefined, onlyPollMessageId?: number): string | undefined {
    if (!latest) return 'no quiz posted'
    if (onlyPollMessageId !== undefined && latest.messageId !== onlyPollMessageId) return 'a newer quiz was posted'
    if (latest.answered || this.answeredIds.has(latest.messageId)) return 'already answered'
    return undefined
  }

  /**
   * The poll this process posted, while it is unanswered: it is the quiz to answer even when
   * search does not see it yet, or sees a newer /test_rule preview (answered with it) first.
   */
  private unansweredPost(onlyPollMessageId?: number): LatestQuiz | undefined {
    const post = this.lastPosted
    if (!post || this.answeredIds.has(post.messageId)) return undefined
    if (onlyPollMessageId !== undefined && post.messageId !== onlyPollMessageId) return undefined
    return post
  }

  private async findLatestQuiz(chat: Chat): Promise<LatestQuiz | undefined> {
    return await this.reactionReader.getLatestQuiz(chat.chatId, chat.threadId, await this.getBotUsername())
  }

  private async sendAnswer(chat: Chat, question: QuizQuestion, text: string, pollMessageId: number): Promise<void> {
    if (question.answerImage) {
      await this.sendImage(chat, question.answerImage, pollMessageId, { htmlCaption: text, spoiler: true })
    } else {
      await this.sendText(chat, text, pollMessageId, { parse_mode: 'HTML', ...noLinkPreview() })
    }
  }

  /** Picks the way the scheduler does: the next training's season mode, minus what the rules chat already got. */
  async pickNext(chat: Chat = this.rulesChat()): Promise<QuizQuestion> {
    const mode = modeFor(this.seasonManager.getNextTrainingInfo().season)
    const askedIds = await this.reactionReader.getAskedQuizIds(chat.chatId, chat.threadId, await this.getBotUsername())
    return pickQuestion(QUIZ_QUESTIONS, mode, askedIds)
  }

  /** Fetched once; a failure is not cached, so the next post retries it. */
  private async getBotUsername(): Promise<string> {
    this.botUsername ??= this.bot.getMe().then(me => {
      if (!me.username) throw new Error('The bot has no username')
      return me.username
    })

    try {
      return await this.botUsername
    } catch (error) {
      this.botUsername = undefined
      throw error
    }
  }

  /** Image, then the long question text if any, then the poll: each one replying to the previous. */
  async post(chat: Chat, question: QuizQuestion): Promise<number> {
    const { intro, poll, options, correctOptionId } = buildQuizPost(question)

    let replyTo = question.image ? await this.sendImage(chat, question.image) : undefined
    if (intro) replyTo = await this.sendText(chat, intro, replyTo)
    return await this.sendPoll(chat, poll, options, correctOptionId, replyTo)
  }

  /** The question and its answer right away (used by /test_rule). */
  async preview(chat: Chat, question: QuizQuestion): Promise<void> {
    const pollMessageId = await this.post(chat, question)
    await this.sendAnswer(chat, question, buildAnswer(question, this.sourceOf(question)), pollMessageId)
  }

  private async sendImage(
    { chatId, threadId }: Chat,
    image: string,
    replyTo?: number,
    { htmlCaption, spoiler }: { htmlCaption?: string; spoiler?: boolean } = {}
  ): Promise<number> {
    const sent = await this.bot.sendPhoto(
      chatId,
      image,
      {
        ...threadOptions(threadId),
        ...replyOptions(replyTo),
        ...(htmlCaption && { caption: htmlCaption, parse_mode: 'HTML' }),
        ...(spoiler && { has_spoiler: true })
      },
      { contentType: 'image/png' }
    )
    return sent.message_id
  }

  private async sendText({ chatId, threadId }: Chat, text: string, replyTo?: number, options?: TelegramBot.SendMessageOptions): Promise<number> {
    const sent = await this.bot.sendMessage(chatId, text, { ...threadOptions(threadId), ...replyOptions(replyTo), ...options })
    return sent.message_id
  }

  /** Anonymous quiz-type poll: each voter sees the right option as soon as they vote. */
  private async sendPoll(
    { chatId, threadId }: Chat,
    question: string,
    options: string[],
    correctOptionId: number,
    replyTo?: number
  ): Promise<number> {
    const sent = await this.bot.sendPoll(chatId, question, options, {
      ...threadOptions(threadId),
      ...replyOptions(replyTo),
      is_anonymous: true,
      type: 'quiz',
      correct_option_id: correctOptionId
    })
    return sent.message_id
  }

  private rulesChat(): Chat {
    const { chatId, chatThreadId } = config.rulesQuiz
    if (!chatId) throw new Error('RULES_CHAT_ID is not set')
    return { chatId, threadId: chatThreadId }
  }
}
