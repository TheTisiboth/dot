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
