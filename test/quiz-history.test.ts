import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from 'telegram'
import { type MtprotoClient, ReactionReader } from '../src/services/ReactionReader'
import { quizTag } from '../src/utils/quizTag'

const poll = (text: string): Api.MessageMediaPoll =>
  new Api.MessageMediaPoll({
    poll: new Api.Poll({ id: 1 as never, question: new Api.TextWithEntities({ text, entities: [] }), answers: [] }),
    results: new Api.PollResults({})
  })

const message = (id: number, fields: { media?: Api.TypeMessageMedia; message?: string }): Api.Message =>
  new Api.Message({ id, date: 1_800_000_000, ...fields })

/** A reader over a stand-in of messages.search answering `messages` as a single page; records the chat and topic searched. */
const readerReturning = (messages: Api.Message[]) => {
  const searches: Array<{ peer: unknown; topMsgId: unknown }> = []
  const client = {
    connected: true,
    connect: async () => undefined,
    getDialogs: async () => [],
    getInputEntity: async (target: unknown) => target,
    invoke: async ({ peer, topMsgId }: Api.messages.Search) => {
      searches.push({ peer, topMsgId })
      return { messages: searches.length === 1 ? messages : [] }
    }
  }
  const bot = { getMe: async () => ({ username: 'dot_bot' }) as never }
  // The library boundary: the fake implements only the GramJS methods the reader calls
  return { reader: new ReactionReader(bot, client as unknown as MtprotoClient), searches }
}

test('history: ids of the quiz polls among the bot messages, newest first', async () => {
  const { reader, searches } = readerReturning([
    message(5, { media: poll(`🟢 Easy${quizTag('r1_01')}\n\nQ?`) }),
    message(4, { message: `🟢 Easy${quizTag('long_text')}\n\nlong question` }),
    message(3, { media: poll('A poll without a tag') }),
    message(2, { message: 'An answer post' }),
    message(1, { media: poll(`🟡 Medium${quizTag('sig_01')}\n\nQ?`) })
  ])

  assert.deepEqual(await reader.getAskedQuizIds('-400', 7), ['r1_01', 'sig_01'])
  assert.deepEqual(searches[0], { peer: -400, topMsgId: 7 })
})

const reply = (id: number, replyToMsgId: number): Api.Message =>
  new Api.Message({ id, date: 1_800_000_000, replyTo: new Api.MessageReplyHeader({ replyToMsgId }) })

const quizPoll = (id: number, questionId: string, fields: { replyToMsgId?: number } = {}): Api.Message =>
  new Api.Message({
    id,
    date: 1_800_000_000,
    media: poll(`🟢 Easy${quizTag(questionId)}\n\nQ?`),
    ...(fields.replyToMsgId && { replyTo: new Api.MessageReplyHeader({ replyToMsgId: fields.replyToMsgId }) })
  })

const latestOf = async (messages: Api.Message[]) => await readerReturning(messages).reader.getLatestQuiz('-400', 7)

test('latest quiz: the newest poll, not answered yet', async () => {
  const latest = await latestOf([
    quizPoll(20, 'r1_02', { replyToMsgId: 19 }), // replies to its own photo
    message(19, { message: 'photo' }),
    reply(12, 10),
    quizPoll(10, 'r1_01')
  ])

  assert.deepEqual(latest, { messageId: 20, questionId: 'r1_02', postedAt: new Date(1_800_000_000_000), answered: false })
})

test('latest quiz: answered once the bot replied to it', async () => {
  const latest = await latestOf([reply(21, 20), quizPoll(20, 'r1_02')])
  assert.equal(latest?.answered, true)
})

test('latest quiz: none posted', async () => {
  assert.equal(await latestOf([message(1, { message: 'hello' })]), undefined)
})
