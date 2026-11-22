import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { formatTime } from '../src/shared/formatters'
import { type Command, publishCommandMenus, routeCommands } from '../src/commands/registry'
import { publicCommands } from '../src/commands/public'
import { quizCommands } from '../src/commands/quiz'
import { trainingCommands } from '../src/commands/training'
import { type LlmClient, llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import { AttendanceMonitor } from '../src/training/attendance'
import { announcer } from '../src/training/announcer'
import { SeasonManager } from '../src/training/season'
import { EMOJIS } from '../src/shared/emojis'
import { MARKERS } from '../src/training/markers'
import { formatDate } from '../src/shared/formatters'
import { makeFakeBot } from './fakes/bot'
import { makeFakeTrainingHistory, TRAINING_POST_ID } from './fakes/trainingHistory'
import { makeFakeQuizPublisher, makeFakeRulesQuiz } from './fakes/rulesQuiz'
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
  '/preview', '/send_to_team', '/send_to_all', '/attendance', '/quiz_post', '/quiz_answer', '/quiz_preview', '/quiz_stats'
]
const LLM_TEXT = 'Written by the LLM'
// The library boundary: the fake implements only the Ollama method the writer calls
const fakeLlm = { chat: async () => ({ message: { content: LLM_TEXT } }) } as unknown as LlmClient

const build = ({ failingChat, env, llm = null }: { failingChat?: string; env?: Record<string, string>; llm?: LlmClient | null } = {}) => {
  const botConfig = testConfig(env)
  const bot = makeFakeBot({ failingChat })
  const quiz = makeFakeRulesQuiz()
  const publisher = makeFakeQuizPublisher()
  const seasonManager = new SeasonManager(botConfig)
  const writer = llmWriter(botConfig.ollama, llm)
  const messages = trainingMessages(writer)
  const attendance = new AttendanceMonitor(botConfig, seasonManager, messages, makeFakeTrainingHistory({ thumbsUp: ATTENDING }), bot.api)
  const trainingAnnouncer = announcer({ config: botConfig, seasonManager, messages, attendance, bot: bot.api, rulesQuiz: quiz })
  const commands: Command[] = [
    ...publicCommands({ teamChat: botConfig.telegram.teamChat, seasonManager, attendance, mtprotoUp: () => true }),
    ...trainingCommands({ config: botConfig, api: bot.api, seasonManager, messages, announcer: trainingAnnouncer, attendance, llmEnabled: writer.enabled }),
    ...quizCommands(quiz, publisher, () => true)
  ]
  routeCommands(bot, commands, botConfig.telegram.adminChatId)
  return { bot, quiz, publisher, commands }
}

afterEach(() => { mock.timers.reset() })

test('every admin command from another chat is ignored silently', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot, quiz, publisher } = build()

  for (const command of ADMIN_COMMANDS) await bot.command(command, PLAYER)

  assert.deepEqual(bot.sent, [])
  assert.deepEqual(quiz.calls, [])
  assert.deepEqual(publisher.previews, [])
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

test('/quiz_preview previews the named question in the admin chat', async () => {
  const { bot, publisher } = build()

  await bot.command('/quiz_preview sig_01', ADMIN)

  assert.deepEqual(publisher.previews.map(({ target, question }) => [target.chatId, question.id]), [[String(ADMIN.chatId), 'sig_01']])
})

test('/quiz_preview with an unknown id previews nothing', async () => {
  const { bot, publisher } = build()

  await bot.command('/quiz_preview nope', ADMIN)

  assert.deepEqual(publisher.previews, [])
  assert.equal(bot.sentTo(ADMIN.chatId).length, 1)
})

test('/quiz_preview without an id previews the next pick', async () => {
  const { bot, quiz, publisher } = build()

  await bot.command('/quiz_preview', ADMIN)

  assert.deepEqual(quiz.calls, ['pickNext'])
  assert.equal(publisher.previews.length, 1)
})

test('/quiz_post and /quiz_answer drive the quiz', async () => {
  const { bot, quiz } = build()

  await bot.command('/quiz_post', ADMIN)
  await bot.command('/quiz_answer', ADMIN)

  assert.deepEqual(quiz.calls, ['postNext', 'answerLatest'])
})

test('the old quiz command names run nothing and are offered nowhere', async () => {
  const { bot, quiz, publisher, commands } = build()
  const oldNames = ['test_rule', 'send_rule', 'answer_rule']

  for (const name of oldNames) await bot.command(`/${name}`, ADMIN)
  await publishCommandMenus(bot.api, commands, config.telegram.adminChatId)

  assert.deepEqual(bot.sent, [])
  assert.deepEqual(quiz.calls, [])
  assert.deepEqual(publisher.previews, [])
  const offered = bot.menus.flatMap(({ commands }) => commands.map(({ command }) => command))
  for (const name of oldNames) assert.equal(offered.includes(name), false)
})

test('a failing quiz action is reported back to the admin, without the exception text', async () => {
  const { bot, quiz } = build()
  const down = async () => { throw new Error('MTProto down') }
  Object.assign(quiz, { postNext: down, answerLatest: down, pickNext: down, stats: down })

  for (const command of ['/quiz_post', '/quiz_answer', '/quiz_preview', '/quiz_stats']) await bot.command(command, ADMIN)

  const replies = bot.sentTo(ADMIN.chatId)
  assert.equal(replies.length, 4)
  assert.equal(replies.some(({ text }) => text.includes('MTProto down')), false)
})

test('/start greets in any chat', async () => {
  const { bot } = build()

  await bot.command('/start', PLAYER)

  assert.equal(bot.sentTo(PLAYER.chatId).length, 1)
})

test('public replies carry no 👍, so none is taken for the announcement', async () => {
  // After the announcement: /training then shows the count
  startAt(beforeTraining(20 * HOUR_MS))
  const { bot } = build()

  for (const command of ['/start', '/help', '/info', '/training']) await bot.command(command, PLAYER)

  assert.equal(bot.sentTo(PLAYER.chatId).length, 4)
  assert.equal(bot.sentTo(PLAYER.chatId).some(({ text }) => text.includes(EMOJIS.THUMBS_UP)), false)
})

/** The /help lines naming a command, by its first word. */
const helpLinesOf = (help: string, name: string) => help.split('\n').filter(line => line.split(' ')[0] === `/${name}`)

test('/help in the admin chat lists every command once, with its usage, and no 👍', async () => {
  const { bot, commands } = build()

  await bot.command('/help', ADMIN)

  const [help] = bot.sentTo(ADMIN.chatId)
  for (const { name, usage } of commands) {
    const lines = helpLinesOf(help.text, name)
    assert.equal(lines.length, 1, name)
    if (usage) assert.ok(lines[0].startsWith(`/${name} ${usage} `), name)
  }
  assert.equal(help.text.includes(EMOJIS.THUMBS_UP), false)
})

test('/help outside the admin chat lists the public commands only', async () => {
  const { bot, commands } = build()

  await bot.command('/help', PLAYER)

  const [help] = bot.sentTo(PLAYER.chatId)
  for (const { name, adminOnly } of commands) assert.equal(helpLinesOf(help.text, name).length, adminOnly ? 0 : 1, name)
})

test('a command added to the list appears in /help', async () => {
  const bot = makeFakeBot()
  const toy: Command = { name: 'toy', description: 'Play', usage: '<n>', run: async () => {} }
  const seasonManager = new SeasonManager(config)
  const attendance = new AttendanceMonitor(config, seasonManager, trainingMessages(llmWriter(config.ollama, null)), makeFakeTrainingHistory(), bot.api)
  routeCommands(bot, [...publicCommands({ teamChat: config.telegram.teamChat, seasonManager, attendance, mtprotoUp: () => true }), toy], config.telegram.adminChatId)

  await bot.command('/help', PLAYER)

  assert.equal(helpLinesOf(bot.sentTo(PLAYER.chatId)[0].text, 'toy').length, 1)
})

type Keyboard = { inline_keyboard: Array<Array<{ callback_data: string }>> }
const callbackData = (markup: unknown) => (markup as Keyboard).inline_keyboard.map(row => row.map(({ callback_data }) => callback_data))

/** Sends /preview in the admin chat: the menu message and its buttons' callback data. */
const openPreview = async (bot: ReturnType<typeof build>['bot']) => {
  await bot.command('/preview', ADMIN)
  const menu = bot.sentTo(ADMIN.chatId).at(-1)
  assert.ok(menu)
  return { menu, rows: callbackData(menu.options.reply_markup) }
}

/** What tapping `data` on the menu sends. */
const tap = async (bot: ReturnType<typeof build>['bot'], menuId: number, data: string) => {
  const before = bot.sent.length
  await bot.tap(data, { ...ADMIN, messageId: menuId })
  return bot.sent.slice(before)
}

test('/preview answers with one menu: everything, the five messages, no LLM toggle without the LLM', async () => {
  const { bot } = build()

  const { rows } = await openPreview(bot)

  assert.equal(bot.sent.length, 1)
  assert.deepEqual(rows.map(row => row.length), [1, 3, 2])
})

test('with the LLM on, the menu toggles between LLM and template previews', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ llm: fakeLlm })
  const { menu, rows } = await openPreview(bot)
  assert.equal(rows.length, 4)

  const llmPreview = await tap(bot, menu.messageId, rows[1][0])
  assert.ok(llmPreview.some(({ text }) => text.includes(LLM_TEXT)))

  await tap(bot, menu.messageId, rows[3][0])
  const [edit] = bot.buttonEdits
  assert.equal(edit.messageId, menu.messageId)
  const templatePreview = await tap(bot, menu.messageId, callbackData(edit.markup)[1][0])
  assert.equal(templatePreview.some(({ text }) => text.includes(LLM_TEXT)), false)
  assert.ok(templatePreview.some(({ text }) => text.includes(EMOJIS.THUMBS_UP)))
})

test('everything previews what /send_to_all posts, in order, on the template path', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()
  const { menu, rows } = await openPreview(bot)

  const previews = await tap(bot, menu.messageId, rows[0][0])
  await bot.command('/send_to_all', ADMIN)
  const posted = [...bot.sentTo(TEAM_CHAT), ...bot.sentTo(config.telegram.trainerChat.chatId)].sort((a, b) => a.messageId - b.messageId)

  assert.equal(posted.length, 3)
  const positions = posted.map(({ text }) => previews.findIndex(preview => preview.text.includes(text)))
  assert.equal(positions.includes(-1), false)
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b))
})

test('everything leaves out a disabled key request instead of previewing it', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ env: { SUMMER_KEY_MESSAGE_ENABLED: 'false' } })
  const { menu, rows } = await openPreview(bot)

  const previews = await tap(bot, menu.messageId, rows[0][0])

  assert.equal(previews.some(({ text }) => text.includes(MARKERS.KEY)), false)
  assert.ok(previews.some(({ text }) => text.includes(EMOJIS.FRISBEE)))
})

test('the attendance reminder and cancellation notice previews render with sample counts', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()
  const { menu, rows } = await openPreview(bot)
  const threshold = String(config.seasons.summer.minAttendance)

  const [reminder] = await tap(bot, menu.messageId, rows[2][0])
  const [cancellation] = await tap(bot, menu.messageId, rows[2][1])

  assert.ok(reminder.text.includes(MARKERS.ATTENDANCE_REMINDER))
  assert.ok(reminder.text.includes(threshold))
  assert.ok(cancellation.text.includes(MARKERS.CANCELLATION))
  assert.ok(cancellation.text.includes(threshold))
})

test('the previews stay in the admin chat, whatever is tapped', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ llm: fakeLlm })
  const { menu, rows } = await openPreview(bot)

  for (const data of rows.flat()) await tap(bot, menu.messageId, data)

  assert.equal(bot.sentTo(ADMIN.chatId).length, bot.sent.length)
  assert.ok(bot.sent.length > rows.flat().length)
})

test('a preview button tapped outside the admin chat does nothing', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ llm: fakeLlm })
  const { rows } = await openPreview(bot)
  const before = bot.sent.length

  for (const data of rows.flat()) await bot.tap(data, { ...PLAYER, messageId: 1 })

  assert.equal(bot.sent.length, before)
  assert.deepEqual(bot.buttonEdits, [])
})

test('the six old preview commands run nothing and are offered nowhere', async () => {
  const { bot, commands } = build()
  const oldNames = ['test_template', 'test_llm', 'test_trainer', 'test_key', 'preview_team', 'preview_all']

  for (const name of oldNames) await bot.command(`/${name}`, ADMIN)
  await publishCommandMenus(bot.api, commands, config.telegram.adminChatId)

  assert.deepEqual(bot.sent, [])
  const offered = bot.menus.flatMap(({ commands }) => commands.map(({ command }) => command))
  for (const name of oldNames) assert.equal(offered.includes(name), false)
})
