import { QUIZ_QUESTIONS } from '../../src/data/rules-quiz'
import { type RulesQuizService } from '../../src/services/RulesQuizService'
import { type QuizQuestion } from '../../src/types'

interface QuizTarget { chatId: string; threadId?: string }

/** Records which quiz actions ran, in order, and where previews went. */
export const makeFakeRulesQuiz = () => {
  const question = QUIZ_QUESTIONS[0]

  const fake = {
    calls: [] as string[],
    previews: [] as Array<{ target: QuizTarget; question: QuizQuestion }>,
    sendScheduled: async () => { fake.calls.push('sendScheduled'); return { status: 'sent' } as const },
    armAnswer: async () => { fake.calls.push('armAnswer') },
    pickNext: async () => { fake.calls.push('pickNext'); return question },
    postNext: async () => { fake.calls.push('postNext'); return question },
    answerLatest: async () => { fake.calls.push('answerLatest'); return question },
    preview: async (target: QuizTarget, previewed: QuizQuestion) => { fake.previews.push({ target, question: previewed }) }
  }

  // RulesQuizService has private fields, so no object literal satisfies it structurally
  return fake as unknown as typeof fake & RulesQuizService
}
