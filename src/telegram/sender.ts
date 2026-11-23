import { type Api, GrammyError, InputFile } from 'grammy'
import { log } from '../shared/logger'

/** A chat, optionally one forum topic in it. */
export interface ChatTarget {
  chatId: string;
  threadId?: number;
}

/** Sends to one chat and topic; each method resolves to the sent message's id. */
export interface Sender {
  /** HTML; `fallback` is sent instead when Telegram cannot parse it, so the message is not lost. */
  text: (html: string, options?: { replyTo?: number; linkPreview?: boolean; fallback?: () => string }) => Promise<number>;
  /** Plain text: for content that may hold HTML characters. */
  plain: (text: string, options?: { replyTo?: number }) => Promise<number>;
  /** A local image; the caption is HTML. */
  photo: (path: string, options?: { caption?: string; spoiler?: boolean; replyTo?: number }) => Promise<number>;
  /** Anonymous quiz-type poll: each voter sees the right option as soon as they vote. */
  poll: (question: string, options: string[], quiz: { correctOptionId: number; replyTo?: number }) => Promise<number>;
}

const isParseError = (error: unknown): boolean =>
  error instanceof GrammyError && error.error_code === 400 && error.description.includes("can't parse entities")

/** The one place the bot sends messages. */
export const senderFor = (api: Api, { chatId, threadId }: ChatTarget): Sender => {
  const target = (replyTo?: number) => {
    log.bot(`Sending message to chat ${chatId}${threadId ? ` (thread ${threadId})` : ''}`)
    return {
      ...(threadId ? { message_thread_id: threadId } : {}),
      ...(replyTo ? { reply_to_message_id: replyTo } : {})
    }
  }

  return {
    text: async (html, { replyTo, linkPreview = true, fallback } = {}) => {
      const options = {
        parse_mode: 'HTML',
        ...target(replyTo),
        ...(!linkPreview && { link_preview_options: { is_disabled: true } })
      } as const
      try {
        return (await api.sendMessage(chatId, html, options)).message_id
      } catch (error) {
        if (!fallback || !isParseError(error)) throw error
        log.error('Telegram rejected the message, sending the template instead', error)
        return (await api.sendMessage(chatId, fallback(), options)).message_id
      }
    },

    plain: async (text, { replyTo } = {}) =>
      (await api.sendMessage(chatId, text, target(replyTo))).message_id,

    photo: async (path, { caption, spoiler, replyTo } = {}) =>
      (await api.sendPhoto(chatId, new InputFile(path), {
        ...target(replyTo),
        ...(caption && { caption, parse_mode: 'HTML' }),
        ...(spoiler && { has_spoiler: true })
      })).message_id,

    poll: async (question, options, { correctOptionId, replyTo }) =>
      (await api.sendPoll(chatId, question, options, {
        ...target(replyTo),
        is_anonymous: true,
        type: 'quiz',
        correct_option_ids: [correctOptionId]
      })).message_id
  }
}
