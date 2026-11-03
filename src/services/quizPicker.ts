import { type QuizDifficulty, type QuizMode, type QuizQuestion, type SeasonType } from '../types'

// Telegram sendPoll question limit
const MAX_POLL_QUESTION = 300
const LEVELS: Record<QuizDifficulty, string> = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }
const MODES: Record<QuizMode, string> = { outdoor: '🌳 Outdoor', indoor: '🏢 Indoor' }
// The id rides in the poll text as zero-width characters: polls have no hidden field, and the
// history is the quiz memory. Each id character is 3 base-4 digits, after an invisible marker.
const TAG_MARKER = '\u2063'
const ZERO_WIDTH = ['\u200B', '\u200C', '\u200D', '\u2060']
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789_'
const DIGITS_PER_CHAR = 3
const TAG_PATTERN = new RegExp(`${TAG_MARKER}((?:${ZERO_WIDTH.join('|')})+)`)

export interface QuizPost {
  /** Sent as a text message before the poll when the question is too long for it */
  intro?: string;
  poll: string;
  options: string[];
}

type Random = () => number

const randomItem = <T>(items: T[], random: Random): T => items[Math.floor(random() * items.length)]

export const modeFor = (season: SeasonType): QuizMode => season === 'winter' ? 'indoor' : 'outdoor'

export const quizTag = (id: string): string =>
  TAG_MARKER + [...id].map(char => {
    const index = ID_ALPHABET.indexOf(char)
    if (index < 0) throw new Error(`Quiz id ${id} has a character outside [a-z0-9_]`)
    return index.toString(4).padStart(DIGITS_PER_CHAR, '0').split('').map(digit => ZERO_WIDTH[Number(digit)]).join('')
  }).join('')

export function parseQuizTag(text: string): string | undefined {
  const digits = TAG_PATTERN.exec(text)?.[1]
  if (!digits || digits.length % DIGITS_PER_CHAR !== 0) return undefined

  const chars = digits.match(new RegExp(`.{${DIGITS_PER_CHAR}}`, 'gu')) ?? []
  return chars
    .map(group => ID_ALPHABET[parseInt([...group].map(char => ZERO_WIDTH.indexOf(char)).join(''), 4)])
    .join('')
}

/**
 * Picks the next question from the ids already posted (newest first).
 * The least-asked questions form the pool, so a round ends once every question of the mode was
 * asked, and a season switch carries on where that mode left off. The level alternates when it can.
 */
export function pickQuestion(
  questions: QuizQuestion[],
  mode: QuizMode,
  askedIds: string[],
  random: Random = Math.random
): QuizQuestion {
  const eligible = questions.filter(q => q.modes.includes(mode))
  if (eligible.length === 0) throw new Error(`No quiz question for mode ${mode}`)

  const askCount = (q: QuizQuestion): number => askedIds.filter(id => id === q.id).length
  const fewestAsks = Math.min(...eligible.map(askCount))
  const pool = eligible.filter(q => askCount(q) === fewestAsks)

  const previousLevel = questions.find(q => q.id === askedIds[0])?.difficulty
  const levels = [...new Set(pool.map(q => q.difficulty))]
  const otherLevels = levels.filter(level => level !== previousLevel)
  const level = randomItem(otherLevels.length > 0 ? otherLevels : levels, random)

  return randomItem(pool.filter(q => q.difficulty === level), random)
}

export function buildQuizPost(q: QuizQuestion, random: Random = Math.random): QuizPost {
  // Only mode-specific questions say so: their answer depends on it
  const mode = q.modes.length === 1 ? ` · ${MODES[q.modes[0]]}` : ''
  const header = `${LEVELS[q.difficulty]}${mode}${quizTag(q.id)}`
  const options = [q.answer, ...q.wrong]
    .map(option => ({ option, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ option }) => option)
  const full = `${header}\n\n${q.question}`

  return full.length <= MAX_POLL_QUESTION
    ? { poll: full, options }
    : { intro: full, poll: `${header}\n\n👆 Your answer?`, options }
}
