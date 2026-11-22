import { z } from 'zod'
import { type DateConfig, type TimeOfDay } from '../shared/time'

const flag = z.string().transform(value => value === 'true')
const number = z.coerce.number({ error: 'must be a number' })
const required = z.string({ error: 'is required' })

const TIME = '([01]?\\d|2[0-3]):[0-5]\\d'

const timeOfDay = z.string().regex(new RegExp(`^${TIME}$`), 'must be HH:MM (00:00 to 23:59)')
  .transform((raw): TimeOfDay => { const [hour, minute] = raw.split(':').map(Number); return { hour, minute } })

const PRACTICE = new RegExp(`^[0-6]:${TIME}$`)

const practiceDays = required
  .transform(raw => raw.split(',').map(entry => entry.trim()))
  .pipe(z.array(z.string().regex(PRACTICE, 'must be day:HH:MM,… (day 0-6, Sunday = 0; time 00:00 to 23:59)')))
  .transform(entries => entries.map(entry => {
    const [day, hour, minute] = entry.split(':').map(Number)
    return { day, time: { hour, minute } }
  }))
  .refine(practices => new Set(practices.map(({ day }) => day)).size === practices.length, 'allows one practice per weekday')

// Checked against a non-leap year: a season start has to exist every year
const monthDay = required.regex(/^\d{1,2}:\d{1,2}$/, 'must be month:day')
  .transform((raw): DateConfig => { const [month, day] = raw.split(':').map(Number); return { month, day } })
  .refine(({ month, day }) => month >= 1 && month <= 12 && new Date(2025, month - 1, day).getMonth() === month - 1, 'must be a date that exists every year (month:day)')

export interface TrainingLocation {
  name: string;
  url?: string;
}

const LOCATION_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/

/** `[Name](url)` links the name; any other text is the name alone. */
export function parseLocation(raw: string): TrainingLocation {
  const [, name, url] = LOCATION_LINK.exec(raw) ?? []
  return name ? { name, url } : { name: raw }
}

const location = required.trim().min(1, 'must not be blank').transform(parseLocation)
  .refine(({ url }) => url === undefined || URL.canParse(url), 'a location link [Name](url) needs a valid URL')

const threadId = z.coerce.number({ error: 'must be a topic id' }).int().positive().optional()

const MTPROTO_HELP = 'Get api_id/api_hash from https://my.telegram.org (API development tools), then run `npm run mtproto:login`'

// Keyed by env var name, so every error names its variable
export const envVars = z.object({
  TELEGRAM_BOT_TOKEN: required,
  TEAM_CHAT_ID: required,
  TEAM_CHAT_THREAD_ID: threadId,
  ADMIN_CHAT_ID: required,
  TRAINER_CHAT_ID: required,
  TRAINER_CHAT_THREAD_ID: threadId,
  ENABLE_TRAINER_MESSAGES: flag.default(true),

  TELEGRAM_API_ID: z.coerce.number({ error: `is missing or not a number. ${MTPROTO_HELP}` }).int().positive(),
  TELEGRAM_API_HASH: z.string({ error: `is missing. ${MTPROTO_HELP}` }),
  // A GramJS StringSession is a version byte "1" followed by base64. Caught here because the
  // GramJS constructor otherwise dies with an opaque "Not a valid string".
  TELEGRAM_SESSION: z.string({ error: `is missing. ${MTPROTO_HELP}` })
    .startsWith('1', 'is malformed (it must start with "1"). Re-generate it with `npm run mtproto:login`')
    .min(50, 'looks truncated. Re-generate it with `npm run mtproto:login`'),

  OLLAMA_ENABLED: flag.default(false),
  OLLAMA_HOST: z.url('must be a valid URL').default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().default('llama3.2:3b'),

  REMINDER_HOURS_BEFORE: number.positive().default(3),
  CANCEL_HOURS_BEFORE: number.positive().default(1),

  WINTER_START_DATE: monthDay,
  WINTER_LOCATION: location,
  WINTER_PRACTICE_DAYS: practiceDays,
  WINTER_MIN_ATTENDANCE: number.int().min(1).default(8),
  WINTER_KEY_MESSAGE_ENABLED: flag.default(true),
  WINTER_THROWING_MINUTES_BEFORE: number.int().min(0).default(0),

  SUMMER_START_DATE: monthDay,
  SUMMER_LOCATION: location,
  SUMMER_PRACTICE_DAYS: practiceDays,
  SUMMER_MIN_ATTENDANCE: number.int().min(1).default(8),
  SUMMER_KEY_MESSAGE_ENABLED: flag.default(true),
  SUMMER_THROWING_MINUTES_BEFORE: number.int().min(0).default(0),

  EXCEPTIONAL_LOCATION: location.optional(),
  EXCEPTIONAL_TIME: timeOfDay.optional(),
  EXCEPTIONAL_CANCELLED: flag.optional(),

  RULES_QUIZ_ENABLED: flag.default(false),
  // The history is read through the MTProto user account, for which a private chat id with the
  // bot is a different chat (its own Saved Messages): quizzes would never be found
  RULES_CHAT_ID: z.string().startsWith('-', 'must be a group or channel (its id starts with "-"), not a private chat with the bot').optional(),
  RULES_CHAT_THREAD_ID: threadId,
  RULES_ANSWER_DELAY_MINUTES: number.int().nonnegative().default(60),
  RULES_SIGNALS_EVERY_OTHER: flag.default(false)
})

const configSchema = envVars
  .refine(env => env.CANCEL_HOURS_BEFORE < env.REMINDER_HOURS_BEFORE, {
    path: ['CANCEL_HOURS_BEFORE'],
    message: 'must be smaller than REMINDER_HOURS_BEFORE (the cancellation comes after the reminder)'
  })
  .refine(({ WINTER_START_DATE: winter, SUMMER_START_DATE: summer }) => winter.month !== summer.month || winter.day !== summer.day, {
    path: ['SUMMER_START_DATE'],
    message: 'must differ from WINTER_START_DATE'
  })
  .refine(env => !env.RULES_QUIZ_ENABLED || env.RULES_CHAT_ID, { path: ['RULES_CHAT_ID'], message: 'is required when RULES_QUIZ_ENABLED=true' })
  .transform(env => ({
    telegram: {
      token: env.TELEGRAM_BOT_TOKEN,
      teamChat: { chatId: env.TEAM_CHAT_ID, threadId: env.TEAM_CHAT_THREAD_ID },
      trainerChat: { chatId: env.TRAINER_CHAT_ID, threadId: env.TRAINER_CHAT_THREAD_ID },
      adminChatId: env.ADMIN_CHAT_ID,
      enableTrainerMessages: env.ENABLE_TRAINER_MESSAGES
    },
    mtproto: { apiId: env.TELEGRAM_API_ID, apiHash: env.TELEGRAM_API_HASH, session: env.TELEGRAM_SESSION },
    ollama: { enabled: env.OLLAMA_ENABLED, host: env.OLLAMA_HOST, model: env.OLLAMA_MODEL },
    attendance: { reminderHoursBefore: env.REMINDER_HOURS_BEFORE, cancelHoursBefore: env.CANCEL_HOURS_BEFORE },
    seasons: {
      winter: {
        startDate: env.WINTER_START_DATE,
        location: env.WINTER_LOCATION,
        practices: env.WINTER_PRACTICE_DAYS,
        minAttendance: env.WINTER_MIN_ATTENDANCE,
        keyRequestEnabled: env.WINTER_KEY_MESSAGE_ENABLED,
        throwingMinutesBefore: env.WINTER_THROWING_MINUTES_BEFORE
      },
      summer: {
        startDate: env.SUMMER_START_DATE,
        location: env.SUMMER_LOCATION,
        practices: env.SUMMER_PRACTICE_DAYS,
        minAttendance: env.SUMMER_MIN_ATTENDANCE,
        keyRequestEnabled: env.SUMMER_KEY_MESSAGE_ENABLED,
        throwingMinutesBefore: env.SUMMER_THROWING_MINUTES_BEFORE
      }
    },
    exceptionalTraining: { location: env.EXCEPTIONAL_LOCATION, time: env.EXCEPTIONAL_TIME, isCancelled: env.EXCEPTIONAL_CANCELLED },
    rulesQuiz: {
      enabled: env.RULES_QUIZ_ENABLED,
      chat: env.RULES_CHAT_ID === undefined ? undefined : { chatId: env.RULES_CHAT_ID, threadId: env.RULES_CHAT_THREAD_ID },
      answerDelayMinutes: env.RULES_ANSWER_DELAY_MINUTES,
      signalsEveryOther: env.RULES_SIGNALS_EVERY_OTHER
    }
  }))

export type BotConfig = z.output<typeof configSchema>

/** The config, or an error naming every invalid variable. Pure: the caller passes the environment. */
export function loadConfig(env: Record<string, string | undefined>): BotConfig {
  // Compose forwards an unset variable as an empty string: it means unset, so its default applies
  const set = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''))
  const result = configSchema.safeParse(set)
  if (result.success) return result.data
  const lines = result.error.issues.map(({ path: [name], message }) => `  • ${String(name)}: ${message}`)
  throw new Error(`Invalid configuration:\n${lines.join('\n')}`)
}
