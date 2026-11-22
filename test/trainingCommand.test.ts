import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { routeCommands } from '../src/commands/registry'
import { publicCommands } from '../src/commands/public'
import { AttendanceMonitor, LIVE_COUNT_TIMEOUT_MS } from '../src/training/attendance'
import { llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import { SeasonManager } from '../src/training/season'
import { EMOJIS } from '../src/shared/emojis'
import { countdown, getDayName } from '../src/shared/formatters'
import { makeFakeBot } from './fakes/bot'
import { makeFakeTrainingHistory, TRAINING_POST_ID } from './fakes/trainingHistory'
import { SUMMER_TRAINING, at, beforeTraining } from './fixtures/dates'
import { HOUR_MS, MINUTE_MS, advance, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

// A supergroup id, so the announcement gets a t.me link
const TEAM_CHAT_ID = '-1001234'
// A count no other figure of the reply contains
const ATTENDING = 55
const PLAYER = { chatId: 555 }
// The announcement goes out 24h before the training
const BEFORE_ANNOUNCEMENT = beforeTraining(30 * HOUR_MS)
const AFTER_ANNOUNCEMENT = beforeTraining(20 * HOUR_MS)
const WEEKDAY = getDayName(SUMMER_TRAINING.at.getDay())

const build = ({ env = {}, mtprotoUp = true, read }: { env?: Record<string, string>; mtprotoUp?: boolean; read?: () => Promise<number> } = {}) => {
  const config = testConfig({ TEAM_CHAT_ID, ...env })
  const bot = makeFakeBot()
  const seasonManager = new SeasonManager(config)
  const history = makeFakeTrainingHistory({ thumbsUp: ATTENDING })
  let historyReads = 0
  const countedHistory = { ...history, getThumbsUpCount: async () => { historyReads++; return await (read ?? history.getThumbsUpCount)() } }
  const attendance = new AttendanceMonitor(config, seasonManager, trainingMessages(llmWriter(config.ollama, null)), countedHistory, bot.api)
  routeCommands(bot, publicCommands({ teamChat: config.telegram.teamChat, seasonManager, attendance, mtprotoUp: () => mtprotoUp }), config.telegram.adminChatId)

  const training = async (): Promise<string> => {
    await bot.command('/training', PLAYER)
    return bot.sentTo(PLAYER.chatId).at(-1)?.text ?? ''
  }
  return { training, attendance, seasonManager, threshold: config.seasons.summer.minAttendance, historyReads: () => historyReads }
}

const minutesBeforeTraining = (minutes: number) => beforeTraining(minutes * MINUTE_MS)

afterEach(() => { mock.timers.reset() })

test('the countdown counts minutes under an hour, rounding up', () => {
  const left = countdown(SUMMER_TRAINING.at, minutesBeforeTraining(44.5))
  assert.ok(left.includes('45'))
  assert.equal(left.includes('h'), false)
})

test('the countdown counts hours and minutes under a day', () => {
  const left = countdown(SUMMER_TRAINING.at, minutesBeforeTraining(3 * 60 + 20))
  assert.ok(left.includes('3h'))
  assert.ok(left.includes('20'))
  assert.equal(countdown(SUMMER_TRAINING.at, minutesBeforeTraining(60)).includes('min'), false, 'whole hours show no minutes')
  assert.ok(countdown(SUMMER_TRAINING.at, minutesBeforeTraining(24 * 60 - 1)).includes('23h'))
})

test('from a day on, the countdown counts calendar days', () => {
  const tomorrow = countdown(SUMMER_TRAINING.at, minutesBeforeTraining(24 * 60))
  assert.equal(countdown(SUMMER_TRAINING.at, at(2027, 6, 8, 0, 1)), tomorrow, 'any time the day before, past a day ahead')
  // Mon 20:00 to Wed 19:30 is under 48h, yet two days
  const twoDays = countdown(SUMMER_TRAINING.at, at(2027, 6, 7, 20, 0))
  assert.notEqual(twoDays, tomorrow)
  assert.ok(twoDays.includes('2'))
  assert.ok(countdown(SUMMER_TRAINING.at, at(2027, 6, 2, 20, 0)).includes('7'))
})

test('once the training starts, the countdown says so and stops counting', () => {
  const started = countdown(SUMMER_TRAINING.at, SUMMER_TRAINING.at)
  assert.equal(countdown(SUMMER_TRAINING.at, new Date(SUMMER_TRAINING.at.getTime() + HOUR_MS)), started)
  assert.notEqual(countdown(SUMMER_TRAINING.at, minutesBeforeTraining(1)), started)
})

test('/training shows the weekday and the countdown', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training } = build()

  const reply = await training()

  assert.ok(reply.includes(WEEKDAY))
  assert.ok(reply.includes(countdown(SUMMER_TRAINING.at, AFTER_ANNOUNCEMENT)))
})

test('before the announcement, /training shows no count and reads no history', async () => {
  startAt(BEFORE_ANNOUNCEMENT)
  const { training, historyReads } = build()

  const reply = await training()

  assert.equal(reply.includes(String(ATTENDING)), false)
  assert.equal(historyReads(), 0)
})

test('after the announcement, /training shows the count, the players needed and a link to the announcement, without 👍', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training, threshold } = build()

  const reply = await training()

  assert.ok(reply.includes(String(ATTENDING)))
  assert.ok(reply.includes(String(threshold)))
  assert.ok(reply.includes(`t.me/c/1234/${TRAINING_POST_ID}`))
  assert.equal(reply.includes(EMOJIS.THUMBS_UP), false)
})

test('an announcement this process posted early is counted before the usual announcement time', async () => {
  startAt(BEFORE_ANNOUNCEMENT)
  const { training, attendance, seasonManager } = build()
  attendance.track(seasonManager.nextTraining(), TRAINING_POST_ID)

  const reply = await training()
  attendance.stop()

  assert.ok(reply.includes(String(ATTENDING)))
})

test('with MTProto down, /training still replies, without a count and without reading the history', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training, historyReads } = build({ mtprotoUp: false })

  const reply = await training()

  assert.ok(reply.includes(WEEKDAY))
  assert.equal(reply.includes(String(ATTENDING)), false)
  assert.equal(historyReads(), 0)
})

test('a failing history read leaves the count out of /training, the reply still goes out', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training } = build({ read: async () => { throw new Error('FLOOD_WAIT') } })

  const reply = await training()

  assert.ok(reply.includes(WEEKDAY))
  assert.equal(reply.includes(String(ATTENDING)), false)
})

test('a hanging history read holds /training for the read bound at most, then it replies without the count', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training } = build({ read: () => new Promise<number>(() => {}) })

  const pending = training()
  await advance(LIVE_COUNT_TIMEOUT_MS)
  const reply = await pending

  assert.ok(reply.includes(WEEKDAY))
  assert.equal(reply.includes(String(ATTENDING)), false)
})

test('two /training within a minute read the history once, a later one reads it again', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training, historyReads } = build()

  await training()
  await advance(MINUTE_MS - 1)
  assert.ok((await training()).includes(String(ATTENDING)), 'the cached count')
  assert.equal(historyReads(), 1)

  await advance(1)
  await training()
  assert.equal(historyReads(), 2)
})

test('a cancelled training shows as cancelled in /training, without a count or a history read', async () => {
  startAt(AFTER_ANNOUNCEMENT)
  const { training, historyReads } = build({ env: { EXCEPTIONAL_CANCELLED: 'true' } })

  const reply = await training()

  assert.ok(reply.includes(EMOJIS.CROSS_MARK))
  assert.equal(reply.includes(String(ATTENDING)), false)
  assert.equal(historyReads(), 0)
})
