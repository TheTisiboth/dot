import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type Api, GrammyError, InputFile } from 'grammy'
import { senderFor } from '../src/telegram/sender'

const TOPIC = { chatId: '-100', threadId: 7 }

/** Records each Bot API call with its arguments; `rejectParse` makes the next sendMessage fail as unparsable HTML. */
const makeApi = ({ rejectParse = false } = {}) => {
  const calls: Array<{ method: string; args: unknown[] }> = []
  let rejecting = rejectParse
  const record = (method: string) => async (...args: unknown[]) => {
    if (method === 'sendMessage' && rejecting) {
      rejecting = false
      const description = "Bad Request: can't parse entities"
      throw new GrammyError(description, { ok: false, error_code: 400, description }, 'sendMessage', {})
    }
    calls.push({ method, args })
    return { message_id: 40 + calls.length }
  }
  // The library boundary: the fake implements only the send methods
  const api = { sendMessage: record('sendMessage'), sendPhoto: record('sendPhoto'), sendPoll: record('sendPoll') } as unknown as Api
  return { api, calls }
}

test('text goes as HTML to the topic, replying, without link preview when asked, and resolves to the message id', async () => {
  const { api, calls } = makeApi()

  const id = await senderFor(api, TOPIC).text('<b>hi</b>', { replyTo: 3, linkPreview: false })

  assert.equal(id, 41)
  assert.deepEqual(calls, [{
    method: 'sendMessage',
    args: ['-100', '<b>hi</b>', { parse_mode: 'HTML', message_thread_id: 7, reply_to_message_id: 3, link_preview_options: { is_disabled: true } }]
  }])
})

test('text Telegram cannot parse is replaced by its fallback, same options', async () => {
  const { api, calls } = makeApi({ rejectParse: true })

  await senderFor(api, TOPIC).text('<b>broken', { fallback: () => 'template' })

  assert.deepEqual(calls, [{ method: 'sendMessage', args: ['-100', 'template', { parse_mode: 'HTML', message_thread_id: 7 }] }])
})

test('a parse error without fallback is thrown', async () => {
  const { api } = makeApi({ rejectParse: true })

  await assert.rejects(senderFor(api, TOPIC).text('<b>broken'), GrammyError)
})

test('plain text has no parse mode, and no topic or reply options when there are none', async () => {
  const { api, calls } = makeApi()

  await senderFor(api, { chatId: '-100' }).plain('a < b')

  assert.deepEqual(calls, [{ method: 'sendMessage', args: ['-100', 'a < b', {}] }])
})

test('photo sends the local file with an HTML caption behind a spoiler', async () => {
  const { api, calls } = makeApi()

  await senderFor(api, TOPIC).photo('img.png', { caption: '<b>A</b>', spoiler: true, replyTo: 3 })

  const [{ method, args: [chatId, file, options] }] = calls
  assert.equal(method, 'sendPhoto')
  assert.equal(chatId, '-100')
  assert.ok(file instanceof InputFile)
  assert.deepEqual(options, { message_thread_id: 7, reply_to_message_id: 3, caption: '<b>A</b>', parse_mode: 'HTML', has_spoiler: true })
})

test('poll is an anonymous quiz pointing at the right option', async () => {
  const { api, calls } = makeApi()

  await senderFor(api, TOPIC).poll('Q?', ['a', 'b'], { correctOptionId: 1, replyTo: 3 })

  assert.deepEqual(calls, [{
    method: 'sendPoll',
    args: ['-100', 'Q?', ['a', 'b'], { message_thread_id: 7, reply_to_message_id: 3, is_anonymous: true, type: 'quiz', correct_option_ids: [1] }]
  }])
})
