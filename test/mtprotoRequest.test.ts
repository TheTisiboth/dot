import './helpers/testEnv'
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { type MtprotoClient, MtprotoConnection } from '../src/telegram/mtproto/client'
import { History } from '../src/telegram/mtproto/history'
import { trainingHistory } from '../src/training/history'

const flush = async () => await new Promise(resolve => setImmediate(resolve))

interface FakeClient {
  connected: boolean;
  connects: number;
  disconnects: number;
  reads: number;
}

const unusedBot = { getMe: async () => { throw new Error('not called') } }

/** A connected reader over a GramJS client stand-in: `read` answers each getMessages call, in order. */
const readerWith = async (read: (attempt: number) => Promise<unknown[]>, state: Partial<FakeClient> = {}) => {
  const client: FakeClient & Record<string, unknown> = {
    connected: false,
    connects: 0,
    disconnects: 0,
    reads: 0,
    connect: async () => { client.connects++; client.connected = true },
    getDialogs: async () => [],
    disconnect: async () => { client.disconnects++; client.connected = false },
    getInputEntity: async () => ({}),
    getMessages: async () => await read(++client.reads)
  }
  // The library boundary: the fake implements only the GramJS methods the reader calls
  const connection = new MtprotoConnection(client as unknown as MtprotoClient)
  const reader = trainingHistory(new History(unusedBot, connection))
  await connection.connect()
  Object.assign(client, { connects: 0, ...state })
  return { reader, client }
}

const never = async (): Promise<never> => await new Promise<never>(() => undefined)

beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }) })
afterEach(() => { mock.timers.reset() })

test('a request on a dead connection times out, reconnects and retries once', async () => {
  const { reader, client } = await readerWith(async attempt => attempt === 1 ? await never() : [])

  const count = reader.getThumbsUpCount('-100', 5)
  await flush()
  mock.timers.tick(30_000)

  assert.equal(await count, 0)
  assert.equal(client.reads, 2)
  assert.equal(client.disconnects, 1)
  assert.equal(client.connects, 1)
})

test('a request that hangs again after reconnecting is rejected, never left pending', async () => {
  const { reader, client } = await readerWith(never)

  const count = assert.rejects(reader.getThumbsUpCount('-100', 5), /timed out/)
  await flush()
  mock.timers.tick(30_000)
  await flush()
  await flush()
  mock.timers.tick(30_000)
  await count

  assert.equal(client.reads, 2)
})

test('a Telegram error is not retried: a new connection would fail the same way', async () => {
  const { reader, client } = await readerWith(async () => { throw new Error('CHANNEL_PRIVATE') })

  await assert.rejects(reader.getThumbsUpCount('-100', 5), /CHANNEL_PRIVATE/)
  assert.equal(client.reads, 1)
  assert.equal(client.connects, 0)
})

test('a client GramJS gave up reconnecting is reopened before the request', async () => {
  const { reader, client } = await readerWith(async () => [], { connected: false })

  assert.equal(await reader.getThumbsUpCount('-100', 5), 0)
  assert.equal(client.connects, 1)
  assert.equal(client.reads, 1)
})
