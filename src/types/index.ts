import type { z } from 'zod'
import type { botConfigSchema, practiceDaySchema, dateConfigSchema } from '../config/schema'

export interface SeasonConfig extends SeasonConfigBase {
  season: SeasonType;
}

export type PracticeDay = z.infer<typeof practiceDaySchema>
export type DateConfig = z.infer<typeof dateConfigSchema>

export type BotConfig = z.infer<typeof botConfigSchema>
export type SeasonsConfig = BotConfig['seasons']
export type SeasonConfigBase = SeasonsConfig['winter']

export type SeasonType = 'winter' | 'summer'

export interface MessageGenerationOptions {
  useLLM?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface Attendance {
  count: number;
  threshold: number;
}

export interface TrainingInfo {
  date: Date;
  dayName: string;
  location: string;
  time: string;
  throwingTime?: string;
  season: SeasonType;
  practiceDay: PracticeDay;
  isCancelled?: boolean;
}
export type QuizDifficulty = 'easy' | 'medium' | 'hard'
export type QuizMode = 'outdoor' | 'indoor'

export interface QuizQuestion {
  /** Hashtag-safe and never renamed once posted: the bot remembers asked questions by it */
  id: string;
  difficulty: QuizDifficulty;
  modes: QuizMode[];
  /** WFDF rule number (e.g. 9.5.1), linked on urules.org; without it the batch source is linked */
  ref?: string;
  question: string;
  answer: string;
  /** Options are shuffled when posting */
  wrong: string[];
  explanation: string;
  /** Sent as a photo before the poll, relative to the app root */
  image?: string;
}

export interface QuizBatch {
  source: { title: string; url: string };
  questions: QuizQuestion[];
}
