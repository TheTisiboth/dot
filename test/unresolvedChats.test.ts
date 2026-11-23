import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { type MtprotoClient, MtprotoConnection } from '../src/telegram/mtproto/client'
import { History } from '../src/telegram/mtproto/history'

const KNOWN_CHATS = new Set([-100, -200])

const historyKnowing = () => {
  const client = {
    connected: true,
    connect: async () => undefined,
    getDialogs: async () => [],
    getInputEntity: async (chatId: number) => {
      if (!KNOWN_CHATS.has(chatId)) throw new Error(`Could not find the input entity for ${chatId}`)
      return {}
    }
  }
  const bot = { getMe: async () => { throw new Error('not called') } }
  // The library boundary: the fake implements only the GramJS methods the history calls
  return new History(bot, new MtprotoConnection(client as unknown as MtprotoClient))
}

test('a configured chat the account cannot resolve is reported by name, with its error', async () => {
  const unresolved = await historyKnowing().unresolvedChats({ team: '-100', trainer: '-300', rules: '-200' })

  assert.deepEqual(unresolved.map(chat => chat.name), ['trainer'])
  assert.match(String(unresolved[0].error), /-300/)
})

test('no chat is reported when the account resolves them all', async () => {
  assert.deepEqual(await historyKnowing().unresolvedChats({ team: '-100', rules: '-200' }), [])
})
