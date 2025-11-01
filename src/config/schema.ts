import { z } from 'zod'

// Practice Day Schema
export const practiceDaySchema = z.object({
  day: z.number().min(0).max(6),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, 'Time must be in format HH:MM')
})

// Date Config Schema
export const dateConfigSchema = z.object({
  month: z.number().min(1).max(12),
  day: z.number().min(1).max(31)
})

// Telegram Config Schema
const telegramConfigSchema = z.object({
  token: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  chatId: z.string().min(1, 'CHAT_ID is required'),
  chatThreadId: z.string().optional(),
  adminChatId: z.string().min(1, 'ADMIN_CHAT_ID is required'),
  trainerChatId: z.string().min(1, 'TRAINER_CHAT_ID is required'),
  trainerChatThreadId: z.string().optional()
})

// Ollama Config Schema
const ollamaConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.url('OLLAMA_HOST must be a valid URL'),
  model: z.string().min(1, 'OLLAMA_MODEL is required')
})

// Season Config Base Schema
const seasonConfigBaseSchema = z.object({
  startDate: dateConfigSchema,
  location: z.string().trim().min(1, 'WINTER_LOCATION and SUMMER_LOCATION is required'),
  practices: z.array(practiceDaySchema).length(2, 'WINTER_PRACTICE_DAYS and SUMMER_PRACTICE_DAYS must have exactly 2 practice days')
})

// Seasons Config Schema
const seasonsConfigSchema = z.object({
  winter: seasonConfigBaseSchema,
  summer: seasonConfigBaseSchema
})

// Testing Config Schema
const testingConfigSchema = z.object({
  enabled: z.boolean(),
  overrideDate: z.string().optional()
})

// Exceptional Training Schema
const exceptionalTrainingSchema = z.object({
  location: z.string().optional(),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, 'Time must be in HH:MM format').optional(),
  isCancelled: z.boolean().optional()
})

// Bot Config Schema
export const botConfigSchema = z.object({
  telegram: telegramConfigSchema,
  ollama: ollamaConfigSchema,
  seasons: seasonsConfigSchema,
  testing: testingConfigSchema,
  exceptionalTraining: exceptionalTrainingSchema
})
