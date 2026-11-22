import './helpers/testEnv'
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { type Api, InputFile } from 'grammy'
import { findQuizQuestion, QUIZ_QUESTIONS } from '../src/quiz/data'
import { RulesQuizService } from '../src/quiz/service'
import { quizPublisher } from '../src/quiz/publisher'
import { answerTimeFor } from '../src/quiz/answer'
import { type LatestQuiz, type QuizHistory } from '../src/quiz/history'
import { type SeasonManager, type SeasonType } from '../src/training/season'
import { type QuizQuestion } from '../src/quiz/question'
import { parseQuizTag } from '../src/quiz/tag'
import { testConfig } from './fixtures/config'

interface Call {
  method: 'sendPhoto' | 'sendMessage' | 'sendPoll';
  chatId: string;
  content: unknown;
  options: Record<string, unknown>;
  extra?: unknown;
  messageId: number;
}

const RULES_CHAT = { chatId: '-400', threadId: 7 }
const flush = async () => await new Promise(resolve => setImmediate(resolve))

let calls: Call[]
let askedIds: string[]
let historyError: Error | undefined
let historyReads: Array<{ chatId: string; threadId?: number }>
let latestQuiz: LatestQuiz | undefined

const bot = (() => {
  let nextId = 100
  const record = (method: Call['method']) => async (chatId: string, content: unknown, ...rest: unknown[]) => {
    const options = (method === 'sendPoll' ? rest[1] : rest[0]) as Record<string, unknown>
    const extra = method === 'sendPoll' ? rest[0] : undefined
    const messageId = nextId++
    calls.push({ method, chatId, content, options, extra, messageId })
    return { message_id: messageId }
  }
  return {
    sendPhoto: record('sendPhoto'),
    sendMessage: record('sendMessage'),
    sendPoll: record('sendPoll'),
    stopPoll: async () => { throw new Error('the poll must stay open') }
  }
})() as unknown as Api

const seasonOf = (season: SeasonType) =>
  ({ nextTraining: () => ({ season }) }) as unknown as SeasonManager

const reader = {
  getAskedQuizIds: async (chatId: string, threadId: number | undefined) => {
    historyReads.push({ chatId, threadId })
    if (historyError) throw historyError
    return askedIds
  },
  getLatestQuiz: async () => latestQuiz
} as unknown as QuizHistory

const publisher = quizPublisher(bot)

const RULES_QUIZ = testConfig().rulesQuiz
const DISABLED = { ...RULES_QUIZ, enabled: false }

const service = (season: SeasonType = 'winter', rulesQuiz = RULES_QUIZ) => new RulesQuizService(rulesQuiz, publisher, seasonOf(season), reader)

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
})

test('signal question: photo, then the poll replying to it, in the topic', async () => {
  await publisher.post(RULES_CHAT, question('sig_01'))

  assert.deepEqual(calls.map(c => c.method), ['sendPhoto', 'sendPoll'])
  const [photo, poll] = calls
  assert.ok(photo.content instanceof InputFile)
  assert.equal(photo.content.filename, '01-foul.png')
  assert.equal(photo.options.message_thread_id, 7)
  assert.equal(poll.options.reply_to_message_id, photo.messageId)
  assert.equal(poll.options.message_thread_id, 7)
})

test('poll is an anonymous quiz pointing at the right answer, and carries the hidden id', async () => {
  for (let i = 0; i < 10; i++) {
    calls = []
    await publisher.post(RULES_CHAT, question('r1_01'))

    assert.deepEqual(calls.map(c => c.method), ['sendPoll'])
    const [poll] = calls
    const options = poll.extra as string[]
    assert.equal(parseQuizTag(poll.content as string), 'r1_01')
    assert.equal(poll.options.is_anonymous, true)
    assert.equal(poll.options.type, 'quiz')
    assert.equal(options[(poll.options.correct_option_ids as number[])[0]], question('r1_01').answer)
    assert.equal(poll.options.reply_to_message_id, undefined)
    assert.deepEqual([...options].sort(), [question('r1_01').answer, ...question('r1_01').wrong].sort())
  }
})

test('long question: text first, then a short poll replying to it', async () => {
  const long = { ...question('r1_01'), question: 'x'.repeat(295) }
  await publisher.post(RULES_CHAT, long)

  assert.deepEqual(calls.map(c => c.method), ['sendMessage', 'sendPoll'])
  assert.ok((calls[0].content as string).endsWith(long.question))
  assert.equal(calls[1].options.reply_to_message_id, calls[0].messageId)
  assert.equal(parseQuizTag(calls[1].content as string), 'r1_01')
})

test('no topic: no thread option', async () => {
  await publisher.post({ chatId: '-400' }, question('r1_01'))
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
  await assert.rejects(service('winter', { ...RULES_QUIZ, chat: undefined }).postNext(), /RULES_CHAT_ID/)
})

test('sendScheduled does nothing when disabled', async () => {
  await service('winter', DISABLED).sendScheduled()
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
  const quiz = new RulesQuizService(RULES_QUIZ, publisher, seasonOf('winter'), {
    // Like a request on a dead MTProto connection: never settles
    getAskedQuizIds: async () => hang ? await new Promise<string[]>(() => undefined) : []
  } as unknown as QuizHistory)

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
  const quiz = new RulesQuizService(RULES_QUIZ, publisher, seasonOf('winter'), {
    getAskedQuizIds: async () => hang ? await new Promise<string[]>(() => undefined) : []
  } as unknown as QuizHistory)

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
  const quiz = new RulesQuizService(RULES_QUIZ, publisher, seasonOf('winter'), {
    getAskedQuizIds: async () => [
      ...calls.filter(c => c.method === 'sendPoll').map(c => parseQuizTag(c.content as string) as string).reverse(),
      ...before
    ]
  } as unknown as QuizHistory)

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

const latest = (fields: Partial<LatestQuiz> = {}): LatestQuiz =>
  ({ messageId: 50, questionId: 'r1_01', postedAt: new Date(), answered: false, ...fields })

test('answer: replies to the poll in the topic, behind a spoiler, leaving the poll open', async () => {
  latestQuiz = latest()
  const answered = await service().answerLatest()

  assert.equal(answered?.id, 'r1_01')
  assert.deepEqual(calls.map(c => c.method), ['sendMessage'])
  const [answer] = calls
  assert.equal(answer.options.reply_to_message_id, 50)
  assert.equal(answer.options.message_thread_id, 7)
  assert.equal(answer.options.parse_mode, 'HTML')
  assert.match(answer.content as string, /^<b>Answer<\/b>\n<tg-spoiler>✅ /)
})

test('answer: "what is the signal?" questions answer with the signal photo', async () => {
  latestQuiz = latest({ questionId: 'sig_01_r' })
  await service().answerLatest()

  assert.deepEqual(calls.map(c => c.method), ['sendPhoto'])
  const [photo] = calls
  assert.ok(photo.content instanceof InputFile)
  assert.equal(photo.content.filename, '01-foul.png')
  assert.equal(photo.options.reply_to_message_id, 50)
  assert.equal(photo.options.has_spoiler, true)
  assert.equal(photo.options.parse_mode, 'HTML')
  assert.match(photo.options.caption as string, /^<b>Answer<\/b>\n<tg-spoiler>✅ /)
})

test('answer: skipped when already answered, none posted, or the question left the bank', async () => {
  for (const quiz of [latest({ answered: true }), undefined, latest({ questionId: 'removed_question' })]) {
    latestQuiz = quiz
    assert.equal(await service().answerLatest(), undefined)
  }
  assert.equal(calls.length, 0)
})

const DAY = 24 * 60 * 60 * 1000

test('arming: a passed answer time fires at once (catch-up)', async () => {
  latestQuiz = latest({ postedAt: new Date(Date.now() - 3 * DAY) })
  await service().armAnswer()
  mock.timers.tick(0)
  await flush()
  assert.deepEqual(calls.map(c => c.method), ['sendMessage'])
})

test('arming: a future answer time waits for it', async () => {
  const postedAt = new Date(Date.now() - 10 * 60_000) // answer due in 50 min
  latestQuiz = latest({ postedAt })
  await service().armAnswer()

  const delay = answerTimeFor(postedAt, RULES_QUIZ.answerDelayMinutes).getTime() - Date.now()
  assert.ok(delay > 0)
  mock.timers.tick(delay - 1000)
  await flush()
  assert.equal(calls.length, 0, 'not before the answer time')
  mock.timers.tick(2000)
  await flush()
  assert.deepEqual(calls.map(c => c.method), ['sendMessage'])
})

test('arming: nothing when the latest poll is already answered, or the quiz is disabled', async () => {
  latestQuiz = latest({ answered: true, postedAt: new Date(0) })
  await service().armAnswer()
  latestQuiz = latest({ postedAt: new Date(0) })
  await service('winter', DISABLED).armAnswer()
  mock.timers.tick(0)
  await flush()
  assert.equal(calls.length, 0)
})

test('preview: the question, then its spoiler answer replying to the poll', async () => {
  const admin = { chatId: '-200' }
  await publisher.preview(admin, question('sig_01'))

  assert.deepEqual(calls.map(c => c.method), ['sendPhoto', 'sendPoll', 'sendMessage'])
  const [, poll, answer] = calls
  assert.ok(calls.every(c => c.chatId === admin.chatId))
  assert.equal(answer.options.reply_to_message_id, poll.messageId)
  assert.match(answer.content as string, /^<b>Answer<\/b>\n<tg-spoiler>✅ Foul/)
})

test('answer: no link preview card', async () => {
  latestQuiz = latest({ questionId: 'r9_01' })
  await service().answerLatest()
  assert.deepEqual(calls[0].options.link_preview_options, { is_disabled: true })
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
  assert.equal(calls[0].options.reply_to_message_id, 60)
})

test('posting arms the answer from the post itself, before search can see the new poll', async () => {
  latestQuiz = undefined // search has not indexed the poll yet
  const quiz = service()
  const posted = await quiz.postNext()
  const quizMessageId = calls.find(c => c.method === 'sendPoll')?.messageId
  assert.ok(quizMessageId)

  latestQuiz = latest({ messageId: quizMessageId, questionId: posted.id }) // indexed by answer time
  calls = []
  mock.timers.tick(59 * 60_000)
  await flush()
  assert.equal(calls.length, 0, 'not before the delay')
  mock.timers.tick(60_000)
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.reply_to_message_id, quizMessageId)
})

test('/answer_rule right after /send_rule answers the new poll, before search can see it', async () => {
  const quiz = service()
  const posted = await quiz.postNext()
  const quizMessageId = calls.find(c => c.method === 'sendPoll')?.messageId

  // Search lags: the newest poll it sees is an older /test_rule preview, answered with it
  latestQuiz = latest({ messageId: 10, answered: true })
  calls = []
  const answered = await quiz.answerLatest()

  assert.equal(answered?.id, posted.id)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].options.reply_to_message_id, quizMessageId)
})

test('an answered poll is not answered again, even before search sees the answer', async () => {
  const quiz = service()
  const posted = await quiz.postNext()
  const quizMessageId = calls.find(c => c.method === 'sendPoll')?.messageId
  assert.ok(await quiz.answerLatest())

  latestQuiz = latest({ messageId: quizMessageId, questionId: posted.id }) // search: no answer yet
  calls = []
  assert.equal(await quiz.answerLatest(), undefined)
  mock.timers.tick(60 * 60_000) // the timer then fires
  await flush()
  assert.equal(calls.length, 0)
})
