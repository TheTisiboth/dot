import { type QuizBatch } from '../../types'
import { annotations } from './annotations'
import { changes } from './changes'
import { indoor } from './indoor'
import { rulesCh01to08 } from './rules-ch01-08'
import { rulesCh09to14 } from './rules-ch09-14'
import { rulesCh15to20 } from './rules-ch15-20'
import { signals } from './signals'

export const QUIZ_BATCHES: QuizBatch[] = [signals, rulesCh01to08, rulesCh09to14, rulesCh15to20, indoor, annotations, changes]
