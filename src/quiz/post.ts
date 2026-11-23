import { type QuizDifficulty, type QuizMode, type QuizQuestion } from './question'
import { quizTag } from './tag'
import { POLL_LIMITS } from '../telegram/botApi'

export const LEVELS: Record<QuizDifficulty, string> = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }
export const MODES: Record<QuizMode, string> = { outdoor: '🌳 Outdoor', indoor: '🏢 Indoor' }

export interface QuizPost {
  /** Sent as a text message before the poll when the question is too long for it */
  intro?: string;
  poll: string;
  options: string[];
  /** Index of the right answer in `options`, for the quiz-type poll */
  correctOptionId: number;
}

type Random = () => number

const shuffle = <T>(items: T[], random: Random): T[] =>
  items
    .map(item => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item)

/** Level, the modes the answer holds for (the group trains both), plus the hidden id. */
const quizHeader = (q: QuizQuestion): string =>
  `${LEVELS[q.difficulty]} · ${q.modes.map(m => MODES[m]).join(' & ')}${quizTag(q.id)}`

export function buildQuizPost(q: QuizQuestion, random: Random = Math.random): QuizPost {
  const header = quizHeader(q)
  const options = shuffle([q.answer, ...q.wrong], random)
  const correctOptionId = options.indexOf(q.answer)
  const full = `${header}\n\n${q.question}`

  return full.length <= POLL_LIMITS.question
    ? { poll: full, options, correctOptionId }
    : { intro: full, poll: `${header}\n\n👆 Your answer?`, options, correctOptionId }
}
