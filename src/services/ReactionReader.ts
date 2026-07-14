// sessions comes from the package root: Node's ESM loader cannot import the 'telegram/sessions' directory
import { TelegramClient, Api, sessions } from 'telegram'
import { config } from '../config'
import { EMOJIS } from '../utils/constants'
import { hoursBefore } from '../utils/dateHelpers'
import { withTimeout } from '../utils/async'
import { log } from '../utils/logger'

// How far back to look for the training post. The cron posts it ~24h before training, but a
// manually triggered one can land earlier, so leave room. Messages come back newest-first, so
// an older training post caught by a wide window never wins over the current one.
const POLL_LOOKBACK_HOURS = 48
const HISTORY_LIMIT = 100
const CONNECT_TIMEOUT_MS = 20_000

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

  constructor() {
    this.client = new TelegramClient(
      new sessions.StringSession(config.mtproto.session),
      config.mtproto.apiId,
      config.mtproto.apiHash,
      { connectionRetries: 5 }
    )
    // A bot token is "<botId>:<hash>" - cheaper than a getMe() round trip
    this.botId = config.telegram.token.split(':')[0]
  }

  async connect(): Promise<void> {
    if (this.connected) return

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
   * command replies never contain one, so they cannot be mistaken for it.
   */
  async findPollMessage(chatId: string, threadId: string | undefined, trainingAt: Date): Promise<number | undefined> {
    const messages = await this.fetchMessages(chatId, { limit: HISTORY_LIMIT }, threadId)
    const windowStart = hoursBefore(trainingAt, POLL_LOOKBACK_HOURS)

    const poll = messages.find(message =>
      this.isFromBot(message) &&
      !this.isReplyToMessage(message, threadId) &&
      message.message?.includes(EMOJIS.THUMBS_UP) &&
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

    return messages.some(message => {
      if (!this.isFromBot(message)) return false
      const { replyTo } = message
      return replyTo instanceof Api.MessageReplyHeader && replyTo.replyToMsgId === replyToId
    })
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

  private async fetchMessages(
    chatId: string,
    params: { ids?: number[]; limit?: number },
    threadId?: string
  ): Promise<Api.Message[]> {
    if (!this.connected) await this.connect()

    const entity = await this.client.getInputEntity(Number(chatId))
    return await this.client.getMessages(entity, {
      ...params,
      ...(threadId && { replyTo: Number(threadId) })
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
