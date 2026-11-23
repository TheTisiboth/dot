import { type Api, GrammyError, type Transformer } from 'grammy'
import { errorMessage, log } from '../shared/logger'

// Bot API sendPoll limits
export const POLL_LIMITS = { question: 300, option: 100 } as const

/** A chat, optionally one forum topic in it. */
export interface ChatTarget {
  chatId: string;
  threadId?: number;
}

/** Send options targeting a forum topic, or nothing when there is no topic. */
export const threadOptions = (threadId?: number): { message_thread_id?: number } =>
  threadId ? { message_thread_id: threadId } : {}

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

/**
 * grammY reports a failed getUpdates only through `debug`, so a Telegram outage would leave no log line.
 * Logs the first failure of a streak and the recovery, not every retry.
 */
export const pollingOutageLogger = (): Transformer => {
  let failing = false
  const update = (failed: boolean, reason: string) => {
    if (failed && !failing) log.warn('Telegram polling', `getUpdates failing, retrying until it recovers: ${reason}`)
    if (!failed && failing) log.bot('Telegram polling recovered')
    failing = failed
  }
  return async (prev, method, payload, signal) => {
    if (method !== 'getUpdates') return prev(method, payload, signal)
    try {
      const response = await prev(method, payload, signal)
      update(!response.ok, response.ok ? '' : response.description)
      return response
    } catch (error) {
      // Stopping the bot aborts the pending poll: not an outage
      if (!signal?.aborted) update(true, errorMessage(error))
      throw error
    }
  }
}
