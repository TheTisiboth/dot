import type TelegramBot from 'node-telegram-bot-api'

// Bot API sendPoll limits
export const POLL_LIMITS = { question: 300, option: 100 } as const

/** Send options targeting a forum topic, or nothing when there is no topic. */
export const threadOptions = (threadId?: string | number): { message_thread_id?: number } =>
  threadId ? { message_thread_id: Number(threadId) } : {}

export const replyOptions = (messageId?: number): { reply_to_message_id?: number } =>
  messageId ? { reply_to_message_id: messageId } : {}

/** No link preview card under the message. */
export const noLinkPreview = (): Pick<TelegramBot.SendMessageOptions, 'link_preview_options'> =>
  // The library JSON-encodes reply_markup and entities but not this one, which the Bot API needs as JSON
  ({ link_preview_options: JSON.stringify({ is_disabled: true }) as unknown as TelegramBot.LinkPreviewOptions })
