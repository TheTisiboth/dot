import { type QuizBatch, type QuizDifficulty, type QuizMode, type QuizQuestion } from './question'
import { type AskedQuiz } from './history'
import { questionsFor, roundOf, roundPools } from './picker'
import { ALL_MODES } from './data/modes'

const LATEST_COUNT = 5
const DIFFICULTIES: QuizDifficulty[] = ['easy', 'medium', 'hard']

/** Questions asked in the current round, out of all of them. */
interface Tally {
  asked: number;
  total: number;
}

export interface Round extends Tally {
  completed: number;
  /** Which side of the alternation, when every other question is a focus one. */
  focus?: boolean;
}

export interface ModeStats {
  mode: QuizMode;
  rounds: Round[];
  bySource: Array<Tally & { name: string }>;
  byDifficulty: Array<Tally & { difficulty: QuizDifficulty }>;
}

export interface QuizStats {
  current: QuizMode;
  modes: ModeStats[];
  latest: AskedQuiz[];
}

/**
 * Where each mode's round stands, from what was posted (newest first), counted with the picker's own
 * rounds. An id no longer in the bank counts nowhere.
 */
export const quizStats = (batches: QuizBatch[], asked: AskedQuiz[], current: QuizMode, isFocus?: (id: string) => boolean): QuizStats => {
  const askedIds = asked.map(quiz => quiz.questionId)

  const modeStats = (mode: QuizMode): ModeStats => {
    const eligible = questionsFor(batches.flatMap(batch => batch.questions), mode)
    const rounds = roundPools(eligible, isFocus).map(pool => ({ pool, ...roundOf(pool, askedIds) }))
    const left = new Set(rounds.flatMap(round => round.left))
    const tally = (questions: QuizQuestion[]): Tally => ({ asked: questions.filter(q => !left.has(q)).length, total: questions.length })

    return {
      mode,
      rounds: rounds.map(({ pool, completed }) => ({ completed, ...tally(pool), focus: isFocus?.(pool[0].id) })),
      bySource: batches.map(batch => ({ name: batch.name, ...tally(questionsFor(batch.questions, mode)) })).filter(source => source.total > 0),
      byDifficulty: DIFFICULTIES.map(difficulty => ({ difficulty, ...tally(eligible.filter(q => q.difficulty === difficulty)) })).filter(level => level.total > 0)
    }
  }

  return { current, modes: ALL_MODES.map(modeStats), latest: asked.slice(0, LATEST_COUNT) }
}
