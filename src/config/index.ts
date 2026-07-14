import dotenv from 'dotenv'
import {type BotConfig} from '../types'
import {botConfigSchema} from './schema'
import {ZodError} from 'zod'
import {parseDate, parsePracticeDays} from '../utils/configParsers'

dotenv.config()

function loadAndValidateConfig(): BotConfig {
    const rawConfig = {
        telegram: {
            token: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.CHAT_ID,
            chatThreadId: process.env.CHAT_THREAD_ID,
            adminChatId: process.env.ADMIN_CHAT_ID,
            trainerChatId: process.env.TRAINER_CHAT_ID,
            trainerChatThreadId: process.env.TRAINER_CHAT_THREAD_ID,
            enableTrainerMessages: process.env.ENABLE_TRAINER_MESSAGES !== 'false',
        },

        mtproto: {
            apiId: process.env.TELEGRAM_API_ID,
            apiHash: process.env.TELEGRAM_API_HASH,
            session: process.env.TELEGRAM_SESSION,
        },

        ollama: {
            enabled: process.env.OLLAMA_ENABLED === 'true',
            host: process.env.OLLAMA_HOST || 'http://localhost:11434',
            model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
        },

        attendance: {
            reminderHoursBefore: Number(process.env.REMINDER_HOURS_BEFORE ?? 3),
            cancelHoursBefore: Number(process.env.CANCEL_HOURS_BEFORE ?? 1),
        },

        seasons: {
            winter: {
                startDate: parseDate(process.env.WINTER_START_DATE),
                location: process.env.WINTER_LOCATION,
                practices: parsePracticeDays(process.env.WINTER_PRACTICE_DAYS),
                minAttendance: Number(process.env.WINTER_MIN_ATTENDANCE ?? 8)
            },
            summer: {
                startDate: parseDate(process.env.SUMMER_START_DATE),
                location: process.env.SUMMER_LOCATION,
                practices: parsePracticeDays(process.env.SUMMER_PRACTICE_DAYS),
                minAttendance: Number(process.env.SUMMER_MIN_ATTENDANCE ?? 8)
            }
        },

        testing: {
            enabled: process.env.TEST_MODE === 'true',
            overrideDate: process.env.OVERRIDE_DATE,
        },

        exceptionalTraining: {
            location: process.env.EXCEPTIONAL_LOCATION || undefined,
            time: process.env.EXCEPTIONAL_TIME || undefined,
            isCancelled: process.env.EXCEPTIONAL_CANCELLED === 'true' || undefined
        }
    }

    try {
        return botConfigSchema.parse(rawConfig)
    } catch (error) {
        if (error instanceof ZodError) {
            console.error('❌ Configuration validation failed:\n')
            error.issues.forEach(issue => {
                console.error(`  • ${issue.path.join('.')}: ${issue.message}`)
            })
            console.error('\nPlease check your .env file and ensure all required fields are properly set.')
            process.exit(1)
        }
        throw error
    }
}

export const config: BotConfig = loadAndValidateConfig()