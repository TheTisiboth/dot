import { test } from 'node:test'
import assert from 'node:assert/strict'
import { botConfigSchema } from '../src/config/schema'
import { parseDate, parsePracticeDays } from '../src/utils/configParsers'

const season = (startDate: string, practiceDays: string) => ({
  startDate: parseDate(startDate),
  location: 'Hall',
  practices: parsePracticeDays(practiceDays),
  minAttendance: 8,
  keyMessageEnabled: undefined,
  throwingMinutesBefore: 0
})

const valid = () => ({
  telegram: { token: 't', chatId: '-100', adminChatId: '-200', trainerChatId: '-300', enableTrainerMessages: undefined as string | undefined },
  mtproto: { apiId: '1', apiHash: 'hash', session: `1${'A'.repeat(60)}` },
  ollama: { enabled: undefined, host: 'http://localhost:11434', model: 'm' },
  attendance: { reminderHoursBefore: 3, cancelHoursBefore: 1 },
  seasons: { winter: season('9:15', '2:20:30,6:21:00'), summer: season('5:20', '0:19:00,3:19:30') },
  exceptionalTraining: { time: undefined as string | undefined, isCancelled: undefined as string | undefined },
  rulesQuiz: { enabled: undefined, answerDelayMinutes: 60, signalsEveryOther: undefined }
})

const parse = (tweak: (raw: ReturnType<typeof valid>) => void) => {
  const raw = valid()
  tweak(raw)
  return botConfigSchema.safeParse(raw)
}

test('a valid config parses, unset booleans take their defaults', () => {
  const result = parse(() => undefined)
  assert.ok(result.success)
  assert.equal(result.data.telegram.enableTrainerMessages, true)
  assert.equal(result.data.rulesQuiz.enabled, false)
})

test('a time that is not on the clock is rejected', () => {
  assert.equal(parse(raw => { raw.seasons.winter.practices = parsePracticeDays('2:99:99') }).success, false)
  assert.equal(parse(raw => { raw.seasons.winter.practices = parsePracticeDays('2:24:00') }).success, false)
  assert.equal(parse(raw => { raw.exceptionalTraining.time = '99:99' }).success, false)
  assert.ok(parse(raw => { raw.exceptionalTraining.time = '23:59' }).success)
})

test('a start date that does not exist every year is rejected', () => {
  assert.equal(parse(raw => { raw.seasons.winter.startDate = parseDate('2:31') }).success, false)
  assert.equal(parse(raw => { raw.seasons.winter.startDate = parseDate('2:29') }).success, false)
})

test('a season can have one practice, but not two on the same weekday', () => {
  assert.ok(parse(raw => { raw.seasons.winter.practices = parsePracticeDays('2:20:30') }).success)
  assert.equal(parse(raw => { raw.seasons.winter.practices = parsePracticeDays('2:18:00,2:20:30') }).success, false)
})

test('a boolean set to anything but true is false', () => {
  for (const value of ['false', 'False', '0', 'yes', 'TRUE']) {
    const result = parse(raw => { raw.telegram.enableTrainerMessages = value })
    assert.ok(result.success, value)
    assert.equal(result.data.telegram.enableTrainerMessages, false, value)
  }
  const cancelled = parse(raw => { raw.exceptionalTraining.isCancelled = 'true' })
  assert.ok(cancelled.success)
  assert.equal(cancelled.data.exceptionalTraining.isCancelled, true)
})
