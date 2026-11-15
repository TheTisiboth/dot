import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { PollingGuard } from '../src/services/PollingGuard'
import { makeFakeBot } from './fakes/bot'
import { startAt } from './helpers/clock'

const SECOND_MS = 1000
// A getUpdates long poll holds for 10s: past 15s without an error, polling counts as recovered
const RECOVERY_WINDOW_MS = 15 * SECOND_MS

const outage = () => new Error('ETELEGRAM: 502 Bad Gateway')
const rateLimit = (retryAfterSeconds: number) =>
  Object.assign(new Error('ETELEGRAM: 429 Too Many Requests'), { response: { body: { parameters: { retry_after: retryAfterSeconds } } } })

const build = () => {
  startAt(new Date(2027, 0, 1))
  const bot = makeFakeBot()
  return { bot, guard: new PollingGuard(bot) }
}

/** Ticks until polling restarts once more, returning how long that took. */
const restartDelay = (bot: ReturnType<typeof makeFakeBot>) => {
  const starts = bot.pollingStarts
  let waited = 0
  while (bot.pollingStarts === starts && waited < 120 * SECOND_MS) {
    mock.timers.tick(SECOND_MS)
    waited += SECOND_MS
  }
  return waited
}

afterEach(() => { mock.timers.reset() })

test('a polling error stops polling and restarts it after a second', () => {
  const { bot } = build()

  bot.failPolling(outage())

  assert.equal(bot.pollingStops, 1)
  assert.equal(restartDelay(bot), SECOND_MS)
})

test('consecutive errors double the backoff up to a minute', () => {
  const { bot } = build()
  const delays: number[] = []

  for (let attempt = 0; attempt < 8; attempt++) {
    bot.failPolling(outage())
    delays.push(restartDelay(bot) / SECOND_MS)
  }

  assert.deepEqual(delays, [1, 2, 4, 8, 16, 32, 60, 60])
})

test('a rate limit waits the time Telegram asks for', () => {
  const { bot } = build()

  bot.failPolling(rateLimit(7))

  assert.equal(restartDelay(bot), 7 * SECOND_MS)
})

test('a quiet window after a restart resets the backoff', () => {
  const { bot } = build()
  bot.failPolling(outage())
  restartDelay(bot)
  bot.failPolling(outage())
  restartDelay(bot)

  mock.timers.tick(RECOVERY_WINDOW_MS)
  bot.failPolling(outage())

  assert.equal(restartDelay(bot), SECOND_MS)
})

test('a stopped guard never restarts polling', () => {
  const { bot, guard } = build()
  bot.failPolling(outage())

  guard.stop()
  bot.failPolling(outage())
  mock.timers.tick(120 * SECOND_MS)

  assert.equal(bot.pollingStarts, 0)
  assert.equal(bot.pollingStops, 1)
})
