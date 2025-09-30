export interface SeasonConfig {
  season: SeasonType;
  location: string;
  practices: PracticeDay[];
}

export interface PracticeDay {
  day: number; // 0=Sunday, 1=Monday, etc.
  time: string; // e.g., "20:30"
  location?: string; // Optional override for specific day
}

export interface BotConfig {
  telegram: TelegramConfig;
  ollama: OllamaConfig;
  seasons: SeasonsConfig;
  testing: TestingConfig;
}

export interface TelegramConfig {
  token: string;
  chatId?: string;
  adminChatId?: string;
}

export interface OllamaConfig {
  enabled: boolean;
  host: string;
  model: string;
}

export interface SeasonsConfig {
  winter: SeasonConfigBase;
  summer: SeasonConfigBase;
}

export interface SeasonConfigBase {
  startDate: DateConfig;
  location: string;
  practices: PracticeDay[];
}

export interface DateConfig {
  month: number;
  day: number;
}

export interface TestingConfig {
  enabled: boolean;
  overrideDate?: string;
}

export type SeasonType = 'winter' | 'summer';

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
  practiceDay?: PracticeDay;
}

export interface BotCommand {
  command: string;
  description: string;
  adminOnly?: boolean;
}

export interface TestResult {
  date: string;
  season: SeasonType;
  location: string;
  time: string;
  shouldSendMessage: boolean;
  nextTraining: TrainingInfo;
  message?: string;
}