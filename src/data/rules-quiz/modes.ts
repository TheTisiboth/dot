import { type QuizMode } from '../../types'

export const ALL_MODES: QuizMode[] = ['outdoor', 'indoor']

/** For rules the EUF Indoor Appendix changes (field, brick, goals, players, pulls, stall counts) */
export const OUTDOOR_ONLY: QuizMode[] = ['outdoor']

/** For rules that only exist in the EUF Indoor Appendix */
export const INDOOR_ONLY: QuizMode[] = ['indoor']
