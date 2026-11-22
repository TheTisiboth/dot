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

/**
 * Where the round of `questions` stands: `completed` rounds asked every one of them, `left` are the
 * least-asked ones the picker draws from. A season switch resumes that mode's round.
 */
export const roundOf = (questions: QuizQuestion[], askedIds: string[]): { completed: number; left: QuizQuestion[] } => {
  const counts = countAsks(askedIds)
  const askCount = (q: QuizQuestion): number => counts.get(q.id) ?? 0
  const completed = Math.min(...questions.map(askCount))
  return { completed, left: questions.filter(q => askCount(q) === completed) }
}

/** The questions `mode` asks. */
export const questionsFor = (questions: QuizQuestion[], mode: QuizMode): QuizQuestion[] => questions.filter(q => q.modes.includes(mode))

/** The pools that each run their own round: with `isFocus`, the focus questions and the others. */
export const roundPools = (eligible: QuizQuestion[], isFocus?: (id: string) => boolean): QuizQuestion[][] =>
  (isFocus ? [eligible.filter(q => isFocus(q.id)), eligible.filter(q => !isFocus(q.id))] : [eligible]).filter(pool => pool.length > 0)

/** A level other than the previous one when the pool still has one. */
const nextLevel = (pool: QuizQuestion[], previous: QuizDifficulty | undefined, random: Random): QuizDifficulty => {
  const levels = [...new Set(pool.map(q => q.difficulty))]
  const otherLevels = levels.filter(level => level !== previous)
  return randomItem(otherLevels.length > 0 ? otherLevels : levels, random)
}

/** The side `isFocus` does not hold for the previous question, or all of them when that side is empty. */
const alternatingSide = (eligible: QuizQuestion[], previousId: string | undefined, isFocus: (id: string) => boolean): QuizQuestion[] => {
  const wantFocus = previousId === undefined || !isFocus(previousId)
  return roundPools(eligible, isFocus).find(pool => isFocus(pool[0].id) === wantFocus) ?? eligible
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
  const allEligible = questionsFor(questions, mode)
  if (allEligible.length === 0) throw new Error(`No quiz question for mode ${mode}`)
  const eligible = isFocus ? alternatingSide(allEligible, askedIds[0], isFocus) : allEligible

  const pool = roundOf(eligible, askedIds).left
  const previousLevel = questions.find(q => q.id === askedIds[0])?.difficulty
  const level = nextLevel(pool, previousLevel, random)

  return randomItem(pool.filter(q => q.difficulty === level), random)
}
