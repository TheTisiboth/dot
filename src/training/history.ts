import { type History, isRealReply, reactionCount, repliesTo, sentAt } from '../telegram/mtproto/history'
import { EMOJIS } from '../shared/emojis'
import { hoursBefore } from '../shared/time'
import { isKeyRequest } from './markers'

// How far back to look for the training post. The cron posts it ~24h before training, but a
// manually triggered one can land earlier, so leave room. Messages come back newest-first, so
// an older training post caught by a wide window never wins over the current one.
const ANNOUNCEMENT_LOOKBACK_HOURS = 48

export type TrainingHistory = ReturnType<typeof trainingHistory>

/** What the training jobs read back from the chat history, so a restart loses nothing. */
export const trainingHistory = (history: History) => ({
  async getThumbsUpCount(chatId: string, messageId: number): Promise<number> {
    const [message] = await history.messagesByIds(chatId, [messageId])
    return message ? reactionCount(message, EMOJIS.THUMBS_UP) : 0
  },

  /**
   * Recovers the training post after a restart, when its id is no longer in memory.
   * It is the bot's most recent standalone message carrying a 👍 in the run-up to the training -
   * command replies never contain one, so they cannot be mistaken for it. The key request, posted
   * right after it, also carries a 👍 and is skipped explicitly.
   */
  async findAnnouncement(chatId: string, threadId: number | undefined, trainingAt: Date): Promise<number | undefined> {
    const windowStart = hoursBefore(trainingAt, ANNOUNCEMENT_LOOKBACK_HOURS)
    const messages = await history.searchBotMessages(chatId, threadId, { isRecent: message => sentAt(message) >= windowStart })

    const announcement = messages.find(message =>
      !isRealReply(message, threadId)
      && message.message?.includes(EMOJIS.THUMBS_UP)
      && !isKeyRequest(message.message)
      && sentAt(message) <= trainingAt
    )

    return announcement?.id
  },

  /**
   * Whether the bot already replied to the training post, so a restart cannot send a second attendance reminder.
   *
   * Matched structurally rather than on a text marker: the training post is LLM-generated and the
   * model does not reliably respect the prompt's emoji allowlist, so it can open with the very emoji
   * we use as a marker - which would make the post look like an attendance reminder that had already been sent.
   */
  async hasBotReplyTo(chatId: string, threadId: number | undefined, replyToId: number): Promise<boolean> {
    // A reply is newer than the message it replies to, and message ids grow with time
    const messages = await history.searchBotMessages(chatId, threadId, { isRecent: message => message.id > replyToId })

    return messages.some(message => repliesTo(message, replyToId))
  },

  /** Whether the bot already posted a message containing `needle`, used for the template-only cancellation. */
  async hasBotMessageContaining(
    chatId: string,
    threadId: number | undefined,
    needle: string,
    since: Date
  ): Promise<boolean> {
    const messages = await history.searchBotMessages(chatId, threadId, { isRecent: message => sentAt(message) >= since })

    return messages.some(message => message.message?.includes(needle))
  }
})
