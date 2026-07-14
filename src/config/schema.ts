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
  trainerChatThreadId: z.string().optional(),
  enableTrainerMessages: z.boolean()
})

// Ollama Config Schema
const ollamaConfigSchema = z.object({
  enabled: z.boolean(),
  host: z.url('OLLAMA_HOST must be a valid URL'),
  model: z.string().min(1, 'OLLAMA_MODEL is required')
})

// MTProto Config Schema (user account - the Bot API cannot read reactions at all)
const MTPROTO_HELP = 'Get api_id/api_hash from https://my.telegram.org (API development tools), then run `npm run mtproto:login`'

const mtprotoConfigSchema = z.object({
  apiId: z.coerce.number({ error: `TELEGRAM_API_ID is missing or not a number. ${MTPROTO_HELP}` }).int().positive(),
  apiHash: z.string({ error: `TELEGRAM_API_HASH is missing. ${MTPROTO_HELP}` }).min(1),
  // A GramJS StringSession is a version byte "1" followed by base64. Caught here because the
  // GramJS constructor otherwise dies with an opaque "Not a valid string".
  session: z.string({ error: `TELEGRAM_SESSION is missing. ${MTPROTO_HELP}` })
    .startsWith('1', 'TELEGRAM_SESSION is malformed (it must start with "1"). Re-generate it with `npm run mtproto:login`')
    .min(50, 'TELEGRAM_SESSION looks truncated. Re-generate it with `npm run mtproto:login`')
})

// Attendance Config Schema
const attendanceConfigSchema = z.object({
  reminderHoursBefore: z.number().positive(),
  cancelHoursBefore: z.number().positive()
}).refine(
  ({ reminderHoursBefore, cancelHoursBefore }) => cancelHoursBefore < reminderHoursBefore,
  'CANCEL_HOURS_BEFORE must be smaller than REMINDER_HOURS_BEFORE (the cancellation comes after the reminder)'
)

// Season Config Base Schema
const seasonConfigBaseSchema = z.object({
  startDate: dateConfigSchema,
  location: z.string().trim().min(1, 'WINTER_LOCATION and SUMMER_LOCATION is required'),
  practices: z.array(practiceDaySchema).length(2, 'WINTER_PRACTICE_DAYS and SUMMER_PRACTICE_DAYS must have exactly 2 practice days'),
  minAttendance: z.number().int().min(1, 'WINTER_MIN_ATTENDANCE and SUMMER_MIN_ATTENDANCE must be at least 1')
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
  mtproto: mtprotoConfigSchema,
  ollama: ollamaConfigSchema,
  attendance: attendanceConfigSchema,
  seasons: seasonsConfigSchema,
  testing: testingConfigSchema,
  exceptionalTraining: exceptionalTrainingSchema
})
