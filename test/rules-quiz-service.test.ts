import './helpers/testEnv'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import type TelegramBot from 'node-telegram-bot-api'
import { config } from '../src/config'
import { findQuizQuestion } from '../src/data/rules-quiz'
import { RulesQuizService } from '../src/services/RulesQuizService'
import { type ReactionReader } from '../src/services/ReactionReader'
import { type SeasonManager } from '../src/services/SeasonManager'
import { type QuizQuestion, type SeasonType } from '../src/types'
import { parseQuizTag } from '../src/utils/quizTag'

interface Call {
  method: 'sendPhoto' | 'sendMessage' | 'sendPoll';
  chatId: string;
  content: unknown;
  options: Record<string, unknown>;
  extra?: unknown;
  messageId: number;
}

const RULES_CHAT = { chatId: '-400', threadId: '7' }

let calls: Call[]
let askedIds: string[]
let historyError: Error | undefined
let historyReads: Array<{ chatId: string; threadId?: string }>

const bot = (() => {
  let nextId = 100
  const record = (method: Call['method']) => async (chatId: string, content: unknown, ...rest: unknown[]) => {
    const options = (method === 'sendPoll' ? rest[1] : rest[0]) as Record<string, unknown>
    const extra = method === 'sendPhoto' ? rest[1] : method === 'sendPoll' ? rest[0] : undefined
    const messageId = nextId++
    calls.push({ method, chatId, content, options, extra, messageId })
    return { message_id: messageId }
  }
  return { sendPhoto: record('sendPhoto'), sendMessage: record('sendMessage'), sendPoll: record('sendPoll') }
})() as unknown as TelegramBot

const seasonOf = (season: SeasonType) =>
  ({ getNextTrainingInfo: () => ({ season }) }) as unknown as SeasonManager

const reader = {
  getAskedQuizIds: async (chatId: string, threadId?: string) => {
    historyReads.push({ chatId, threadId })
    if (historyError) throw historyError
    return askedIds
  }
} as unknown as ReactionReader

const service = (season: SeasonType = 'winter') => new RulesQuizService(bot, seasonOf(season), reader)

const question = (id: string): QuizQuestion => {
  const q = findQuizQuestion(id)
  assert.ok(q, id)
  return q
}

beforeEach(() => {
  calls = []
  askedIds = []
  historyError = undefined
  historyReads = []
  config.rulesQuiz.enabled = true
  config.rulesQuiz.chatId = RULES_CHAT.chatId
  config.rulesQuiz.chatThreadId = RULES_CHAT.threadId
})

test('signal question: photo, then the poll replying to it, in the topic', async () => {
  await service().post(RULES_CHAT, question('sig_01'))

  assert.deepEqual(calls.map(c => c.method), ['sendPhoto', 'sendPoll'])
  const [photo, poll] = calls
  assert.equal(photo.content, 'assets/signals/01-foul.png')
  assert.deepEqual(photo.extra, { contentType: 'image/png' })
  assert.equal(photo.options.message_thread_id, 7)
  assert.equal(poll.options.reply_to_message_id, photo.messageId)
  assert.equal(poll.options.message_thread_id, 7)
})

test('poll is anonymous, single answer, not quiz-type, and carries the hidden id', async () => {
  await service().post(RULES_CHAT, question('r1_01'))

  assert.deepEqual(calls.map(c => c.method), ['sendPoll'])
  const [poll] = calls
  assert.equal(parseQuizTag(poll.content as string), 'r1_01')
  assert.equal(poll.options.is_anonymous, true)
  assert.equal(poll.options.type, 'regular')
  assert.equal(poll.options.allows_multiple_answers, false)
  assert.equal(poll.options.reply_to_message_id, undefined)
  assert.deepEqual([...(poll.extra as string[])].sort(), [question('r1_01').answer, ...question('r1_01').wrong].sort())
})

test('long question: text first, then a short poll replying to it', async () => {
  const long = { ...question('r1_01'), question: 'x'.repeat(295) }
  await service().post(RULES_CHAT, long)

  assert.deepEqual(calls.map(c => c.method), ['sendMessage', 'sendPoll'])
  assert.ok((calls[0].content as string).endsWith(long.question))
  assert.equal(calls[1].options.reply_to_message_id, calls[0].messageId)
  assert.equal(parseQuizTag(calls[1].content as string), 'r1_01')
})

test('no topic: no thread option', async () => {
  await service().post({ chatId: '-400' }, question('r1_01'))
  assert.equal('message_thread_id' in calls[0].options, false)
})

test('postNext reads the rules chat history and picks for the season mode', async () => {
  for (let i = 0; i < 20; i++) {
    calls = []
    const posted = await service('winter').postNext()
    assert.ok(posted.modes.includes('indoor'), posted.id)
    assert.ok(!askedIds.includes(posted.id), `${posted.id} repeated`)
    askedIds.unshift(posted.id)
  }
  assert.deepEqual(historyReads[0], RULES_CHAT)
  assert.ok(calls.every(c => c.chatId === RULES_CHAT.chatId))
})

test('summer picks outdoor questions', async () => {
  for (let i = 0; i < 20; i++) assert.ok((await service('summer').postNext()).modes.includes('outdoor'))
})

test('postNext fails without RULES_CHAT_ID', async () => {
  config.rulesQuiz.chatId = undefined
  await assert.rejects(service().postNext(), /RULES_CHAT_ID/)
})

test('sendScheduled does nothing when disabled', async () => {
  config.rulesQuiz.enabled = false
  await service().sendScheduled()
  assert.equal(historyReads.length, 0)
  assert.equal(calls.length, 0)
})

test('sendScheduled never throws, so the training post is never affected', async () => {
  historyError = new Error('MTProto down')
  await service().sendScheduled()
  assert.equal(calls.length, 0)
})
