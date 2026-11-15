import { type ReactionReader } from '../../src/services/ReactionReader'
import { CANCELLATION_SIGNATURE } from '../../src/utils/constants'

/** What the chat history holds; tests change it between runs to play a restart. */
export interface ChatHistory {
  /** The training post, or undefined when it cannot be found */
  postId?: number;
  thumbsUp: number;
  reminder: boolean;
  cancellation: boolean;
}

export const TRAINING_POST_ID = 42

/** Reads a scripted chat history instead of MTProto. */
export const makeFakeReader = (history: Partial<ChatHistory> = {}) => {
  const chat: ChatHistory = { postId: TRAINING_POST_ID, thumbsUp: 0, reminder: false, cancellation: false, ...history }

  const fake = {
    chat,
    findPollMessage: async () => chat.postId,
    getThumbsUpCount: async () => chat.thumbsUp,
    hasBotReplyTo: async () => chat.reminder,
    hasBotMessageContaining: async (_chatId: string, _threadId: string | undefined, text: string) =>
      text === CANCELLATION_SIGNATURE && chat.cancellation
  }

  // ReactionReader has private fields, so no object literal satisfies it structurally
  return fake as unknown as typeof fake & ReactionReader
}
