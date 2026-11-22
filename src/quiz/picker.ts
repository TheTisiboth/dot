import { type QuizDifficulty, type QuizMode, type QuizQuestion } from './question'
import { type SeasonType } from '../training/season'

type Random = () => number

const randomItem = <T>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

export const modeFor = (season: SeasonType): QuizMode => season === 'winter' ? 'indoor' : 'outdoor'

const countAsks = (askedIds: string[]): Map<string, number> => {
  const counts = new Map<string, number>()
  askedIds.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1))
  return counts
}

/** The least-asked questions: a round ends once all were asked, and a season switch resumes that mode's round. */
const leastAsked = (questions: QuizQuestion[], askedIds: string[]): QuizQuestion[] => {
  const counts = countAsks(askedIds)
  const askCount = (q: QuizQuestion): number => counts.get(q.id) ?? 0
  const fewestAsks = Math.min(...questions.map(askCount))
  return questions.filter(q => askCount(q) === fewestAsks)
}

/** A level other than the previous one when the pool still has one. */
const nextLevel = (pool: QuizQuestion[], previous: QuizDifficulty | undefined, random: Random): QuizDifficulty => {
  const levels = [...new Set(pool.map(q => q.difficulty))]
  const otherLevels = levels.filter(level => level !== previous)
  return randomItem(otherLevels.length > 0 ? otherLevels : levels, random)
}

/** The side `isFocus` does not hold for the previous question, or all of them when that side is empty. */
const alternatingSide = (eligible: QuizQuestion[], previousId: string | undefined, isFocus: (id: string) => boolean): QuizQuestion[] => {
  const wantFocus = previousId === undefined || !isFocus(previousId)
  const side = eligible.filter(q => isFocus(q.id) === wantFocus)
  return side.length > 0 ? side : eligible
}

/**
 * Picks the next question for `mode`, given the ids already posted (newest first).
 * With `isFocus`, every other question is a focus one.
 */
export function pickQuestion(
  questions: QuizQuestion[],
  mode: QuizMode,
  askedIds: string[],
  random: Random = Math.random,
  isFocus?: (id: string) => boolean
): QuizQuestion {
  const allEligible = questions.filter(q => q.modes.includes(mode))
  if (allEligible.length === 0) throw new Error(`No quiz question for mode ${mode}`)
  const eligible = isFocus ? alternatingSide(allEligible, askedIds[0], isFocus) : allEligible

  const pool = leastAsked(eligible, askedIds)
  const previousLevel = questions.find(q => q.id === askedIds[0])?.difficulty
  const level = nextLevel(pool, previousLevel, random)

  return randomItem(pool.filter(q => q.difficulty === level), random)
}
