import { type RulesQuizService } from '../services/RulesQuizService'
import { findQuizQuestion } from '../data/rules-quiz'
import { EMOJIS } from '../utils/constants'
import { type Command } from './registry'

/** Admin commands to drive the rules quiz by hand. */
export const quizCommands = (rulesQuiz: RulesQuizService): Command[] => [
  {
    name: 'test_rule',
    description: 'Preview a rules quiz question and its answer here: /test_rule [id]',
    adminOnly: true,
    run: async ({ args: id, chat, reply }) => {
      const question = id ? findQuizQuestion(id) : await rulesQuiz.pickNext()
      if (!question) {
        await reply(`${EMOJIS.CROSS_MARK} Unknown question id: ${id}`)
        return
      }
      await rulesQuiz.preview(chat, question)
    }
  },
  {
    name: 'send_rule',
    description: 'Post the next rules quiz question to the rules chat',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.postNext()
      await reply(`${EMOJIS.CHECK_MARK} Rules quiz posted: ${question.id} (${question.difficulty})`)
    }
  },
  {
    name: 'answer_rule',
    description: 'Answer the latest rules quiz poll now',
    adminOnly: true,
    run: async ({ reply }) => {
      const question = await rulesQuiz.answerLatest()
      await reply(question
        ? `${EMOJIS.CHECK_MARK} Rules quiz answered: ${question.id}`
        : `${EMOJIS.WARNING} Nothing to answer in the rules chat: no quiz poll there, or the latest one is already answered. (/test_rule previews come with their answer.)`)
    }
  }
]
