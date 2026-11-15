import { type Api, GrammyError } from 'grammy'
import { log } from './logger'

// Bot API sendPoll limits
export const POLL_LIMITS = { question: 300, option: 100 } as const

/** A chat, optionally one forum topic in it. */
export interface ChatTarget {
  chatId: string;
  threadId?: string;
}

/** Send options targeting a forum topic, or nothing when there is no topic. */
export const threadOptions = (threadId?: string | number): { message_thread_id?: number } =>
  threadId ? { message_thread_id: Number(threadId) } : {}

export const replyOptions = (messageId?: number): { reply_to_message_id?: number } =>
  messageId ? { reply_to_message_id: messageId } : {}

/** No link preview card under the message. */
export const noLinkPreview = () => ({ link_preview_options: { is_disabled: true } })

type SendOptions = Parameters<Api['sendMessage']>[2]

const isParseError = (error: unknown): boolean =>
  error instanceof GrammyError && error.error_code === 400 && error.description.includes("can't parse entities")

/** Sends HTML; when Telegram cannot parse it, sends `fallback()` instead so the message is not lost. */
export const sendWithFallback = async (api: Api, chatId: string, text: string, fallback: () => string, options: SendOptions = {}) => {
  const html = { parse_mode: 'HTML', ...options } as const
  try {
    return await api.sendMessage(chatId, text, html)
  } catch (error) {
    if (!isParseError(error)) throw error
    log.error('Telegram rejected the message, sending the template instead', error)
    return await api.sendMessage(chatId, fallback(), html)
  }
}
