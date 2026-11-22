import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { quizStats } from '../src/quiz/stats'
import { type QuizBatch, type QuizDifficulty, type QuizMode, type QuizQuestion } from '../src/quiz/question'
import { type AskedQuiz, type QuizHistory } from '../src/quiz/history'
import { pickQuestion } from '../src/quiz/picker'
import { RulesQuizService } from '../src/quiz/service'
import { QUIZ_STATS_TIMEOUT_MS, quizCommands } from '../src/commands/quiz'
import { routeCommands } from '../src/commands/registry'
import { SeasonManager } from '../src/training/season'
import { EMOJIS } from '../src/shared/emojis'
import { makeFakeBot } from './fakes/bot'
import { makeFakeQuizPublisher } from './fakes/rulesQuiz'
import { beforeTraining } from './fixtures/dates'
import { HOUR_MS, settle, startAt } from './helpers/clock'
import { testConfig } from './fixtures/config'

const question = (id: string, difficulty: QuizDifficulty, modes: QuizMode[]): QuizQuestion =>
  ({ id, difficulty, modes, question: `${id}?`, answer: 'yes', wrong: ['no'] })

const batch = (name: string, questions: QuizQuestion[]): QuizBatch => ({ name, source: { title: name, url: 'https://example.org' }, questions })

const BOTH: QuizMode[] = ['outdoor', 'indoor']
// Outdoor asks s1 s2 r1 r2, indoor s1 s2 i1 r1
const BANK = [
  batch('Signals', [question('s1', 'easy', BOTH), question('s2', 'hard', BOTH)]),
  batch('Indoor', [question('i1', 'medium', ['indoor'])]),
  batch('Rules', [question('r1', 'easy', BOTH), question('r2', 'medium', ['outdoor'])])
]
const isSignal = (id: string): boolean => id.startsWith('s')

const asked = (...ids: string[]): AskedQuiz[] => ids.map((questionId, index) => ({ questionId, askedAt: new Date(2027, 0, 30 - index) }))

const outdoorOf = (history: AskedQuiz[], isFocus?: (id: string) => boolean) => {
  const stats = quizStats(BANK, history, 'outdoor', isFocus).modes.find(mode => mode.mode === 'outdoor')
  assert.ok(stats)
  return stats
}

const tallies = (items: Array<{ asked: number; total: number }>) => items.map(({ asked, total }) => [asked, total])

test('quiz stats: with an empty history, every mode starts its first round with nothing asked', () => {
  const stats = quizStats(BANK, [], 'outdoor')

  assert.deepEqual(stats.modes.map(({ mode, rounds }) => [mode, rounds.map(round => [round.completed, round.asked, round.total])]), [
    ['outdoor', [[0, 0, 4]]],
    ['indoor', [[0, 0, 4]]]
  ])
  assert.deepEqual(stats.latest, [])
})

test('quiz stats: mid-round, counts the questions asked per source and difficulty, each once', () => {
  const outdoor = outdoorOf(asked('s1', 'r2', 's1', 'i1'))

  assert.deepEqual(outdoor.rounds.map(round => [round.completed, round.asked]), [[0, 2]])
  assert.deepEqual(outdoor.bySource.map(source => source.name), ['Signals', 'Rules'], 'a source the mode never asks is left out')
  assert.deepEqual(tallies(outdoor.bySource), [[1, 2], [1, 2]])
  assert.deepEqual(outdoor.byDifficulty.map(level => [level.difficulty, level.asked, level.total]), [['easy', 1, 2], ['medium', 1, 1], ['hard', 0, 1]])
})

test('quiz stats: once every question of the mode was asked, the round counts as completed and the next starts empty', () => {
  const outdoor = outdoorOf(asked('s1', 's2', 'r1', 'r2'))
  assert.deepEqual(outdoor.rounds.map(round => [round.completed, round.asked]), [[1, 0]])
})

test('quiz stats: the round wraps like the picker, so questions asked again count in the new round', () => {
  const history = asked('s2', 's1', 's2', 'r1', 'r2', 's1')
  const outdoor = outdoorOf(history)

  assert.deepEqual(outdoor.rounds.map(round => [round.completed, round.asked]), [[1, 2]])
  const next = pickQuestion(BANK.flatMap(b => b.questions), 'outdoor', history.map(q => q.questionId))
  assert.ok(['r1', 'r2'].includes(next.id), 'the picker draws from what the stats count as left')
})

test('quiz stats: a question removed from the bank counts nowhere, but is still listed among the latest', () => {
  const stats = quizStats(BANK, asked('gone', 'r1'), 'outdoor')
  const outdoor = stats.modes.find(mode => mode.mode === 'outdoor')

  assert.deepEqual(outdoor?.rounds.map(round => round.asked), [1])
  assert.deepEqual(stats.latest.map(q => q.questionId), ['gone', 'r1'])
})

test('quiz stats: with signals every other, signals and the other questions each run their own round', () => {
  const outdoor = outdoorOf(asked('s1', 'r1', 's2', 's1'), isSignal)

  assert.deepEqual(outdoor.rounds.map(round => [round.focus, round.completed, round.asked, round.total]), [[true, 1, 1, 2], [false, 0, 1, 2]])
})

test('quiz stats: lists the 5 newest questions asked, newest first', () => {
  const stats = quizStats(BANK, asked('s1', 's2', 'r1', 'r2', 'i1', 's1', 's2'), 'outdoor')
  assert.deepEqual(stats.latest.map(q => q.questionId), ['s1', 's2', 'r1', 'r2', 'i1'])
})

const build = ({ mtprotoUp = true, read = async (): Promise<AskedQuiz[]> => asked('r1_01', 'sig_01') } = {}) => {
  const config = testConfig()
  const bot = makeFakeBot()
  let reads = 0
  const history: QuizHistory = {
    getAskedQuizzes: async () => { reads++; return await read() },
    getLatestQuiz: async () => undefined
  }
  const publisher = makeFakeQuizPublisher()
  const rulesQuiz = new RulesQuizService(config.rulesQuiz, publisher, new SeasonManager(config), history)
  routeCommands(bot, quizCommands(rulesQuiz, publisher, () => mtprotoUp), config.telegram.adminChatId)

  const admin = { chatId: Number(config.telegram.adminChatId) }
  const stats = async (): Promise<string> => {
    await bot.command('/quiz_stats', admin)
    return replyIn(bot, admin.chatId)
  }
  return { bot, admin, stats, reads: () => reads }
}

const replyIn = (bot: ReturnType<typeof makeFakeBot>, chatId: number): string => {
  const replies = bot.sentTo(chatId)
  assert.equal(replies.length, 1)
  return replies[0].text
}

afterEach(() => { mock.timers.reset() })

test('/quiz_stats reads the rules chat history once and shows both modes and the latest questions', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { stats, reads } = build()

  const reply = await stats()

  assert.equal(reads(), 1)
  assert.ok(reply.includes('Outdoor') && reply.includes('Indoor'))
  assert.ok(reply.includes('r1_01') && reply.includes('sig_01'))
  assert.equal(reply.includes(EMOJIS.WARNING), false)
})

test('/quiz_stats with MTProto down says it cannot read the history, without trying', async () => {
  const { stats, reads } = build({ mtprotoUp: false })

  const reply = await stats()

  assert.equal(reads(), 0)
  assert.ok(reply.includes(EMOJIS.WARNING))
})

test('/quiz_stats on a hung history read answers once the read times out', async () => {
  startAt(beforeTraining(24 * HOUR_MS))
  const { bot, admin } = build({ read: async () => await new Promise<never>(() => undefined) })

  const typed = bot.command('/quiz_stats', admin)
  await settle()
  mock.timers.tick(QUIZ_STATS_TIMEOUT_MS)
  await typed

  assert.ok(replyIn(bot, admin.chatId).includes(EMOJIS.WARNING))
})

test('/quiz_stats on a failed history read says it cannot read the history', async () => {
  const { stats } = build({ read: async () => { throw new Error('MTProto down') } })
  assert.ok((await stats()).includes(EMOJIS.WARNING))
})
