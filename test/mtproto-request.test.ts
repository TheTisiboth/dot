import './helpers/testEnv'
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { ReactionReader } from '../src/services/ReactionReader'

const flush = async () => await new Promise(resolve => setImmediate(resolve))

interface FakeClient {
  connected: boolean;
  connects: number;
  disconnects: number;
  reads: number;
}

/** A GramJS client stand-in: `read` answers each getMessages call, in order. */
const readerWith = (read: (attempt: number) => Promise<unknown[]>, state: Partial<FakeClient> = {}) => {
  const client: FakeClient & Record<string, unknown> = {
    connected: true,
    connects: 0,
    disconnects: 0,
    reads: 0,
    ...state,
    connect: async () => { client.connects++; client.connected = true },
    getDialogs: async () => [],
    disconnect: async () => { client.disconnects++; client.connected = false },
    getInputEntity: async () => ({}),
    getMessages: async () => await read(++client.reads)
  }
  // Skips the constructor, which would open an MTProto client
  const reader = Object.assign(Object.create(ReactionReader.prototype) as ReactionReader, {
    client,
    connected: true,
    botId: '1000'
  })
  return { reader, client }
}

const never = async (): Promise<never> => await new Promise<never>(() => undefined)

beforeEach(() => { mock.timers.enable({ apis: ['setTimeout'] }) })
afterEach(() => { mock.timers.reset() })

test('a request on a dead connection times out, reconnects and retries once', async () => {
  const { reader, client } = readerWith(async attempt => attempt === 1 ? await never() : [])

  const count = reader.getThumbsUpCount('-100', 5)
  await flush()
  mock.timers.tick(30_000)

  assert.equal(await count, 0)
  assert.equal(client.reads, 2)
  assert.equal(client.disconnects, 1)
  assert.equal(client.connects, 1)
})

test('a request that hangs again after reconnecting is rejected, never left pending', async () => {
  const { reader, client } = readerWith(never)

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
  const { reader, client } = readerWith(async () => { throw new Error('CHANNEL_PRIVATE') })

  await assert.rejects(reader.getThumbsUpCount('-100', 5), /CHANNEL_PRIVATE/)
  assert.equal(client.reads, 1)
  assert.equal(client.connects, 0)
})

test('a client GramJS gave up reconnecting is reopened before the request', async () => {
  const { reader, client } = readerWith(async () => [], { connected: false })

  assert.equal(await reader.getThumbsUpCount('-100', 5), 0)
  assert.equal(client.connects, 1)
  assert.equal(client.reads, 1)
})
