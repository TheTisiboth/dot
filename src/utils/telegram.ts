// Bot API sendPoll limits
export const POLL_LIMITS = { question: 300, option: 100 } as const

/** Send options targeting a forum topic, or nothing when there is no topic. */
export const threadOptions = (threadId?: string | number): { message_thread_id?: number } =>
  threadId ? { message_thread_id: Number(threadId) } : {}

export const replyOptions = (messageId?: number): { reply_to_message_id?: number } =>
  messageId ? { reply_to_message_id: messageId } : {}
