import { type RulesQuizService } from '../quiz/service'
import { type QuizPublisher } from '../quiz/publisher'
import { findQuizQuestion } from '../quiz/data'
import { EMOJIS } from '../shared/emojis'
import { type Command } from './registry'

/** Admin commands to drive the rules quiz by hand. */
export const quizCommands = (rulesQuiz: RulesQuizService, publisher: QuizPublisher): Command[] => [
  {
    name: 'quiz_preview',
    description: 'Preview a quiz question and its answer here: /quiz_preview [id]',
    adminOnly: true,
    run: async ({ args: id, chat, reply }) => {
      const question = id ? findQuizQuestion(id) : await rulesQuiz.pickNext()
      if (!question) {
        await reply.plain(`${EMOJIS.CROSS_MARK} No quiz question with id ${id}.`)
        return
      }
      await publisher.preview(chat, question)
    }
  },
  {
    name: 'quiz_post',
    description: 'Post the next quiz question to the rules chat',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.postNext()
      await reply.plain(`${EMOJIS.CHECK_MARK} Quiz question posted: ${question.id} (${question.difficulty})`)
    }
  },
  {
    name: 'quiz_answer',
    description: 'Post the answer to the latest quiz question now',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.answerLatest()
      await reply.plain(question
        ? `${EMOJIS.CHECK_MARK} Quiz answer posted: ${question.id}`
        : `${EMOJIS.WARNING} Nothing to answer: no quiz question in the rules chat, or the latest one is answered already. A /quiz_preview comes with its answer.`)
    }
  }
]
