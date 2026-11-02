import { type QuizBatch } from '../../types'
import { rulesCh01to08 } from './rules-ch01-08'
import { rulesCh09to14 } from './rules-ch09-14'
import { signals } from './signals'

export const QUIZ_BATCHES: QuizBatch[] = [signals, rulesCh01to08, rulesCh09to14]
