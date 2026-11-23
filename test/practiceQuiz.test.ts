import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { type Command, publishCommandMenus, routeCommands } from '../src/commands/registry'
import { PRACTICE_INTERVAL_MS, practiceCommand, quizCommands } from '../src/commands/quiz'
import { publicCommands } from '../src/commands/public'
import { quizPublisher } from '../src/quiz/publisher'
import { RulesQuizService } from '../src/quiz/service'
import { type QuizHistory } from '../src/quiz/history'
import { findQuizQuestion, isSignalQuestion } from '../src/quiz/data'
import { parseQuizTag } from '../src/quiz/tag'
import { AttendanceMonitor } from '../src/training/attendance'
import { SeasonManager } from '../src/training/season'
import { llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import { EMOJIS } from '../src/shared/emojis'
import { makeFakeBot } from './fakes/bot'
import { makeFakeTrainingHistory } from './fakes/trainingHistory'
import { beforeTraining } from './fixtures/dates'
import { HOUR_MS, advance, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

const config = testConfig()
const DM = { chatId: 555, private: true }
const GROUP = { chatId: -900 }
const RULES_CHAT = config.rulesQuiz.chat?.chatId

type Keyboard = { inline_keyboard: Array<Array<{ callback_data: string }>> }
const callbackData = (markup: unknown) => (markup as Keyboard).inline_keyboard.flat().map(({ callback_data }) => callback_data)

/** Records every rules chat history read. */
const recordingHistory = () => {
  const reads: string[] = []
  const history: QuizHistory = {
    getAskedQuizzes: async (chatId) => { reads.push(chatId); return [] },
    getLatestQuiz: async (chatId) => { reads.push(chatId); return undefined }
  }
  return { reads, history }
}

const build = ({ random }: { random?: () => number } = {}) => {
  const bot = makeFakeBot()
  const seasonManager = new SeasonManager(config)
  const publisher = quizPublisher(bot.api)
  const { reads, history } = recordingHistory()
  const rulesQuiz = new RulesQuizService(config.rulesQuiz, publisher, seasonManager, history)
  const attendance = new AttendanceMonitor(config, seasonManager, trainingMessages(llmWriter(config.ollama, null)), makeFakeTrainingHistory(), bot.api)
  const commands: Command[] = [
    ...publicCommands({ teamChat: config.telegram.teamChat, seasonManager, attendance, mtprotoUp: () => true }),
    practiceCommand({ publisher, seasonManager, random }),
    ...quizCommands(rulesQuiz, publisher, () => true)
  ]
  routeCommands(bot, commands, config.telegram.adminChatId)
  return { bot, commands, reads }
}

/** The question a poll asks, from its hidden tag. */
const questionOf = (pollText: string) => {
  const question = findQuizQuestion(parseQuizTag(pollText) ?? '')
  assert.ok(question)
  return question
}

/** What `send` puts in the chat. */
const sentBy = async (bot: ReturnType<typeof build>['bot'], send: () => Promise<void>) => {
  const before = bot.sent.length
  await send()
  return bot.sent.slice(before)
}

afterEach(() => { mock.timers.reset() })

test('/quiz in a private chat sends a poll, then its answer with the practice buttons under it', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  await bot.command('/quiz', DM)

  const sent = bot.sentTo(DM.chatId)
  assert.equal(sent.length, bot.sent.length)
  const pollIndex = sent.findIndex(({ kind }) => kind === 'poll')
  assert.ok(pollIndex >= 0)
  const answer = sent.at(-1)
  assert.ok(answer && sent.indexOf(answer) > pollIndex)
  assert.ok(answer.text.includes('tg-spoiler'))
  assert.deepEqual(callbackData(answer.options.reply_markup), ['quiz:outdoor', 'quiz:indoor', 'quiz:outdoor', 'quiz:signals'])
})

test('/quiz picks from the next training\'s season mode', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  for (let i = 0; i < 10; i++) {
    const poll = (await sentBy(bot, () => bot.command('/quiz', DM))).find(({ kind }) => kind === 'poll')
    assert.ok(poll)
    assert.ok(questionOf(poll.text).modes.includes('outdoor'))
    await advance(PRACTICE_INTERVAL_MS)
  }
})

test('/quiz in a group only replies once pointing to a private chat', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  await bot.command('/quiz', GROUP)

  assert.equal(bot.sent.length, 1)
  assert.equal(bot.sent[0].kind, 'message')
  assert.equal(bot.sent[0].text.includes(EMOJIS.THUMBS_UP), false)
})

test('a signal question sends its image before the poll', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ random: () => 0 })

  const sent = await sentBy(bot, () => bot.tap('quiz:signals', { ...DM, messageId: 1 }))

  const question = questionOf(sent[1].text)
  assert.ok(isSignalQuestion(question.id) && question.image)
  assert.deepEqual(sent.map(({ kind }) => kind), ['photo', 'poll', 'message'])
})

test('an answer shown as an image carries the practice buttons too', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build({ random: () => 0.9999 })

  const sent = await sentBy(bot, () => bot.tap('quiz:signals', { ...DM, messageId: 1 }))

  const answer = sent.at(-1)
  assert.ok(answer && questionOf(sent[0].text).answerImage)
  assert.equal(answer.kind, 'photo')
  assert.deepEqual(callbackData(answer.options.reply_markup), ['quiz:signals', 'quiz:indoor', 'quiz:outdoor', 'quiz:signals'])
})

test('each button asks from its own pool, Another from the one just asked', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  for (const pool of ['indoor', 'signals', 'outdoor']) {
    const sent = await sentBy(bot, () => bot.tap(`quiz:${pool}`, { ...DM, messageId: 1 }))
    const poll = sent.find(({ kind }) => kind === 'poll')
    const answer = sent.at(-1)
    assert.ok(poll && answer)
    const question = questionOf(poll.text)
    assert.ok(pool === 'signals' ? isSignalQuestion(question.id) : question.modes.includes(pool as 'indoor' | 'outdoor'), pool)
    assert.equal(callbackData(answer.options.reply_markup)[0], `quiz:${pool}`)
    await advance(PRACTICE_INTERVAL_MS)
  }
})

test('one question per private chat every few seconds, however fast it is asked', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()
  const polls = () => bot.sent.filter(({ kind }) => kind === 'poll').length

  await bot.command('/quiz', DM)
  await bot.tap('quiz:indoor', { ...DM, messageId: 1 })
  await advance(PRACTICE_INTERVAL_MS - 1)
  await bot.command('/quiz', DM)
  assert.equal(polls(), 1)

  await bot.command('/quiz', { chatId: 556, private: true })
  assert.equal(polls(), 2)

  await advance(1)
  await bot.command('/quiz', DM)
  assert.equal(polls(), 3)
})

test('an unknown practice button does nothing', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot } = build()

  await bot.tap('quiz:nope', { ...DM, messageId: 1 })

  assert.deepEqual(bot.sent, [])
})

test('practice neither reads nor posts to the rules chat, however many questions', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot, reads } = build()

  for (let i = 0; i < 20; i++) {
    await bot.command('/quiz', DM)
    await advance(PRACTICE_INTERVAL_MS)
  }

  assert.deepEqual(reads, [])
  assert.ok(RULES_CHAT)
  assert.deepEqual(bot.sentTo(RULES_CHAT), [])
  assert.equal(bot.sentTo(DM.chatId).filter(({ kind }) => kind === 'poll').length, 20)
})

test('/quiz is offered in the private chats\' menu and the admin chat, listed in /help', async () => {
  const { bot, commands } = build()

  await publishCommandMenus(bot.api, commands, config.telegram.adminChatId)
  await bot.command('/help', GROUP)

  const offered = (type: string) => bot.menus.find(({ options }) => (options?.scope?.type ?? 'default') === type)?.commands.map(({ command }) => command) ?? []
  assert.equal(offered('default').includes('quiz'), false)
  assert.ok(offered('all_private_chats').includes('quiz'))
  assert.ok(offered('chat').includes('quiz'))
  assert.equal(offered('all_private_chats').includes('quiz_post'), false)
  assert.ok(bot.sentTo(GROUP.chatId)[0].text.includes('/quiz -'))
})
