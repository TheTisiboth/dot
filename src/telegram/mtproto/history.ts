import { Api, helpers } from 'telegram'
import type { Api as BotApi } from 'grammy'
import { type MtprotoConnection } from './client'

export const SEARCH_PAGE_SIZE = 100

/**
 * Reads the chat history through a user account (MTProto).
 *
 * The Bot API cannot read reactions at all: `messages.getMessagesReactions` and
 * `messages.getMessageReactionsList` are both documented "Only users can use this method".
 * So the bot writes, and this account reads.
 */
export class History {
  private readonly connection: MtprotoConnection
  private readonly bot: Pick<BotApi, 'getMe'>
  private botUsername?: Promise<string>

  constructor(bot: Pick<BotApi, 'getMe'>, connection: MtprotoConnection) {
    this.bot = bot
    this.connection = connection
  }

  /**
   * The messages the bot sent in the chat, newest first, up to `maxMessages` and while `isRecent`.
   * Filtered on the sender server-side, so discussion in the chat is never read and cannot push a
   * message out of reach, and paged until done. Built on messages.search directly: GramJS's
   * getMessages ignores the sender filter inside a forum topic.
   */
  async searchBotMessages(
    chatId: string,
    threadId: number | undefined,
    { maxMessages = Infinity, isRecent = () => true }: { maxMessages?: number; isRecent?: (message: Api.Message) => boolean } = {}
  ): Promise<Api.Message[]> {
    const peer = await this.connection.request('chat lookup', client => client.getInputEntity(Number(chatId)))
    // By username: the account may never have seen the bot's access hash, which the search needs
    const username = await this.getBotUsername()
    const bot = await this.connection.request('bot lookup', client => client.getInputEntity(username))
    const messages: Api.Message[] = []
    let page: Api.Message[] = []

    do {
      page = await this.searchPage(peer, bot, threadId, page.at(-1)?.id ?? 0)
      messages.push(...page.filter(isRecent))
    } while (page.length > 0 && page.every(isRecent) && messages.length < maxMessages)

    return messages
  }

  async messagesByIds(chatId: string, ids: number[]): Promise<Api.Message[]> {
    return await this.connection.request('history read', async client => {
      const entity = await client.getInputEntity(Number(chatId))
      return await client.getMessages(entity, { ids })
    })
  }

  /** Fetched once; a failure is not cached, so the next search retries it. */
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

  private async searchPage(
    peer: Api.TypeInputPeer,
    fromId: Api.TypeInputPeer,
    threadId: number | undefined,
    offsetId: number
  ): Promise<Api.Message[]> {
    const result = await this.connection.request('history search', client => client.invoke(new Api.messages.Search({
      peer,
      fromId,
      ...(threadId && { topMsgId: threadId }),
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
}

export const sentAt = (message: Api.Message): Date => new Date(message.date * 1000)

export function repliesTo(message: Api.Message, messageId: number): boolean {
  const { replyTo } = message
  return replyTo instanceof Api.MessageReplyHeader && replyTo.replyToMsgId === messageId
}

export function isRealReply(message: Api.Message, threadId?: number): boolean {
  const { replyTo } = message
  if (!(replyTo instanceof Api.MessageReplyHeader) || replyTo.replyToMsgId === undefined) return false

  // Inside a forum topic every message formally replies to the topic root, which is not a real reply
  return !threadId || replyTo.replyToMsgId !== threadId
}

export const reactionCount = (message: Api.Message, emoji: string): number =>
  message.reactions?.results.find(
    result => result.reaction instanceof Api.ReactionEmoji && result.reaction.emoticon === emoji
  )?.count ?? 0

export const pollQuestion = (message: Api.Message): string | undefined =>
  message.media instanceof Api.MessageMediaPoll ? message.media.poll.question.text : undefined
