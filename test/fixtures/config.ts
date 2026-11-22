import { loadConfig } from '../../src/config/env'

// The whole environment of a test: neither .env nor the shell reach it
const TEST_ENV = {
  TELEGRAM_BOT_TOKEN: '1000:test-token',
  CHAT_ID: '-100',
  ADMIN_CHAT_ID: '-200',
  TRAINER_CHAT_ID: '-300',
  TELEGRAM_API_ID: '1',
  TELEGRAM_API_HASH: 'hash',
  TELEGRAM_SESSION: `1${'A'.repeat(60)}`,
  WINTER_START_DATE: '9:15',
  WINTER_LOCATION: 'Hall',
  WINTER_PRACTICE_DAYS: '2:20:30,6:21:00',
  SUMMER_START_DATE: '5:20',
  SUMMER_LOCATION: 'Park',
  SUMMER_PRACTICE_DAYS: '0:19:00,3:19:30',
  EXCEPTIONAL_CANCELLED: 'false',
  RULES_QUIZ_ENABLED: 'true',
  RULES_CHAT_ID: '-400',
  RULES_CHAT_THREAD_ID: '7'
}

/** A fresh config from the test environment, `env` overriding some of its variables. */
export const testConfig = (env: Record<string, string> = {}) => loadConfig({ ...TEST_ENV, ...env })
