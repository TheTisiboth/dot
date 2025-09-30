import dotenv from 'dotenv'
import { type BotConfig } from '../types'
import { parseDate, parsePracticeDays } from '../utils/configParsers'

dotenv.config()

export const config: BotConfig = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    ...(process.env.CHAT_ID && { chatId: process.env.CHAT_ID }),
    ...(process.env.ADMIN_CHAT_ID && { adminChatId: process.env.ADMIN_CHAT_ID }),
  },

  ollama: {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  },

  seasons: {
    winter: {
      startDate: parseDate(process.env.WINTER_START_DATE || '', 9, 15),
      location: (process.env.WINTER_LOCATION || 'Park Arena').trim(),
      practices: parsePracticeDays(
        process.env.WINTER_PRACTICE_DAYS || '',
        [
          { day: 2, time: '20:30' },
          { day: 6, time: '20:30' }
        ]
      )
    },
    summer: {
      startDate: parseDate(process.env.SUMMER_START_DATE || '', 5, 20),
      location: (process.env.SUMMER_LOCATION || 'Beach Courts').trim(),
      practices: parsePracticeDays(
        process.env.SUMMER_PRACTICE_DAYS || '',
        [
          { day: 0, time: '19:00' },
          { day: 3, time: '19:00' }
        ]
      )
    }
  },

  testing: {
    enabled: process.env.TEST_MODE === 'true',
    ...(process.env.OVERRIDE_DATE && { overrideDate: process.env.OVERRIDE_DATE }),
  }
}

export const validateConfig = (): void => {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required')
  }

  if (!config.telegram.chatId && !config.testing.enabled) {
    console.warn('⚠️  CHAT_ID not set - bot will work for testing but won\'t send scheduled messages')
  }
}