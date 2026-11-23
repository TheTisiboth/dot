import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { routeCommands } from '../src/commands/registry'
import { statusCommand } from '../src/commands/status'
import { type Check } from '../src/health/server'
import { AttendanceMonitor } from '../src/training/attendance'
import { llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import { SeasonManager } from '../src/training/season'
import { RulesQuizService } from '../src/quiz/service'
import { answerTimeFor } from '../src/quiz/answer'
import { EMOJIS } from '../src/shared/emojis'
import { formatClock, formatDate } from '../src/shared/formatters'
import { makeFakeBot } from './fakes/bot'
import { type ChatHistory, makeFakeTrainingHistory } from './fakes/trainingHistory'
import { makeFakeQuizPublisher } from './fakes/rulesQuiz'
import { SUMMER_TRAINING, at, beforeTraining } from './fixtures/dates'
import { HOUR_MS, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

// A supergroup id, so the announcement gets a t.me link
const TEAM_CHAT_ID = '-1001234'
const POST_ID = 77
// A count no other figure of the reply contains
const ATTENDING = 55
// testConfig keeps the default attendance timing: reminder 3h, cancellation 1h before the training
const REMINDER_AT = formatClock(beforeTraining(3 * HOUR_MS))
const CANCELLATION_AT = formatClock(beforeTraining(HOUR_MS))

const build = ({ env = {}, history: chat = {} }: { env?: Record<string, string>; history?: Partial<ChatHistory> } = {}) => {
  const config = testConfig({ TEAM_CHAT_ID, ...env })
  const bot = makeFakeBot()
  const seasonManager = new SeasonManager(config)
  const history = makeFakeTrainingHistory({ thumbsUp: ATTENDING, ...chat })
  let historyReads = 0
  const countedHistory = { ...history, getThumbsUpCount: async () => { historyReads++; return await history.getThumbsUpCount() } }
  const attendance = new AttendanceMonitor(config, seasonManager, trainingMessages(llmWriter(config.ollama, null)), countedHistory, bot.api)
  const rulesQuiz = new RulesQuizService(config.rulesQuiz, makeFakeQuizPublisher(), seasonManager, { getAskedQuizzes: async () => [], getLatestQuiz: async () => undefined })
  const dependencies: Record<string, Check> = { telegram: { status: 'ok' }, mtproto: { status: 'ok' }, ollama: { status: 'disabled' } }
  routeCommands(bot, [statusCommand({ config, seasonManager, attendance, rulesQuiz, dependencies: async () => dependencies, startedAt: new Date(), version: '9.9.9' })], config.telegram.adminChatId)

  const admin = { chatId: Number(config.telegram.adminChatId) }
  const status = async (): Promise<string> => {
    await bot.command('/status', admin)
    const replies = bot.sentTo(admin.chatId)
    assert.equal(replies.length, 1)
    return replies[0].text
  }
  return { bot, seasonManager, attendance, rulesQuiz, dependencies, status, historyReads: () => historyReads }
}

afterEach(() => { mock.timers.reset() })

test('before the announcement is due, /status shows the next training and when the announcement goes out', async () => {
  startAt(beforeTraining(30 * HOUR_MS))
  const { status } = build({ history: { postId: undefined } })

  const reply = await status()

  assert.ok(reply.includes(formatDate(SUMMER_TRAINING.at)))
  assert.ok(reply.includes(testConfig().seasons.summer.location.name))
  assert.ok(reply.includes(formatDate(at(2027, 6, 8))), 'the day before the training')
  assert.equal(reply.includes('t.me'), false)
})

test('after the announcement, /status links it, counts the players and shows both checks armed', async () => {
  startAt(beforeTraining(20 * HOUR_MS))
  const { status, attendance, seasonManager } = build()
  attendance.track(seasonManager.nextTraining(), POST_ID)

  const reply = await status()

  assert.ok(reply.includes(`t.me/c/1234/${POST_ID}`))
  assert.ok(reply.includes(String(ATTENDING)))
  assert.ok(reply.includes(REMINDER_AT))
  assert.ok(reply.includes(CANCELLATION_AT))
})

test('for a cancelled training, /status flags it and arms no check', async () => {
  startAt(beforeTraining(20 * HOUR_MS))
  const { status, attendance } = build({ env: { EXCEPTIONAL_CANCELLED: 'true' } })
  attendance.armTimers()

  const reply = await status()

  assert.ok(reply.includes(EMOJIS.CROSS_MARK))
  assert.equal(reply.includes(REMINDER_AT), false)
  assert.equal(reply.includes(CANCELLATION_AT), false)
})

test('with a quiz answer pending, /status names the question and when its answer goes out', async () => {
  startAt(beforeTraining(20 * HOUR_MS))
  const { status, rulesQuiz } = build()
  const question = await rulesQuiz.postNext()

  const reply = await status()

  assert.ok(reply.includes(question.id))
  assert.ok(reply.includes(formatClock(answerTimeFor(new Date(), testConfig().rulesQuiz.answerDelayMinutes))))
})

test('with MTProto down, /status says so without reading the history, and still shows the rest', async () => {
  startAt(beforeTraining(20 * HOUR_MS))
  const { status, attendance, seasonManager, dependencies, rulesQuiz, historyReads } = build()
  attendance.track(seasonManager.nextTraining(), POST_ID)
  const question = await rulesQuiz.postNext()
  dependencies.mtproto = { status: 'down' }

  const reply = await status()

  assert.equal(historyReads(), 0)
  assert.ok(reply.includes(EMOJIS.CROSS_MARK), 'a dependency shown down')
  assert.ok(reply.includes(formatDate(SUMMER_TRAINING.at)))
  assert.ok(reply.includes(`t.me/c/1234/${POST_ID}`), 'the post this process knows')
  assert.ok(reply.includes(REMINDER_AT))
  assert.ok(reply.includes(question.id))
})

test('/status from another chat is ignored silently', async () => {
  startAt(beforeTraining(20 * HOUR_MS))
  const { bot } = build()

  await bot.command('/status', { chatId: 555 })

  assert.deepEqual(bot.sent, [])
})
