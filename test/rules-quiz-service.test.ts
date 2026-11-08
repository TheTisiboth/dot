import './helpers/testEnv'
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import type TelegramBot from 'node-telegram-bot-api'
import { config } from '../src/config'
import { findQuizQuestion, QUIZ_QUESTIONS } from '../src/data/rules-quiz'
import { RulesQuizService } from '../src/services/RulesQuizService'
import { answerTimeFor } from '../src/services/quizAnswer'
import { type LatestQuiz, type ReactionReader } from '../src/services/ReactionReader'
import { type SeasonManager } from '../src/services/SeasonManager'
import { type QuizQuestion, type SeasonType } from '../src/types'
import { parseQuizTag } from '../src/utils/quizTag'

interface Call {
  method: 'sendPhoto' | 'sendMessage' | 'sendPoll' | 'stopPoll';
  chatId: string;
  content: unknown;
  options: Record<string, unknown>;
  extra?: unknown;
  messageId: number;
}

const RULES_CHAT = { chatId: '-400', threadId: '7' }
const flush = async () => await new Promise(resolve => setImmediate(resolve))

let calls: Call[]
let askedIds: string[]
let historyError: Error | undefined
let historyReads: Array<{ chatId: string; threadId?: string; botUsername: string }>
let latestQuiz: LatestQuiz | undefined
let stopPollError: Error | undefined
const POLL_RESULT = { options: [{ text: 'x', voter_count: 1 }], total_voter_count: 4 }

const bot = (() => {
  let nextId = 100
  const record = (method: Call['method']) => async (chatId: string, content: unknown, ...rest: unknown[]) => {
    const options = (method === 'sendPoll' ? rest[1] : rest[0]) as Record<string, unknown>
    const extra = method === 'sendPhoto' ? rest[1] : method === 'sendPoll' ? rest[0] : undefined
    const messageId = nextId++
    calls.push({ method, chatId, content, options, extra, messageId })
    return { message_id: messageId }
  }
  return {
    sendPhoto: record('sendPhoto'),
    sendMessage: record('sendMessage'),
    sendPoll: record('sendPoll'),
    getMe: async () => ({ username: 'quiz_bot' }),
    stopPoll: async (chatId: string, messageId: number) => {
      calls.push({ method: 'stopPoll', chatId, content: messageId, options: {}, messageId })
      if (stopPollError) throw stopPollError
      return { ...POLL_RESULT, options: [{ text: findQuizQuestion(latestQuiz?.questionId ?? '')?.answer, voter_count: 1 }] }
    }
  }
})() as unknown as TelegramBot

const seasonOf = (season: SeasonType) =>
  ({ getNextTrainingInfo: () => ({ season }) }) as unknown as SeasonManager

const reader = {
  getAskedQuizIds: async (chatId: string, threadId: string | undefined, botUsername: string) => {
    historyReads.push({ chatId, threadId, botUsername })
    if (historyError) throw historyError
    return askedIds
  },
  getLatestQuiz: async () => latestQuiz
} as unknown as ReactionReader

const service = (season: SeasonType = 'winter') => new RulesQuizService(bot, seasonOf(season), reader)

const question = (id: string): QuizQuestion => {
  const q = findQuizQuestion(id)
  assert.ok(q, id)
  return q
}

// Posting arms a real answer timer, a day away: left real, it would keep the test process alive
beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }) })
afterEach(() => { mock.timers.reset() })

beforeEach(() => {
  calls = []
  askedIds = []
  historyError = undefined
  historyReads = []
  latestQuiz = undefined
  stopPollError = undefined
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
  assert.deepEqual(historyReads[0], { ...RULES_CHAT, botUsername: 'quiz_bot' })
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

test('a hung history read ends in an error, then one retry later posts the quiz', async () => {
  let hang = true
  const quiz = new RulesQuizService(bot, seasonOf('winter'), {
    // Like a request on a dead MTProto connection: never settles
    getAskedQuizIds: async () => hang ? await new Promise<string[]>(() => undefined) : []
  } as unknown as ReactionReader)

  const sent = quiz.sendScheduled()
  await flush()
  mock.timers.tick(3 * 60_000)
  await sent
  assert.equal(calls.length, 0)

  hang = false
  mock.timers.tick(10 * 60_000)
  await flush()
  await flush()
  assert.deepEqual(calls.map(c => c.method).at(-1), 'sendPoll')
})

test('a hung post does not block the next one', async () => {
  let hang = true
  const quiz = new RulesQuizService(bot, seasonOf('winter'), {
    getAskedQuizIds: async () => hang ? await new Promise<string[]>(() => undefined) : []
  } as unknown as ReactionReader)

  const stuck = assert.rejects(quiz.postNext(), /timed out/)
  await flush()
  mock.timers.tick(3 * 60_000)
  await stuck

  hang = false
  assert.ok(await quiz.postNext())
})

test('the retry gives up after one more failure', async () => {
  historyError = new Error('MTProto down')
  await service().sendScheduled()
  mock.timers.tick(10 * 60_000)
  await flush()
  assert.equal(historyReads.length, 2)
  mock.timers.tick(60 * 60_000)
  await flush()
  assert.equal(historyReads.length, 2)
  assert.equal(calls.length, 0)
})

test('overlapping posts run one after another, so they never read the same history', async () => {
  // One indoor question left: without the queue both posts would read this history and pick it
  const indoor = QUIZ_QUESTIONS.filter(q => q.modes.includes('indoor')).map(q => q.id)
  const before = indoor.slice(1)
  const quiz = new RulesQuizService(bot, seasonOf('winter'), {
    getAskedQuizIds: async () => [
      ...calls.filter(c => c.method === 'sendPoll').map(c => parseQuizTag(c.content as string) as string).reverse(),
      ...before
    ]
  } as unknown as ReactionReader)

  const [first, second] = await Promise.all([quiz.postNext(), quiz.postNext()])
  assert.equal(first.id, indoor[0])
  assert.notEqual(second.id, first.id)
})

test('a failed post does not block the next one', async () => {
  historyError = new Error('MTProto down')
  const quiz = service()
  await assert.rejects(quiz.postNext(), /MTProto down/)
  historyError = undefined
  assert.ok(await quiz.postNext())
})

test('a failed bot username lookup is retried on the next post', async () => {
  let attempts = 0
  const flakyBot = Object.assign(Object.create(bot as object) as TelegramBot, {
    getMe: async () => {
      attempts++
      if (attempts === 1) throw new Error('Bot API down')
      return { username: 'quiz_bot' }
    }
  })
  const quiz = new RulesQuizService(flakyBot, seasonOf('winter'), reader)

  await assert.rejects(quiz.postNext(), /Bot API down/)
  assert.ok(await quiz.postNext())
  assert.equal(attempts, 2)
})

const latest = (fields: Partial<LatestQuiz> = {}): LatestQuiz =>
  ({ messageId: 50, questionId: 'r1_01', postedAt: new Date(), answered: false, ...fields })

test('answer: closes the poll, then replies to it in the topic with the stats', async () => {
  latestQuiz = latest()
  const answered = await service().answerLatest()

  assert.equal(answered?.id, 'r1_01')
  assert.deepEqual(calls.map(c => c.method), ['stopPoll', 'sendMessage'])
  const [stop, answer] = calls
  assert.equal(stop.content, 50)
  assert.equal(answer.options.reply_to_message_id, 50)
  assert.equal(answer.options.message_thread_id, 7)
  assert.equal(answer.options.parse_mode, 'HTML')
  assert.match(answer.content as string, /^<b>Answer<\/b>\n✅ /)
  assert.match(answer.content as string, /📊 1\/4 got it right \(25%\)/)
})

test('answer: "what is the signal?" questions answer with the signal photo', async () => {
  latestQuiz = latest({ questionId: 'sig_01_r' })
  await service().answerLatest()

  assert.deepEqual(calls.map(c => c.method), ['stopPoll', 'sendPhoto'])
  const photo = calls[1]
  assert.equal(photo.content, 'assets/signals/01-foul.png')
  assert.equal(photo.options.reply_to_message_id, 50)
  assert.equal(photo.options.parse_mode, 'HTML')
  assert.match(photo.options.caption as string, /^<b>Answer<\/b>\n✅ /)
})

test('answer: skipped when already answered, none posted, or the question left the bank', async () => {
  for (const quiz of [latest({ answered: true }), undefined, latest({ questionId: 'removed_question' })]) {
    latestQuiz = quiz
    assert.equal(await service().answerLatest(), undefined)
  }
  assert.equal(calls.length, 0)
})

test('answer: a poll already closed is still answered, without stats', async () => {
  latestQuiz = latest()
  stopPollError = new Error('ETELEGRAM: 400 Bad Request: poll has already been closed')
  await service().answerLatest()

  assert.deepEqual(calls.map(c => c.method), ['stopPoll', 'sendMessage'])
  assert.ok(!(calls[1].content as string).includes('📊'))
})

test('answer: other stopPoll errors are not swallowed', async () => {
  latestQuiz = latest()
  stopPollError = new Error('ETELEGRAM: 400 Bad Request: message to stop not found')
  await assert.rejects(service().answerLatest(), /not found/)
  assert.deepEqual(calls.map(c => c.method), ['stopPoll'])
})

const DAY = 24 * 60 * 60 * 1000

test('arming: a passed answer time fires at once (catch-up)', async () => {
  latestQuiz = latest({ postedAt: new Date(Date.now() - 3 * DAY) })
  await service().armAnswer()
  mock.timers.tick(0)
  await flush()
  assert.deepEqual(calls.map(c => c.method), ['stopPoll', 'sendMessage'])
})

test('arming: a future answer time waits for it', async () => {
  const postedAt = new Date(Date.now() + DAY) // answer due in two days, at 22:00
  latestQuiz = latest({ postedAt })
  await service().armAnswer()

  const delay = answerTimeFor(postedAt, config.rulesQuiz.answerTime).getTime() - Date.now()
  mock.timers.tick(delay - 1000)
  await flush()
  assert.equal(calls.length, 0, 'not before the answer time')
  mock.timers.tick(2000)
  await flush()
  assert.deepEqual(calls.map(c => c.method), ['stopPoll', 'sendMessage'])
})

test('arming: nothing when the latest poll is already answered, or the quiz is disabled', async () => {
  latestQuiz = latest({ answered: true, postedAt: new Date(0) })
  await service().armAnswer()
  config.rulesQuiz.enabled = false
  latestQuiz = latest({ postedAt: new Date(0) })
  await service().armAnswer()
  mock.timers.tick(0)
  await flush()
  assert.equal(calls.length, 0)
})

test('preview: the question, then its answer replying to the poll, without closing it', async () => {
  const admin = { chatId: '-200' }
  await service().preview(admin, question('sig_01'))

  assert.deepEqual(calls.map(c => c.method), ['sendPhoto', 'sendPoll', 'sendMessage'])
  const [, poll, answer] = calls
  assert.ok(calls.every(c => c.chatId === admin.chatId))
  assert.equal(answer.options.reply_to_message_id, poll.messageId)
  assert.match(answer.content as string, /^<b>Answer<\/b>\n✅ Foul/)
  assert.ok(!(answer.content as string).includes('📊'))
})

test('answer: no link preview card', async () => {
  latestQuiz = latest({ questionId: 'r9_01' })
  await service().answerLatest()
  assert.equal(calls[1].options.link_preview_options, JSON.stringify({ is_disabled: true }))
})

test('timer: a poll posted just before it fires is not answered early', async () => {
  const quiz = service()
  latestQuiz = latest({ messageId: 50, postedAt: new Date(Date.now() - 3 * DAY) })
  await quiz.armAnswer()

  latestQuiz = latest({ messageId: 60, postedAt: new Date() }) // /send_rule landed first
  mock.timers.tick(0)
  await flush()
  assert.equal(calls.length, 0)
})

test('/answer_rule still answers the newest poll', async () => {
  latestQuiz = latest({ messageId: 60 })
  assert.ok(await service().answerLatest())
  assert.equal(calls[0].content, 60)
})

test('posting arms the answer from the post itself, before search can see the new poll', async () => {
  latestQuiz = undefined // search has not indexed the poll yet
  const quiz = service()
  const posted = await quiz.postNext()
  const pollMessageId = calls.find(c => c.method === 'sendPoll')?.messageId
  assert.ok(pollMessageId)

  latestQuiz = latest({ messageId: pollMessageId, questionId: posted.id }) // indexed by answer time
  calls = []
  mock.timers.tick(2 * DAY)
  await flush()
  assert.deepEqual(calls.map(c => c.method).slice(0, 1), ['stopPoll'])
  assert.equal(calls[0].content, pollMessageId)
})
