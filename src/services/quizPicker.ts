import { type QuizDifficulty, type QuizMode, type QuizQuestion, type SeasonType } from '../types'
import { quizTag } from '../utils/quizTag'
import { POLL_LIMITS } from '../utils/telegram'

const LEVELS: Record<QuizDifficulty, string> = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }
const MODES: Record<QuizMode, string> = { outdoor: '🌳 Outdoor', indoor: '🏢 Indoor' }

export interface QuizPost {
  /** Sent as a text message before the poll when the question is too long for it */
  intro?: string;
  poll: string;
  options: string[];
}

type Random = () => number

const randomItem = <T>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

const shuffle = <T>(items: T[], random: Random): T[] =>
  items
    .map(item => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item)

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

/** Picks the next question for `mode`, given the ids already posted (newest first). */
export function pickQuestion(
  questions: QuizQuestion[],
  mode: QuizMode,
  askedIds: string[],
  random: Random = Math.random
): QuizQuestion {
  const eligible = questions.filter(q => q.modes.includes(mode))
  if (eligible.length === 0) throw new Error(`No quiz question for mode ${mode}`)

  const pool = leastAsked(eligible, askedIds)
  const previousLevel = questions.find(q => q.id === askedIds[0])?.difficulty
  const level = nextLevel(pool, previousLevel, random)

  return randomItem(pool.filter(q => q.difficulty === level), random)
}

/** Level, plus the mode for mode-specific questions (their answer depends on it), plus the hidden id. */
const quizHeader = (q: QuizQuestion): string => {
  const mode = q.modes.length === 1 ? ` · ${MODES[q.modes[0]]}` : ''
  return `${LEVELS[q.difficulty]}${mode}${quizTag(q.id)}`
}

export function buildQuizPost(q: QuizQuestion, random: Random = Math.random): QuizPost {
  const header = quizHeader(q)
  const options = shuffle([q.answer, ...q.wrong], random)
  const full = `${header}\n\n${q.question}`

  return full.length <= POLL_LIMITS.question
    ? { poll: full, options }
    : { intro: full, poll: `${header}\n\n👆 Your answer?`, options }
}
