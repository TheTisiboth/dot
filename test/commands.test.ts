import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { formatTime } from '../src/shared/formatters'
import { type Command, publishCommandMenus, routeCommands } from '../src/commands/registry'
import { publicCommands } from '../src/commands/public'
import { quizCommands } from '../src/commands/quiz'
import { trainingCommands } from '../src/commands/training'
import { MessageGenerator } from '../src/training/messages/messageGenerator'
import { SchedulerService } from '../src/training/scheduler'
import { SeasonManager } from '../src/training/season'
import { EMOJIS } from '../src/shared/emojis'
import { formatDate } from '../src/shared/formatters'
import { makeFakeBot } from './fakes/bot'
import { makeFakeTrainingHistory, TRAINING_POST_ID } from './fakes/trainingHistory'
import { makeFakeRulesQuiz } from './fakes/rulesQuiz'
import { SUMMER_TRAINING, beforeTraining } from './fixtures/dates'
import { HOUR_MS, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

const config = testConfig()
const ADMIN = { chatId: Number(config.telegram.adminChatId) }
const PLAYER = { chatId: 555 }
const TEAM_CHAT = config.telegram.teamChat.chatId
// A count no other figure of the /attendance reply contains
const ATTENDING = 6
const ADMIN_COMMANDS = [
  '/test_template', '/test_llm', '/test_trainer', '/test_key', '/preview_team', '/preview_all',
  '/send_to_team', '/send_to_all', '/attendance', '/send_rule', '/answer_rule', '/test_rule'
]

const build = ({ failingChat, env }: { failingChat?: string; env?: Record<string, string> } = {}) => {
  const botConfig = testConfig(env)
  const bot = makeFakeBot({ failingChat })
  const quiz = makeFakeRulesQuiz()
  const seasonManager = new SeasonManager(botConfig)
  const messageGenerator = new MessageGenerator(botConfig, null)
  const scheduler = new SchedulerService(botConfig, seasonManager, messageGenerator, makeFakeTrainingHistory({ thumbsUp: ATTENDING }), bot.api, quiz)
  const commands: Command[] = [
    ...publicCommands(seasonManager),
    ...trainingCommands({ config: botConfig, api: bot.api, seasonManager, messageGenerator, scheduler }),
    ...quizCommands(quiz)
  ]
  routeCommands(bot, commands, botConfig.telegram.adminChatId)
  return { bot, quiz, commands }
}

afterEach(() => { mock.timers.reset() })

test('every admin command from another chat is ignored silently', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot, quiz } = build()

  for (const command of ADMIN_COMMANDS) await bot.command(command, PLAYER)

  assert.deepEqual(bot.sent, [])
  assert.deepEqual(quiz.calls, [])
  assert.deepEqual(quiz.previews, [])
})

test('an admin command from the admin chat runs', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  await bot.command('/send_to_team', ADMIN)

  assert.equal(bot.sentTo(TEAM_CHAT).length, 1)
})

test('admin commands are offered in the admin chat only', async () => {
  const { bot, commands } = build()

  await publishCommandMenus(bot.api, commands, config.telegram.adminChatId)

  const publicNames = bot.menus[0].commands.map(({ command }) => command)
  for (const command of ADMIN_COMMANDS) assert.equal(publicNames.includes(command.slice(1)), false)
})

test('/training shows the next training from the season config', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  await bot.command('/training', PLAYER)

  const [reply] = bot.sentTo(PLAYER.chatId)
  assert.ok(reply.text.includes(config.seasons.summer.location.name))
  assert.ok(reply.text.includes(formatTime(SUMMER_TRAINING.time)))
  assert.ok(reply.text.includes(formatDate(SUMMER_TRAINING.at)))
})

test('/training shows the throwing time when the season has one', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ env: { SUMMER_THROWING_MINUTES_BEFORE: '15' } })

  await bot.command('/training', PLAYER)

  assert.ok(bot.sentTo(PLAYER.chatId)[0].text.includes('19:15'))
})

test('/training shows the moved place and time of an exceptional training', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ env: { EXCEPTIONAL_LOCATION: 'Beach', EXCEPTIONAL_TIME: '20:15' } })

  await bot.command('/training', PLAYER)

  const [reply] = bot.sentTo(PLAYER.chatId)
  assert.ok(reply.text.includes('Beach'))
  assert.ok(reply.text.includes('20:15'))
})

test('/training says when the next training is cancelled', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const regularBot = build().bot
  const cancelledBot = build({ env: { EXCEPTIONAL_CANCELLED: 'true' } }).bot
  await regularBot.command('/training', PLAYER)
  await cancelledBot.command('/training', PLAYER)

  const [regular] = regularBot.sentTo(PLAYER.chatId)
  const [cancelled] = cancelledBot.sentTo(PLAYER.chatId)
  assert.equal(regular.text.includes(EMOJIS.CROSS_MARK), false)
  assert.ok(cancelled.text.includes(EMOJIS.CROSS_MARK))
})

test('/info lists both seasons with their locations and practice times', async () => {
  const { bot } = build()

  await bot.command('/info', PLAYER)

  const [reply] = bot.sentTo(PLAYER.chatId)
  for (const season of [config.seasons.winter, config.seasons.summer]) {
    assert.ok(reply.text.includes(season.location.name))
    for (const { time } of season.practices) assert.ok(reply.text.includes(formatTime(time)))
  }
})

test('a command typed in a forum topic is answered in that topic', async () => {
  const { bot } = build()

  await bot.command('/help', { ...PLAYER, topicId: 9 })

  assert.equal(bot.sentTo(PLAYER.chatId)[0].options.message_thread_id, 9)
})

test('/attendance reports the live count against the threshold', async () => {
  startAt(beforeTraining(4 * HOUR_MS))
  const { bot } = build()

  await bot.command('/attendance', ADMIN)

  const [reply] = bot.sentTo(ADMIN.chatId)
  assert.ok(reply.text.includes(String(ATTENDING)))
  assert.ok(reply.text.includes(String(config.seasons.summer.minAttendance)))
  assert.ok(reply.text.includes(String(TRAINING_POST_ID)))
})

test('/send_to_all posts the scheduled announcement and the quiz', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot, quiz } = build()

  await bot.command('/send_to_all', ADMIN)

  assert.ok(bot.sentTo(TEAM_CHAT).length > 0)
  assert.ok(bot.sentTo(config.telegram.trainerChat.chatId).length > 0)
  assert.deepEqual(quiz.calls, ['sendScheduled'])
})

test('/send_to_all reports a failed announcement instead of success', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ failingChat: TEAM_CHAT })

  await bot.command('/send_to_all', ADMIN)

  const report = bot.sentTo(ADMIN.chatId).at(-1)
  assert.ok(report?.text.includes('Telegram is down'))
  assert.equal(report?.text.startsWith(EMOJIS.CHECK_MARK), false)
})

test('/test_rule previews the named question in the admin chat', async () => {
  const { bot, quiz } = build()

  await bot.command('/test_rule sig_01', ADMIN)

  assert.deepEqual(quiz.previews.map(({ target, question }) => [target.chatId, question.id]), [[String(ADMIN.chatId), 'sig_01']])
})

test('/test_rule with an unknown id previews nothing', async () => {
  const { bot, quiz } = build()

  await bot.command('/test_rule nope', ADMIN)

  assert.deepEqual(quiz.previews, [])
  assert.equal(bot.sentTo(ADMIN.chatId).length, 1)
})

test('/test_rule without an id previews the next pick', async () => {
  const { bot, quiz } = build()

  await bot.command('/test_rule', ADMIN)

  assert.deepEqual(quiz.calls, ['pickNext'])
  assert.equal(quiz.previews.length, 1)
})

test('/send_rule and /answer_rule drive the quiz', async () => {
  const { bot, quiz } = build()

  await bot.command('/send_rule', ADMIN)
  await bot.command('/answer_rule', ADMIN)

  assert.deepEqual(quiz.calls, ['postNext', 'answerLatest'])
})

test('a failing quiz action is reported back to the admin', async () => {
  const { bot, quiz } = build()
  const down = async () => { throw new Error('MTProto down') }
  Object.assign(quiz, { postNext: down, answerLatest: down, pickNext: down })

  for (const command of ['/send_rule', '/answer_rule', '/test_rule']) await bot.command(command, ADMIN)

  assert.equal(bot.sentTo(ADMIN.chatId).filter(({ text }) => text.includes('MTProto down')).length, 3)
})

test('/start greets in any chat', async () => {
  const { bot } = build()

  await bot.command('/start', PLAYER)

  assert.equal(bot.sentTo(PLAYER.chatId).length, 1)
})

test('the previews stay in the admin chat', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  for (const command of ['/test_template', '/test_llm', '/test_trainer', '/test_key', '/preview_team', '/preview_all']) {
    await bot.command(command, ADMIN)
  }

  assert.equal(bot.sentTo(ADMIN.chatId).length, bot.sent.length)
  assert.ok(bot.sent.length >= 6)
})
