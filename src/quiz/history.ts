import { type Api } from 'telegram'
import { type History, SEARCH_PAGE_SIZE, pollQuestion, repliesTo, sentAt } from '../telegram/mtproto/history'
import { parseQuizTag } from './tag'

export interface LatestQuiz {
  messageId: number;
  questionId: string;
  postedAt: Date;
  answered: boolean;
}

export type QuizHistory = ReturnType<typeof quizHistory>

const quizIdOf = (message: Api.Message): string | undefined => {
  const question = pollQuestion(message)
  return question ? parseQuizTag(question) : undefined
}

/** The chat history is the quiz memory: what was asked, and whether the latest was answered. */
export const quizHistory = (history: History) => ({
  /** Ids of the quiz questions already posted, newest first. */
  async getAskedQuizIds(chatId: string, threadId: number | undefined): Promise<string[]> {
    const messages = await history.searchBotMessages(chatId, threadId)

    return messages.flatMap(message => {
      const id = quizIdOf(message)
      return id ? [id] : []
    })
  },

  /**
   * The newest quiz poll, and whether the bot already replied to it (the answer). Found from the
   * history, so a restart loses neither the poll nor the fact it was answered.
   */
  async getLatestQuiz(chatId: string, threadId: number | undefined): Promise<LatestQuiz | undefined> {
    // Recent enough: the poll is the newest quiz, and its answer comes right after it
    const messages = await history.searchBotMessages(chatId, threadId, { maxMessages: SEARCH_PAGE_SIZE })
    for (const message of messages) {
      const questionId = quizIdOf(message)
      if (!questionId) continue

      return {
        messageId: message.id,
        questionId,
        postedAt: sentAt(message),
        answered: messages.some(reply => repliesTo(reply, message.id))
      }
    }

    return undefined
  }
})
