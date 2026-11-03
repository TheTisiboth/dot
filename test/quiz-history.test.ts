import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from 'telegram'
import { ReactionReader } from '../src/services/ReactionReader'
import { quizTag } from '../src/utils/quizTag'

const poll = (text: string): Api.MessageMediaPoll =>
  new Api.MessageMediaPoll({
    poll: new Api.Poll({ id: 1 as never, question: new Api.TextWithEntities({ text, entities: [] }), answers: [] }),
    results: new Api.PollResults({})
  })

const message = (fields: { media?: Api.TypeMessageMedia; message?: string }): Api.Message =>
  fields as unknown as Api.Message

test('history: ids of the quiz polls among the bot messages, newest first', async () => {
  let searched: unknown[] = []
  // Skips the constructor, which would open an MTProto client
  const reader = Object.assign(Object.create(ReactionReader.prototype) as ReactionReader, {
    searchBotMessages: async (...args: unknown[]) => {
      searched = args
      return [
        message({ media: poll(`🟢 Easy${quizTag('r1_01')}\n\nQ?`) }),
        message({ message: `🟢 Easy${quizTag('long_text')}\n\nlong question` }),
        message({ media: poll('A poll without a tag') }),
        message({ message: 'An answer post' }),
        message({ media: poll(`🟡 Medium${quizTag('sig_01')}\n\nQ?`) })
      ]
    }
  })

  assert.deepEqual(await reader.getAskedQuizIds('-400', '7', 'quiz_bot'), ['r1_01', 'sig_01'])
  assert.deepEqual(searched, ['-400', '7', 'quiz_bot'])
})

const reply = (id: number, replyToMsgId: number): Api.Message =>
  ({ id, date: 1_800_000_000, replyTo: new Api.MessageReplyHeader({ replyToMsgId }) }) as unknown as Api.Message

const readerReturning = (messages: Api.Message[]): ReactionReader =>
  Object.assign(Object.create(ReactionReader.prototype) as ReactionReader, { searchBotMessages: async () => messages })

const quizPoll = (id: number, questionId: string, fields: { replyToMsgId?: number } = {}): Api.Message =>
  ({
    id,
    date: 1_800_000_000,
    media: poll(`🟢 Easy${quizTag(questionId)}\n\nQ?`),
    ...(fields.replyToMsgId && { replyTo: new Api.MessageReplyHeader({ replyToMsgId: fields.replyToMsgId }) })
  }) as unknown as Api.Message

test('latest quiz: the newest poll, not answered yet', async () => {
  const latest = await readerReturning([
    quizPoll(20, 'r1_02', { replyToMsgId: 19 }), // replies to its own photo
    message({ message: 'photo' }),
    reply(12, 10),
    quizPoll(10, 'r1_01')
  ]).getLatestQuiz('-400', '7', 'quiz_bot')

  assert.deepEqual(latest, { messageId: 20, questionId: 'r1_02', postedAt: new Date(1_800_000_000_000), answered: false })
})

test('latest quiz: answered once the bot replied to it', async () => {
  const latest = await readerReturning([reply(21, 20), quizPoll(20, 'r1_02')]).getLatestQuiz('-400', '7', 'quiz_bot')
  assert.equal(latest?.answered, true)
})

test('latest quiz: none posted', async () => {
  assert.equal(await readerReturning([message({ message: 'hello' })]).getLatestQuiz('-400', '7', 'quiz_bot'), undefined)
})
