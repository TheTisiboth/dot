import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from 'telegram'
import { ReactionReader } from '../src/services/ReactionReader'
import { quizTag } from '../src/utils/quizTag'

const BOT_ID = '1000'

const poll = (text: string): Api.MessageMediaPoll =>
  new Api.MessageMediaPoll({
    poll: new Api.Poll({ id: 1 as never, question: new Api.TextWithEntities({ text, entities: [] }), answers: [] }),
    results: new Api.PollResults({})
  })

const message = (fields: { senderId?: string; post?: boolean; media?: Api.TypeMessageMedia; message?: string }): Api.Message =>
  fields as unknown as Api.Message

// Skips the constructor, which would open an MTProto client
const readerWith = (messages: Api.Message[]): ReactionReader =>
  Object.assign(Object.create(ReactionReader.prototype) as ReactionReader, {
    botId: BOT_ID,
    fetchMessages: async () => messages
  })

test('history: ids of the bot quiz polls, newest first, everything else ignored', async () => {
  const reader = readerWith([
    message({ senderId: BOT_ID, media: poll(`🟢 Easy${quizTag('r1_01')}\n\nQ?`) }),
    message({ senderId: BOT_ID, message: `🟢 Easy${quizTag('long_text')}\n\nlong question` }),
    message({ senderId: '42', media: poll(`🟢 Easy${quizTag('someone_else')}\n\nQ?`) }),
    message({ senderId: BOT_ID, media: poll('A poll without a tag') }),
    message({ post: true, media: poll(`🔴 Hard${quizTag('channel_post')}\n\nQ?`) }),
    message({ senderId: BOT_ID, media: poll(`🟡 Medium${quizTag('sig_01')}\n\nQ?`) })
  ])

  assert.deepEqual(await reader.getAskedQuizIds('-400', '7'), ['r1_01', 'channel_post', 'sig_01'])
})
