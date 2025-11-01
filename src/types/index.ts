import type { z } from 'zod'
import type { botConfigSchema, practiceDaySchema, dateConfigSchema } from '../config/schema'

export interface SeasonConfig {
  season: SeasonType;
  location: string;
  practices: PracticeDay[];
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

export interface TrainingInfo {
  date: Date;
  dayName: string;
  location: string;
  time: string;
  season: SeasonType;
  practiceDay: PracticeDay;
  isCancelled?: boolean;
}