import type TelegramBot from 'node-telegram-bot-api'
import { type SeasonManager } from './SeasonManager'
import { type LatestQuiz, type ReactionReader } from './ReactionReader'
import { buildQuizPost, modeFor, pickQuestion } from './quizPicker'
import { answerTimeFor, buildAnswer, type PollResult } from './quizAnswer'
import { config } from '../config'
import { findQuizBatch, findQuizQuestion, QUIZ_QUESTIONS } from '../data/rules-quiz'
import { type QuizBatch, type QuizQuestion } from '../types'
import { getEffectiveDate } from '../utils/dateHelpers'
import { formatDateTimeLocale } from '../utils/formatters'
import { log } from '../utils/logger'
import { replyOptions, threadOptions } from '../utils/telegram'

interface Chat {
  chatId: string;
  threadId?: string;
}

/** Posts the rules quiz: one poll the day before each training, picked from the rules chat history. */
export class RulesQuizService {
  private readonly bot: TelegramBot
  private readonly seasonManager: SeasonManager
  private readonly reactionReader: ReactionReader
  // Posts and answers run one after another: two overlapping ones would read the same history,
  // and could post the same question or answer the same poll twice
  private queue: Promise<unknown> = Promise.resolve()
  private botUsername?: Promise<string>
  private answerTimer?: NodeJS.Timeout

  constructor(bot: TelegramBot, seasonManager: SeasonManager, reactionReader: ReactionReader) {
    this.bot = bot
    this.seasonManager = seasonManager
    this.reactionReader = reactionReader
  }

  /** Called by the training job: never throws, so a quiz failure never affects the training post. */
  async sendScheduled(): Promise<void> {
    if (!config.rulesQuiz.enabled) {
      log.scheduler('Rules quiz disabled, skipping')
      return
    }

    try {
      await this.postNext()
    } catch (error) {
      log.error('Sending rules quiz', error)
    }
  }

  /** Posts the next question to the rules chat, even when the quiz is disabled (used by /send_rule). */
  async postNext(): Promise<QuizQuestion> {
    const question = await this.enqueue(() => this.pickAndPost())
    await this.armAnswer()
    return question
  }

  /** Answers the newest poll now, unless it already was (used by /answer_rule and the answer timer). */
  async answerLatest(): Promise<QuizQuestion | undefined> {
    return await this.enqueue(() => this.answerLatestPoll())
  }

  /**
   * Arms the answer for the newest poll, on startup and after each post. A time already passed
   * fires at once (catch-up); the history check keeps it from answering twice. Never throws.
   */
  async armAnswer(): Promise<void> {
    if (!config.rulesQuiz.enabled) return

    try {
      const latest = await this.findLatestQuiz(this.rulesChat())
      clearTimeout(this.answerTimer)
      if (!latest || latest.answered) return

      const answerAt = answerTimeFor(latest.postedAt, config.rulesQuiz.answerTime)
      const delay = Math.max(0, answerAt.getTime() - getEffectiveDate(new Date()).getTime())
      log.scheduler(`⏰ Rules quiz answer armed for ${delay === 0 ? 'now (catch-up)' : formatDateTimeLocale(answerAt)}`)

      this.answerTimer = setTimeout(() => { void this.answerOnTimer() }, delay)
    } catch (error) {
      log.error('Arming rules quiz answer', error)
    }
  }

  private async answerOnTimer(): Promise<void> {
    try {
      await this.answerLatest()
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

  private async pickAndPost(): Promise<QuizQuestion> {
    const chat = this.rulesChat()
    const question = await this.pickNext(chat)
    await this.post(chat, question)
    log.scheduler(`❓ Rules quiz posted: ${question.id} (${question.difficulty})`)
    return question
  }

  private async answerLatestPoll(): Promise<QuizQuestion | undefined> {
    const chat = this.rulesChat()
    const latest = await this.findLatestQuiz(chat)

    if (!latest || latest.answered) {
      log.scheduler(`⏭️  Rules quiz answer skipped - ${latest ? 'already answered' : 'no quiz posted'}`)
      return undefined
    }

    const question = findQuizQuestion(latest.questionId)
    if (!question) {
      log.warn('Rules quiz', `Question ${latest.questionId} is no longer in the bank - not answering`)
      return undefined
    }

    const poll = await this.closePoll(chat, latest.messageId)
    await this.sendAnswer(chat, question, buildAnswer(question, this.sourceOf(question), poll), latest.messageId)
    log.scheduler(`✅ Rules quiz answered: ${question.id}`)
    return question
  }

  private sourceOf(question: QuizQuestion): QuizBatch['source'] {
    const batch = findQuizBatch(question.id)
    if (!batch) throw new Error(`Question ${question.id} has no batch`)
    return batch.source
  }

  private async findLatestQuiz(chat: Chat): Promise<LatestQuiz | undefined> {
    return await this.reactionReader.getLatestQuiz(chat.chatId, chat.threadId, await this.getBotUsername())
  }

  /** Closes the poll and returns its votes; none if it was already closed. */
  private async closePoll({ chatId }: Chat, messageId: number): Promise<PollResult | undefined> {
    try {
      return await this.bot.stopPoll(chatId, messageId)
    } catch (error) {
      // shortcut: a crash between closing and replying loses the stats; reading them over MTProto would keep them
      if (error instanceof Error && error.message.includes('already been closed')) return undefined
      throw error
    }
  }

  private async sendAnswer(chat: Chat, question: QuizQuestion, text: string, pollMessageId: number): Promise<void> {
    if (question.answerImage) {
      await this.sendImage(chat, question.answerImage, pollMessageId, text)
    } else {
      await this.sendText(chat, text, pollMessageId, { parse_mode: 'HTML', disable_web_page_preview: true })
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
    const { intro, poll, options } = buildQuizPost(question)

    let replyTo = question.image ? await this.sendImage(chat, question.image) : undefined
    if (intro) replyTo = await this.sendText(chat, intro, replyTo)
    return await this.sendPoll(chat, poll, options, replyTo)
  }

  /** The question and its answer right away, without closing the poll (used by /test_rule). */
  async preview(chat: Chat, question: QuizQuestion): Promise<void> {
    const pollMessageId = await this.post(chat, question)
    await this.sendAnswer(chat, question, buildAnswer(question, this.sourceOf(question)), pollMessageId)
  }

  private async sendImage({ chatId, threadId }: Chat, image: string, replyTo?: number, htmlCaption?: string): Promise<number> {
    const sent = await this.bot.sendPhoto(
      chatId,
      image,
      { ...threadOptions(threadId), ...replyOptions(replyTo), ...(htmlCaption && { caption: htmlCaption, parse_mode: 'HTML' }) },
      { contentType: 'image/png' }
    )
    return sent.message_id
  }

  private async sendText({ chatId, threadId }: Chat, text: string, replyTo?: number, options?: TelegramBot.SendMessageOptions): Promise<number> {
    const sent = await this.bot.sendMessage(chatId, text, { ...threadOptions(threadId), ...replyOptions(replyTo), ...options })
    return sent.message_id
  }

  /** Anonymous regular poll, not quiz-type, so the answer stays hidden until it is posted. */
  private async sendPoll({ chatId, threadId }: Chat, question: string, options: string[], replyTo?: number): Promise<number> {
    const sent = await this.bot.sendPoll(chatId, question, options, {
      ...threadOptions(threadId),
      ...replyOptions(replyTo),
      is_anonymous: true,
      type: 'regular',
      allows_multiple_answers: false
    })
    return sent.message_id
  }

  private rulesChat(): Chat {
    const { chatId, chatThreadId } = config.rulesQuiz
    if (!chatId) throw new Error('RULES_CHAT_ID is not set')
    return { chatId, threadId: chatThreadId }
  }
}
