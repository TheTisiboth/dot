// sessions comes from the package root: Node's ESM loader cannot import the 'telegram/sessions' directory
import { TelegramClient, Api, sessions, Logger, helpers } from 'telegram'
// Type-only: the LogLevel enum is not re-exported from the root, and ESM cannot deep-import it without an extension
import type { LogLevel } from 'telegram/extensions/Logger'
import { config } from '../config'
import { EMOJIS, isKeyMessage } from '../utils/constants'
import { hoursBefore } from '../utils/dateHelpers'
import { TimeoutError, withTimeout } from '../utils/async'
import { log } from '../utils/logger'
import { parseQuizTag } from '../utils/quizTag'

// How far back to look for the training post. The cron posts it ~24h before training, but a
// manually triggered one can land earlier, so leave room. Messages come back newest-first, so
// an older training post caught by a wide window never wins over the current one.
const POLL_LOOKBACK_HOURS = 48
const HISTORY_LIMIT = 100
const CONNECT_TIMEOUT_MS = 20_000
// A request on a connection that died silently never settles: GramJS has no request timeout
const REQUEST_TIMEOUT_MS = 30_000
const SEARCH_PAGE_SIZE = 100

export interface LatestQuiz {
  messageId: number;
  questionId: string;
  postedAt: Date;
  answered: boolean;
}

/**
 * Reads message reactions through a user account (MTProto).
 *
 * The Bot API cannot read reactions at all: `messages.getMessagesReactions` and
 * `messages.getMessageReactionsList` are both documented "Only users can use this method".
 * So the bot writes, and this client reads.
 */
export class ReactionReader {
  private readonly client: TelegramClient
  private readonly botId: string
  private connected = false
  private connecting?: Promise<void>

  constructor() {
    this.client = new TelegramClient(
      new sessions.StringSession(config.mtproto.session),
      config.mtproto.apiId,
      config.mtproto.apiHash,
      // GramJS prints raw stack traces for routine keep-alive timeouts it recovers from on its own.
      // Real failures still reach us as rejected calls.
      // WebSocket on 443: networks that filter MTProto's raw TCP still let HTTPS through.
      // Retries without limit (GramJS's default): after a capped number of failed reconnects, GramJS
      // gives up for good and every later request waits forever - a few minutes offline was enough
      { connectionRetries: Infinity, useWSS: true, baseLogger: new Logger('none' as LogLevel) }
    )
    this.client.onError = async (error) => {
      // GramJS's idle update loop throws TIMEOUT routinely and reconnects itself
      if (error.message === 'TIMEOUT') return
      log.warn('MTProto', `Connection issue, GramJS retries on its own: ${error.message}`)
    }
    // A bot token is "<botId>:<hash>" - cheaper than a getMe() round trip
    this.botId = config.telegram.token.split(':')[0]
  }

  async connect(): Promise<void> {
    if (this.connected) return

    // Shared: requests that time out together must not open two connections at once
    this.connecting ??= this.open().finally(() => { this.connecting = undefined })
    await this.connecting
  }

  private async open(): Promise<void> {
    // GramJS retries a failed handshake forever rather than throwing, so an unreachable
    // endpoint or a revoked session would otherwise hang the caller indefinitely
    try {
      await withTimeout(
        this.establish(),
        CONNECT_TIMEOUT_MS,
        `MTProto connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s (check TELEGRAM_SESSION is still valid)`
      )
    } catch (error) {
      await this.stopClient()
      throw error
    }

    this.connected = true
    log.bot('MTProto reader connected')
  }

  private async establish(): Promise<void> {
    await this.client.connect()
    // Warms the entity cache, without which getInputEntity() cannot resolve a chat id to its access hash
    await this.client.getDialogs({ limit: HISTORY_LIMIT })
  }

  /** Stops the background reconnect loop GramJS leaves running after a failed connect. */
  private async stopClient(): Promise<void> {
    try {
      await this.client.disconnect()
    } catch (error) {
      log.warn('MTProto', `Failed to stop client after connection error: ${String(error)}`)
    }
  }

  /**
   * Runs one MTProto request, bounded in time. A timeout or a dropped connection resets the client
   * and retries once on a fresh connection; a second failure, or a Telegram error, reaches the caller.
   */
  private async request<T>(label: string, run: () => Promise<T>): Promise<T> {
    try {
      return await this.attempt(label, run)
    } catch (error) {
      // A Telegram error (no access, flood wait...) would fail again the same way on a new connection
      if (!(error instanceof TimeoutError) && this.client.connected) throw error

      log.warn('MTProto', `${label} failed, reconnecting and retrying once: ${error instanceof Error ? error.message : String(error)}`)
      await this.reset()
      return await this.attempt(label, run)
    }
  }

  private async attempt<T>(label: string, run: () => Promise<T>): Promise<T> {
    // GramJS clears its own flag when it gives up reconnecting, while ours would still say connected
    if (!this.client.connected) this.connected = false
    if (!this.connected) await this.connect()

    return await withTimeout(run(), REQUEST_TIMEOUT_MS, `MTProto ${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
  }

  /** Drops the connection, so the next request opens a fresh one. */
  private async reset(): Promise<void> {
    this.connected = false
    await this.stopClient()
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.disconnect()
    this.connected = false
    log.bot('MTProto reader disconnected')
  }

  async getThumbsUpCount(chatId: string, messageId: number): Promise<number> {
    const [message] = await this.fetchMessages(chatId, { ids: [messageId] })

    const thumbsUp = message?.reactions?.results.find(
      result => result.reaction instanceof Api.ReactionEmoji && result.reaction.emoticon === EMOJIS.THUMBS_UP
    )

    return thumbsUp?.count ?? 0
  }

  /**
   * Recovers the training post after a restart, when its id is no longer in memory.
   * It is the bot's most recent standalone message carrying a 👍 in the run-up to the training -
   * command replies never contain one, so they cannot be mistaken for it. The key message, posted
   * right after it, also carries a 👍 and is skipped explicitly.
   */
  async findPollMessage(chatId: string, threadId: string | undefined, trainingAt: Date): Promise<number | undefined> {
    const messages = await this.fetchMessages(chatId, { limit: HISTORY_LIMIT }, threadId)
    const windowStart = hoursBefore(trainingAt, POLL_LOOKBACK_HOURS)

    const poll = messages.find(message =>
      this.isFromBot(message) &&
      !this.isReplyToMessage(message, threadId) &&
      message.message?.includes(EMOJIS.THUMBS_UP) &&
      !isKeyMessage(message.message) &&
      this.sentAt(message) >= windowStart &&
      this.sentAt(message) <= trainingAt
    )

    return poll?.id
  }

  /**
   * Whether the bot already replied to the training post, so a restart cannot send a second reminder.
   *
   * Matched structurally rather than on a text marker: the training post is LLM-generated and the
   * model does not reliably respect the prompt's emoji allowlist, so it can open with the very emoji
   * we use as a marker - which would make the post look like a reminder that had already been sent.
   */
  async hasBotReplyTo(chatId: string, threadId: string | undefined, replyToId: number): Promise<boolean> {
    const messages = await this.fetchMessages(chatId, { limit: HISTORY_LIMIT }, threadId)

    return messages.some(message => this.isFromBot(message) && this.repliesTo(message, replyToId))
  }

  /** Whether the bot already posted a message containing `needle`, used for the template-only cancellation. */
  async hasBotMessageContaining(
    chatId: string,
    threadId: string | undefined,
    needle: string,
    since: Date
  ): Promise<boolean> {
    const messages = await this.fetchMessages(chatId, { limit: HISTORY_LIMIT }, threadId)

    return messages.some(message =>
      this.isFromBot(message) &&
      message.message?.includes(needle) &&
      this.sentAt(message) >= since
    )
  }

  /** Ids of the quiz questions already posted, newest first: the chat history is the quiz memory. */
  async getAskedQuizIds(chatId: string, threadId: string | undefined, botUsername: string): Promise<string[]> {
    const messages = await this.searchBotMessages(chatId, threadId, botUsername)

    return messages.flatMap(message => {
      const id = this.quizIdOf(message)
      return id ? [id] : []
    })
  }

  /**
   * The newest quiz poll, and whether the bot already replied to it (the answer). Found from the
   * history, so a restart loses neither the poll nor the fact it was answered.
   */
  async getLatestQuiz(chatId: string, threadId: string | undefined, botUsername: string): Promise<LatestQuiz | undefined> {
    // Recent enough: the poll is the newest quiz, and its answer comes right after it
    const messages = await this.searchBotMessages(chatId, threadId, botUsername, SEARCH_PAGE_SIZE)
    for (const message of messages) {
      const questionId = this.quizIdOf(message)
      if (!questionId) continue

      return {
        messageId: message.id,
        questionId,
        postedAt: this.sentAt(message),
        answered: messages.some(reply => this.repliesTo(reply, message.id))
      }
    }

    return undefined
  }

  private repliesTo(message: Api.Message, messageId: number): boolean {
    const { replyTo } = message
    return replyTo instanceof Api.MessageReplyHeader && replyTo.replyToMsgId === messageId
  }

  private quizIdOf(message: Api.Message): string | undefined {
    if (!(message.media instanceof Api.MessageMediaPoll)) return undefined
    return parseQuizTag(message.media.poll.question.text)
  }

  /**
   * The messages the bot sent in the chat, newest first, up to `maxMessages`. Filtered on the sender
   * server-side, so discussion in the chat is never read, and paged until done. Built on messages.search directly:
   * GramJS's getMessages ignores the sender filter inside a forum topic.
   */
  private async searchBotMessages(
    chatId: string,
    threadId: string | undefined,
    botUsername: string,
    maxMessages = Infinity
  ): Promise<Api.Message[]> {
    const peer = await this.request('chat lookup', () => this.client.getInputEntity(Number(chatId)))
    // By username: the account may never have seen the bot's access hash, which the search needs
    const bot = await this.request('bot lookup', () => this.client.getInputEntity(botUsername))
    const messages: Api.Message[] = []
    let page: Api.Message[]

    do {
      page = await this.searchPage(peer, bot, threadId, messages.at(-1)?.id ?? 0)
      messages.push(...page)
    } while (page.length > 0 && messages.length < maxMessages)

    return messages
  }

  private async searchPage(
    peer: Api.TypeInputPeer,
    fromId: Api.TypeInputPeer,
    threadId: string | undefined,
    offsetId: number
  ): Promise<Api.Message[]> {
    const result = await this.request('history search', () => this.client.invoke(new Api.messages.Search({
      peer,
      fromId,
      ...(threadId && { topMsgId: Number(threadId) }),
      q: '',
      filter: new Api.InputMessagesFilterEmpty(),
      minDate: 0,
      maxDate: 0,
      offsetId,
      addOffset: 0,
      limit: SEARCH_PAGE_SIZE,
      maxId: 0,
      minId: 0,
      hash: helpers.returnBigInt(0)
    })))

    if (result instanceof Api.messages.MessagesNotModified) return []
    return result.messages.filter((message): message is Api.Message => message instanceof Api.Message)
  }

  private async fetchMessages(
    chatId: string,
    params: { ids?: number[]; limit?: number },
    threadId?: string
  ): Promise<Api.Message[]> {
    return await this.request('history read', async () => {
      const entity = await this.client.getInputEntity(Number(chatId))
      return await this.client.getMessages(entity, {
        ...params,
        ...(threadId && { replyTo: Number(threadId) })
      })
    })
  }

  private isFromBot(message: Api.Message): boolean {
    return message.senderId?.toString() === this.botId
  }

  private sentAt(message: Api.Message): Date {
    return new Date(message.date * 1000)
  }

  private isReplyToMessage(message: Api.Message, threadId?: string): boolean {
    const { replyTo } = message
    if (!(replyTo instanceof Api.MessageReplyHeader) || replyTo.replyToMsgId === undefined) return false

    // Inside a forum topic every message formally replies to the topic root, which is not a real reply
    return !threadId || replyTo.replyToMsgId !== Number(threadId)
  }
}
