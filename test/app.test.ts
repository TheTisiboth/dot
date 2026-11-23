import './helpers/testEnv'
import { test, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { Bot, type Transformer } from 'grammy'
import { SHUTDOWN_DEADLINE_MS, buildApp } from '../src/app'
import type { MtprotoClient } from '../src/telegram/mtproto/client'
import { testConfig } from './fixtures/config'
import { settle } from './helpers/clock'

afterEach(() => { mock.timers.reset() })

const RESULTS: Record<string, unknown> = {
  getMe: { id: 1, is_bot: true, first_name: 'Dot', username: 'dot_bot' },
  getUpdates: []
}

/** A grammY bot whose every Bot API call is answered offline; a long poll waits until polling stops. */
const offlineBot = () => {
  const bot = new Bot('1000:test-token')
  const offline: Transformer = async (_prev, method, payload, signal) => {
    if (method === 'getUpdates' && 'timeout' in payload) await new Promise(resolve => { signal?.addEventListener('abort', resolve) })
    // The library boundary: each method's result type is generic over the method name
    return { ok: true, result: RESULTS[method] ?? true } as Awaited<ReturnType<Transformer>>
  }
  bot.api.config.use(offline)
  return bot
}

/** A GramJS client stand-in with an empty history; `disconnect` can be made to hang. */
const fakeMtproto = ({ disconnect = async () => {} }: { disconnect?: () => Promise<void> } = {}) => {
  const client = {
    connected: false,
    connect: async () => { client.connected = true },
    disconnect,
    getDialogs: async () => [],
    getInputEntity: async () => ({}),
    invoke: async () => ({ messages: [] }),
    getMessages: async () => []
  }
  // The library boundary: the fake implements only the GramJS methods the app calls
  return client as unknown as MtprotoClient
}

/** The handles open now that were not in `before`; the runner's own come and go. */
const openedSince = (before: string[]) => {
  const left = [...before]
  return process.getActiveResourcesInfo().filter(handle => {
    // A file read or write in flight (the coverage writer's) ends by itself: it is no open handle
    if (handle.startsWith('FSReq')) return false
    const index = left.indexOf(handle)
    if (index === -1) return true
    left.splice(index, 1)
    return false
  })
}

test('a started app, once stopped, leaves no open handle: polling, cron, timers, health server, MTProto', async () => {
  const before = process.getActiveResourcesInfo()
  const bot = offlineBot()
  let disconnected = false
  const app = buildApp(testConfig(), { bot, mtproto: fakeMtproto({ disconnect: async () => { disconnected = true } }), ollama: null }, 0)

  await app.start(error => { assert.fail(`polling stopped: ${String(error)}`) })
  assert.ok(bot.isRunning())
  assert.notDeepEqual(openedSince(before), [])

  await app.stop()
  await settle()

  assert.equal(bot.isRunning(), false)
  assert.ok(disconnected)
  assert.deepEqual(openedSince(before), [])
})

test('stop resolves within the deadline when the MTProto disconnect hangs', async () => {
  // Before building: timers armed for real could not be cleared once setTimeout is mocked
  mock.timers.enable({ apis: ['setTimeout'] })
  const app = buildApp(testConfig(), { bot: offlineBot(), mtproto: fakeMtproto({ disconnect: () => new Promise(() => {}) }), ollama: null }, 0)
  await app.start(error => { assert.fail(`polling stopped: ${String(error)}`) })

  let stopped = false
  const stopping = app.stop().then(() => { stopped = true })
  await settle()
  assert.equal(stopped, false)

  mock.timers.tick(SHUTDOWN_DEADLINE_MS)
  await stopping
  assert.ok(stopped)
})
