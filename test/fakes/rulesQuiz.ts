import { QUIZ_QUESTIONS } from '../../src/quiz/data'
import { type RulesQuizService } from '../../src/quiz/service'
import { type QuizPublisher } from '../../src/quiz/publisher'
import { type QuizQuestion } from '../../src/quiz/question'

interface QuizTarget { chatId: string; threadId?: number }

/** Records which quiz actions ran, in order. */
export const makeFakeRulesQuiz = () => {
  const question = QUIZ_QUESTIONS[0]

  const fake = {
    calls: [] as string[],
    sendScheduled: async () => { fake.calls.push('sendScheduled'); return { status: 'sent' } as const },
    armAnswer: async () => { fake.calls.push('armAnswer') },
    pickNext: async () => { fake.calls.push('pickNext'); return question },
    postNext: async () => { fake.calls.push('postNext'); return question },
    answerLatest: async () => { fake.calls.push('answerLatest'); return question }
  }

  // RulesQuizService has private fields, so no object literal satisfies it structurally
  return fake as unknown as typeof fake & RulesQuizService
}

/** Records where previews went; posts and answers are the service's, faked above. */
export const makeFakeQuizPublisher = () => {
  const previews: Array<{ target: QuizTarget; question: QuizQuestion }> = []
  const publisher: QuizPublisher = {
    post: async () => 0,
    answer: async () => undefined,
    preview: async (target, question) => { previews.push({ target, question }) }
  }
  return { ...publisher, previews }
}
