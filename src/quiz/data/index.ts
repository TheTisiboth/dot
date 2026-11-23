import { type QuizBatch, type QuizQuestion } from '../question'
import { annotations } from './annotations'
import { changes } from './changes'
import { indoor } from './indoor'
import { rulesCh01to08 } from './rulesCh01to08'
import { rulesCh09to14 } from './rulesCh09to14'
import { rulesCh15to20 } from './rulesCh15to20'
import { signals } from './signals'

export const QUIZ_BATCHES: QuizBatch[] = [signals, rulesCh01to08, rulesCh09to14, rulesCh15to20, indoor, annotations, changes]

export const QUIZ_QUESTIONS: QuizQuestion[] = QUIZ_BATCHES.flatMap(batch => batch.questions)

export const findQuizQuestion = (id: string): QuizQuestion | undefined => QUIZ_QUESTIONS.find(q => q.id === id)

export const findQuizBatch = (id: string): QuizBatch | undefined =>
  QUIZ_BATCHES.find(batch => batch.questions.some(q => q.id === id))

const SIGNAL_IDS = new Set(signals.questions.map(q => q.id))

export const isSignalQuestion = (id: string): boolean => SIGNAL_IDS.has(id)
