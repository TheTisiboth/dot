import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Api } from 'telegram'
import type { Api as BotApi } from 'grammy'
import { type MtprotoClient, ReactionReader } from '../src/services/ReactionReader'
import { CANCELLATION_SIGNATURE, EMOJIS, MARKERS } from '../src/utils/constants'
import { HOUR_MS } from './helpers/clock'
import { SUMMER_TRAINING, beforeTraining } from './fixtures/dates'

interface Line { id: number; at: Date; text: string; fromBot?: boolean; replyTo?: number }

const BOT = 'bot-peer'
const POST_ID = 1
const unixSeconds = (date: Date) => Math.floor(date.getTime() / 1000)

const asMessage = ({ id, at, text, replyTo }: Line): Api.Message =>
  new Api.Message({
    id,
    date: unixSeconds(at),
    message: text,
    ...(replyTo && { replyTo: new Api.MessageReplyHeader({ replyToMsgId: replyTo }) })
  })

/** A chat history behind a stand-in of messages.search: sender filter, newest first, paged by offset id. */
const readerOver = (lines: Line[], getMe: BotApi['getMe'] = async () => ({ username: 'dot_bot' }) as never) => {
  const searches: number[] = []
  const client = {
    connected: true,
    connect: async () => undefined,
    getDialogs: async () => [],
    getInputEntity: async (target: unknown) => typeof target === 'string' ? BOT : 'chat-peer',
    invoke: async (request: Api.messages.Search) => {
      searches.push(request.offsetId)
      const messages = lines
        .filter(line => request.fromId !== BOT || line.fromBot)
        .filter(line => request.offsetId === 0 || line.id < request.offsetId)
        .sort((a, b) => b.id - a.id)
        .slice(0, request.limit)
        .map(asMessage)
      return { messages }
    }
  }
  // The library boundary: the fake implements only the GramJS methods the reader calls
  const reader = new ReactionReader({ getMe }, client as unknown as MtprotoClient)
  return { reader, searches }
}

const trainingPost: Line = { id: POST_ID, at: beforeTraining(24 * HOUR_MS), text: `Training tomorrow ${EMOJIS.THUMBS_UP}`, fromBot: true }

/** 150 messages from the team after the post, some with a 👍 of their own. */
const chatter = (fromId: number, at: Date): Line[] =>
  Array.from({ length: 150 }, (_, i) => ({ id: fromId + i, at, text: `${EMOJIS.THUMBS_UP} me too` }))

test('the training post is found behind 150 messages from other people', async () => {
  const { reader } = readerOver([trainingPost, ...chatter(2, beforeTraining(20 * HOUR_MS))])

  assert.equal(await reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), POST_ID)
})

test('the key request posted after the training post is not taken for it', async () => {
  const keyRequest = { id: 2, at: beforeTraining(24 * HOUR_MS), text: `${MARKERS.KEY} Who has the key? ${EMOJIS.CRYING} ${EMOJIS.THUMBS_UP}`, fromBot: true }
  const { reader } = readerOver([trainingPost, keyRequest])

  assert.equal(await reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), POST_ID)
})

test('a bot reply carrying a 👍 is not taken for the training post', async () => {
  const reply = { id: 3, at: beforeTraining(3 * HOUR_MS), text: `Only 2 ${EMOJIS.THUMBS_UP}`, fromBot: true, replyTo: POST_ID }
  const { reader } = readerOver([trainingPost, reply])

  assert.equal(await reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), POST_ID)
})

test('a training post from before the lookback window is not taken, and older pages are not read', async () => {
  const older = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, at: beforeTraining(7 * 24 * HOUR_MS), text: EMOJIS.THUMBS_UP, fromBot: true }))
  const { reader, searches } = readerOver(older)

  assert.equal(await reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), undefined)
  assert.equal(searches.length, 1)
})

test('the reminder reply is found behind 150 messages from other people, so it is sent once', async () => {
  const lines = [trainingPost, ...chatter(2, beforeTraining(20 * HOUR_MS))]
  const { reader } = readerOver(lines)
  assert.equal(await reader.hasBotReplyTo('-100', undefined, POST_ID), false)

  lines.push({ id: 200, at: beforeTraining(3 * HOUR_MS), text: 'reminder', fromBot: true, replyTo: POST_ID }, ...chatter(201, beforeTraining(2 * HOUR_MS)))
  assert.equal(await reader.hasBotReplyTo('-100', undefined, POST_ID), true)
})

test('the cancellation is found behind 150 messages, only when sent after `since`', async () => {
  const since = beforeTraining(2 * HOUR_MS)
  const cancellation = (at: Date): Line => ({ id: 1, at, text: `${CANCELLATION_SIGNATURE} …`, fromBot: true })

  const recent = readerOver([cancellation(beforeTraining(HOUR_MS)), ...chatter(2, beforeTraining(HOUR_MS / 2))]).reader
  assert.equal(await recent.hasBotMessageContaining('-200', undefined, CANCELLATION_SIGNATURE, since), true)

  const stale = readerOver([cancellation(beforeTraining(7 * 24 * HOUR_MS))]).reader
  assert.equal(await stale.hasBotMessageContaining('-200', undefined, CANCELLATION_SIGNATURE, since), false)
})

test('a failed bot username lookup is retried on the next search', async () => {
  let attempts = 0
  const { reader } = readerOver([trainingPost], async () => {
    attempts++
    if (attempts === 1) throw new Error('Bot API down')
    return { username: 'dot_bot' } as never
  })

  await assert.rejects(reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), /Bot API down/)
  assert.equal(await reader.findPollMessage('-100', undefined, SUMMER_TRAINING.at), POST_ID)
  assert.equal(attempts, 2)
})
