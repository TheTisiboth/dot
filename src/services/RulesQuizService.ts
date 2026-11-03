import type TelegramBot from 'node-telegram-bot-api'
import { type SeasonManager } from './SeasonManager'
import { type ReactionReader } from './ReactionReader'
import { buildQuizPost, modeFor, pickQuestion } from './quizPicker'
import { config } from '../config'
import { QUIZ_QUESTIONS } from '../data/rules-quiz'
import { type QuizQuestion } from '../types'
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
  // Posts run one after another: two overlapping ones would read the same history and could post the same question
  private queue: Promise<unknown> = Promise.resolve()
  private botUsername?: Promise<string>

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
    const run = this.queue.then(() => this.pickAndPost())
    // A failed post must not block the ones queued after it
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
  async post(chat: Chat, question: QuizQuestion): Promise<void> {
    const { intro, poll, options } = buildQuizPost(question)

    let replyTo = question.image ? await this.sendImage(chat, question.image) : undefined
    if (intro) replyTo = await this.sendText(chat, intro, replyTo)
    await this.sendPoll(chat, poll, options, replyTo)
  }

  private async sendImage({ chatId, threadId }: Chat, image: string): Promise<number> {
    const sent = await this.bot.sendPhoto(chatId, image, threadOptions(threadId), { contentType: 'image/png' })
    return sent.message_id
  }

  private async sendText({ chatId, threadId }: Chat, text: string, replyTo?: number): Promise<number> {
    const sent = await this.bot.sendMessage(chatId, text, { ...threadOptions(threadId), ...replyOptions(replyTo) })
    return sent.message_id
  }

  /** Anonymous regular poll, not quiz-type, so the answer stays hidden until it is posted. */
  private async sendPoll({ chatId, threadId }: Chat, question: string, options: string[], replyTo?: number): Promise<void> {
    await this.bot.sendPoll(chatId, question, options, {
      ...threadOptions(threadId),
      ...replyOptions(replyTo),
      is_anonymous: true,
      type: 'regular',
      allows_multiple_answers: false
    })
  }

  private rulesChat(): Chat {
    const { chatId, chatThreadId } = config.rulesQuiz
    if (!chatId) throw new Error('RULES_CHAT_ID is not set')
    return { chatId, threadId: chatThreadId }
  }
}
