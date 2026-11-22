import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type { Api } from 'grammy'
import { MessageGenerator } from '../src/services/MessageGenerator'
import { type ReactionReader } from '../src/services/ReactionReader'
import { PART_NAMES, SchedulerService } from '../src/services/SchedulerService'
import { SeasonManager } from '../src/services/SeasonManager'
import { CANCELLATION_SIGNATURE, EMOJIS, isKeyRequest } from '../src/utils/constants'
import { makeFakeBot } from './fakes/bot'
import { makeFakeReader, TRAINING_POST_ID, type ChatHistory } from './fakes/reactionReader'
import { makeFakeRulesQuiz } from './fakes/rulesQuiz'
import { beforeTraining } from './fixtures/dates'
import { HOUR_MS, MINUTE_MS, advance, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

// testConfig keeps the default attendance timing: reminder 3h, cancellation 1h before the training
const config = testConfig()
const TEAM_CHAT = config.telegram.teamChat.chatId
const TRAINER_CHAT = config.telegram.trainerChat.chatId
const ADMIN_CHAT = config.telegram.adminChatId
const RETRY_DELAY_MS = 10 * MINUTE_MS
const THRESHOLD = config.seasons.summer.minAttendance

const schedulerFor = (bot: Api, reader: ReactionReader, quiz = makeFakeRulesQuiz(), botConfig = config) =>
  new SchedulerService(botConfig, new SeasonManager(botConfig), new MessageGenerator(botConfig, null), reader, bot, quiz)

const build = ({ failingChat, history, env }: { failingChat?: string; history?: Partial<ChatHistory>; env?: Record<string, string> } = {}) => {
  const bot = makeFakeBot({ failingChat })
  const reader = makeFakeReader(history)
  const quiz = makeFakeRulesQuiz()
  return { scheduler: schedulerFor(bot.api, reader, quiz, testConfig(env)), bot, reader, quiz }
}

afterEach(() => { mock.timers.reset() })

test('the cron tick the day before posts the announcement, key and trainer requests, then the quiz', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot, quiz } = build()
  scheduler.setupScheduler()

  await advance(30_000)

  const [announcement, key, ...rest] = bot.sentTo(TEAM_CHAT)
  assert.equal(rest.length, 0)
  assert.ok(announcement.text.includes(EMOJIS.THUMBS_UP))
  assert.equal(isKeyRequest(announcement.text), false)
  assert.ok(isKeyRequest(key.text))
  assert.equal(bot.sentTo(TRAINER_CHAT).length, 1)
  assert.ok(bot.sentTo(TRAINER_CHAT)[0].text.includes(EMOJIS.THUMBS_UP))
  assert.deepEqual(quiz.calls, ['armAnswer', 'sendScheduled'])
})

test('a cron tick with no training tomorrow posts nothing', async () => {
  startAt(beforeTraining(48 * HOUR_MS + 30_000))
  const { scheduler, bot, quiz } = build()
  scheduler.setupScheduler()

  await advance(30_000)

  assert.equal(bot.sent.length, 0)
  assert.deepEqual(quiz.calls, ['armAnswer'])
})

test('the key request is skipped when the season disables it', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, bot } = build({ env: { SUMMER_KEY_MESSAGE_ENABLED: 'false' } })

  await scheduler.announceTraining()

  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)
  assert.equal(bot.sent.some(message => isKeyRequest(message.text)), false)
})

test('the trainer request is skipped when trainer messages are disabled', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, bot } = build({ env: { ENABLE_TRAINER_MESSAGES: 'false' } })

  await scheduler.announceTraining()

  assert.equal(bot.sentTo(TRAINER_CHAT).length, 0)
  assert.equal(bot.sentTo(TEAM_CHAT).length, 2)
})

test('the quiz goes out even when the announcement fails', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, quiz } = build({ failingChat: TEAM_CHAT })

  await scheduler.announceTraining()

  assert.deepEqual(quiz.calls, ['sendScheduled'])
})

test('a failed scheduled announcement is retried once, then one admin alert names it and the error', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot } = build({ failingChat: TEAM_CHAT })
  scheduler.setupScheduler()

  await advance(30_000)
  assert.equal(bot.sentTo(ADMIN_CHAT).length, 0)
  await advance(RETRY_DELAY_MS)
  await advance(HOUR_MS)

  const [alert, ...rest] = bot.sentTo(ADMIN_CHAT)
  assert.equal(rest.length, 0)
  assert.ok(alert.text.includes(PART_NAMES.announcement))
  assert.ok(alert.text.includes('Telegram is down'))
  assert.equal(bot.sentTo(TRAINER_CHAT).length, 0)
})

test('a scheduled announcement that succeeds on retry posts every message and alerts nobody', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot, quiz } = build({ failingChat: TEAM_CHAT })
  scheduler.setupScheduler()

  await advance(30_000)
  bot.failingChat = undefined
  await advance(RETRY_DELAY_MS)

  assert.equal(bot.sentTo(TEAM_CHAT).length, 2)
  assert.equal(bot.sentTo(TRAINER_CHAT).length, 1)
  assert.equal(bot.sentTo(ADMIN_CHAT).length, 0)
  assert.deepEqual(quiz.calls, ['armAnswer', 'sendScheduled'])
})

test('a failed trainer request alerts about it alone, and the attendance check is still armed', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot } = build({ failingChat: TRAINER_CHAT, history: { postId: undefined, thumbsUp: 1 } })
  scheduler.setupScheduler()

  await advance(30_000)

  const [alert, ...rest] = bot.sentTo(ADMIN_CHAT)
  assert.equal(rest.length, 0)
  assert.ok(alert.text.includes(PART_NAMES.trainerRequest))
  for (const other of [PART_NAMES.announcement, PART_NAMES.keyRequest, PART_NAMES.quiz]) assert.equal(alert.text.includes(other), false)

  const [announcement] = bot.sentTo(TEAM_CHAT)
  await advance(21 * HOUR_MS)
  assert.ok(bot.sentTo(TEAM_CHAT).some(message => message.options.reply_to_message_id === announcement.messageId))
})

test('an announcement Telegram cannot parse is sent again as the template', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, bot } = build()
  bot.rejectNextParse = true

  const report = await scheduler.announceTraining()

  const [announcement] = bot.sentTo(TEAM_CHAT)
  assert.equal(report.announcement.status, 'sent')
  assert.equal(announcement.text, new MessageGenerator(config, null).announcementTemplate(new SeasonManager(config).nextTraining()))
  assert.equal(announcement.options.parse_mode, 'HTML')
})

test('the announcement arms the attendance check on the post it just sent', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, bot } = build({ history: { postId: undefined, thumbsUp: 1 } })
  await scheduler.announceTraining()
  const [announcement] = bot.sentTo(TEAM_CHAT)
  const before = bot.sent.length

  await advance(21 * HOUR_MS)

  const [reminder, ...rest] = bot.sent.slice(before)
  assert.equal(rest.length, 0)
  assert.equal(reminder.options.reply_to_message_id, announcement.messageId)
})

test('below the threshold at reminder time, one reminder replies to the post', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ history: { thumbsUp: THRESHOLD - 1 } })
  scheduler.armAttendanceTimers()

  await advance(HOUR_MS - 1)
  assert.equal(bot.sent.length, 0)
  await advance(1)

  assert.equal(bot.sent.length, 1)
  assert.equal(bot.sent[0].chatId, TEAM_CHAT)
  assert.equal(bot.sent[0].options.reply_to_message_id, TRAINING_POST_ID)
})

test('at the threshold, neither reminder nor cancellation is sent', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ history: { thumbsUp: THRESHOLD } })
  scheduler.armAttendanceTimers()

  await advance(4 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('the threshold comes from the season of the training', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ history: { thumbsUp: 2 }, env: { SUMMER_MIN_ATTENDANCE: '2' } })
  scheduler.armAttendanceTimers()

  await advance(4 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('a reminder already in the chat is not sent again', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ history: { reminder: true } })
  scheduler.armAttendanceTimers()

  await advance(2 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('below the threshold at cancellation time, one notice goes to the trainer chat only', async () => {
  startAt(beforeTraining(2 * HOUR_MS))
  const { scheduler, bot } = build({ history: { reminder: true } })
  scheduler.armAttendanceTimers()

  await advance(2 * HOUR_MS)

  assert.equal(bot.sent.length, 1)
  assert.equal(bot.sent[0].chatId, TRAINER_CHAT)
  assert.ok(bot.sent[0].text.includes(CANCELLATION_SIGNATURE))
})

test('a cancellation already in the trainer chat is not sent again', async () => {
  startAt(beforeTraining(2 * HOUR_MS))
  const { scheduler, bot } = build({ history: { reminder: true, cancellation: true } })
  scheduler.armAttendanceTimers()

  await advance(2 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('no cancellation is sent when trainer messages are disabled', async () => {
  startAt(beforeTraining(2 * HOUR_MS))
  const { scheduler, bot } = build({ history: { reminder: true }, env: { ENABLE_TRAINER_MESSAGES: 'false' } })
  scheduler.armAttendanceTimers()

  await advance(2 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('a missing training post never sends a reminder or a cancellation', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ history: { postId: undefined } })
  scheduler.armAttendanceTimers()

  await advance(4 * HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

test('a restart after the reminder time catches the reminder up once', async () => {
  startAt(beforeTraining(2 * HOUR_MS))
  const { scheduler, bot, reader } = build()
  scheduler.armAttendanceTimers()
  await advance(0)
  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)

  reader.chat.reminder = true
  schedulerFor(bot.api, reader).armAttendanceTimers()
  await advance(30 * MINUTE_MS)

  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)
})

test('a restart after both boundaries catches each up once', async () => {
  startAt(beforeTraining(30 * MINUTE_MS))
  const { scheduler, bot, reader } = build()
  scheduler.armAttendanceTimers()
  await advance(0)
  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)
  assert.equal(bot.sentTo(TRAINER_CHAT).length, 1)

  Object.assign(reader.chat, { reminder: true, cancellation: true })
  schedulerFor(bot.api, reader).armAttendanceTimers()
  await advance(20 * MINUTE_MS)

  assert.equal(bot.sent.length, 2)
})

test('re-arming replaces the pending checks instead of adding to them', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build()
  scheduler.armAttendanceTimers()
  scheduler.armAttendanceTimers()

  await advance(HOUR_MS)

  assert.equal(bot.sent.length, 1)
})

test('a training moved earlier that already started arms no check', async () => {
  // The next practice is still today's 19:30 one, but EXCEPTIONAL_TIME moved it to 18:00
  startAt(beforeTraining(HOUR_MS))
  const { scheduler, bot } = build({ env: { EXCEPTIONAL_TIME: '18:00' } })
  scheduler.armAttendanceTimers()

  await advance(HOUR_MS)

  assert.equal(bot.sent.length, 0)
})

const MOVED = { EXCEPTIONAL_LOCATION: 'Beach', EXCEPTIONAL_TIME: '20:15' }

test('a moved training is announced to team and trainers with its new place and time', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot } = build({ env: MOVED })
  scheduler.setupScheduler()

  await advance(30_000)

  const [announcement] = bot.sentTo(TEAM_CHAT)
  assert.ok(announcement.text.includes('Beach'))
  assert.ok(announcement.text.includes('20:15'))
  assert.ok(bot.sentTo(TRAINER_CHAT)[0].text.includes('20:15'))
})

test('the checks of a moved training fire relative to its new start and quote it', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler, bot } = build({ env: MOVED })
  scheduler.armAttendanceTimers()

  // Regular 19:30 start: reminder due in 1h; moved to 20:15: in 1h45
  await advance(HOUR_MS)
  assert.equal(bot.sent.length, 0)
  await advance(45 * MINUTE_MS)
  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)
  assert.ok(bot.sentTo(TEAM_CHAT)[0].text.includes('20:15'))

  await advance(2 * HOUR_MS)
  const [cancellation] = bot.sentTo(TRAINER_CHAT)
  assert.ok(cancellation.text.includes(CANCELLATION_SIGNATURE))
  assert.ok(cancellation.text.includes('Beach'))
  assert.ok(cancellation.text.includes('20:15'))
})

test('a cancelled training sends nothing to team or trainers, but the quiz still goes out', async () => {
  startAt(beforeTraining(24 * HOUR_MS + 30_000))
  const { scheduler, bot, quiz } = build({ env: { EXCEPTIONAL_CANCELLED: 'true' } })
  scheduler.setupScheduler()

  await advance(30_000)
  await advance(24 * HOUR_MS)

  assert.deepEqual(bot.sent, [])
  assert.deepEqual(quiz.calls, ['armAnswer', 'sendScheduled'])
})

test('the attendance inspection reports count, threshold and post', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { scheduler } = build({ history: { thumbsUp: 5 } })

  const attendance = await scheduler.inspectAttendance()

  assert.equal(attendance?.count, 5)
  assert.equal(attendance?.threshold, THRESHOLD)
  assert.equal(attendance?.announcementId, TRAINING_POST_ID)
})

test('once the training started, the inspection finds no post until the next announcement', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { scheduler, bot } = build({ history: { postId: undefined } })
  await scheduler.announceTraining()
  assert.equal((await scheduler.inspectAttendance())?.announcementId, bot.sentTo(TEAM_CHAT)[0].messageId)

  await advance(25 * HOUR_MS)
  assert.equal(await scheduler.inspectAttendance(), null)

  await scheduler.announceTraining()
  assert.equal((await scheduler.inspectAttendance())?.announcementId, bot.sentTo(TEAM_CHAT).at(-2)?.messageId)
})
