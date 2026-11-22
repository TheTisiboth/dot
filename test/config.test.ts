import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from '../src/config/env'

const VALID = {
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
  SUMMER_PRACTICE_DAYS: '0:19:00,3:19:30'
}

const load = (overrides: Record<string, string | undefined> = {}) => loadConfig({ ...VALID, ...overrides })

/** The error message, which must name the variable at fault. */
const failureOf = (overrides: Record<string, string | undefined>): string => {
  try {
    load(overrides)
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  assert.fail(`accepted ${JSON.stringify(overrides)}`)
}

test('a valid environment loads into typed values', () => {
  const config = load({ CHAT_THREAD_ID: '5', EXCEPTIONAL_TIME: '18:05', WINTER_LOCATION: '[Hall](https://maps.example/hall)' })

  assert.deepEqual(config.telegram.teamChat, { chatId: '-100', threadId: 5 })
  assert.deepEqual(config.seasons.winter.practices[0], { day: 2, time: { hour: 20, minute: 30 } })
  assert.deepEqual(config.seasons.winter.startDate, { month: 9, day: 15 })
  assert.deepEqual(config.seasons.winter.location, { name: 'Hall', url: 'https://maps.example/hall' })
  assert.deepEqual(config.exceptionalTraining.time, { hour: 18, minute: 5 })
  assert.equal(config.rulesQuiz.chat, undefined)
})

test('unset or empty variables take their defaults', () => {
  for (const value of [undefined, '']) {
    const config = load({ REMINDER_HOURS_BEFORE: value, ENABLE_TRAINER_MESSAGES: value, OLLAMA_MODEL: value })
    assert.equal(config.attendance.reminderHoursBefore, 3)
    assert.equal(config.telegram.enableTrainerMessages, true)
    assert.equal(config.ollama.enabled, false)
    assert.ok(config.ollama.model.length > 0)
  }
})

test('each invalid value is reported with its exact variable name', () => {
  const cases: Array<[string, Record<string, string | undefined>]> = [
    ['CHAT_ID', { CHAT_ID: undefined }],
    ['CHAT_THREAD_ID', { CHAT_THREAD_ID: 'general' }],
    ['OLLAMA_HOST', { OLLAMA_HOST: 'not a url' }],
    ['TELEGRAM_API_ID', { TELEGRAM_API_ID: 'abc' }],
    ['TELEGRAM_SESSION', { TELEGRAM_SESSION: '2abc' }],
    ['REMINDER_HOURS_BEFORE', { REMINDER_HOURS_BEFORE: 'three' }],
    ['CANCEL_HOURS_BEFORE', { CANCEL_HOURS_BEFORE: '5' }],
    ['WINTER_START_DATE', { WINTER_START_DATE: '2:31' }],
    ['SUMMER_START_DATE', { SUMMER_START_DATE: '9:15' }],
    ['SUMMER_LOCATION', { SUMMER_LOCATION: '  ' }],
    ['WINTER_LOCATION', { WINTER_LOCATION: '[Hall](not a url)' }],
    ['WINTER_PRACTICE_DAYS', { WINTER_PRACTICE_DAYS: '2:99:99' }],
    ['SUMMER_PRACTICE_DAYS', { SUMMER_PRACTICE_DAYS: '0:18:00,0:19:00' }],
    ['WINTER_MIN_ATTENDANCE', { WINTER_MIN_ATTENDANCE: '0' }],
    ['SUMMER_THROWING_MINUTES_BEFORE', { SUMMER_THROWING_MINUTES_BEFORE: '-5' }],
    ['EXCEPTIONAL_TIME', { EXCEPTIONAL_TIME: '99:99' }],
    ['RULES_CHAT_ID', { RULES_QUIZ_ENABLED: 'true' }],
    ['RULES_CHAT_ID', { RULES_CHAT_ID: '12345' }],
    ['RULES_ANSWER_DELAY_MINUTES', { RULES_ANSWER_DELAY_MINUTES: '1.5' }]
  ]
  for (const [name, overrides] of cases) {
    assert.match(failureOf(overrides), new RegExp(`\\b${name}:`), name)
  }
})

test('a time off the clock and a date that does not exist every year are rejected', () => {
  for (const time of ['99:99', '24:00', '12:60']) failureOf({ EXCEPTIONAL_TIME: time })
  for (const date of ['2:31', '2:29', '13:1', '4:31']) failureOf({ WINTER_START_DATE: date })
})

test('a boolean set to anything but true is false', () => {
  for (const value of ['false', 'False', '0', 'yes', 'TRUE']) {
    assert.equal(load({ ENABLE_TRAINER_MESSAGES: value }).telegram.enableTrainerMessages, false, value)
  }
  assert.equal(load({ OLLAMA_ENABLED: 'true' }).ollama.enabled, true)
})

test('a season can have a single practice', () => {
  assert.equal(load({ WINTER_PRACTICE_DAYS: '2:20:30' }).seasons.winter.practices.length, 1)
})

test('every invalid variable is reported at once', () => {
  const message = failureOf({ CHAT_ID: undefined, EXCEPTIONAL_TIME: '99:99' })
  assert.match(message, /CHAT_ID:/)
  assert.match(message, /EXCEPTIONAL_TIME:/)
})
