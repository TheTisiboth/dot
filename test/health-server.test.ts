import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { type AddressInfo } from 'node:net'
import { Api } from 'grammy'
import { startHealthServer, type HealthDependencies } from '../src/services/HealthServer'
import { pollingOutageLogger } from '../src/utils/telegram'

const PROBE_TIMEOUT_MS = 50
const never = () => new Promise<never>(() => {})
const down = async () => { throw new Error('unreachable') }

interface Check { status: string }
interface Body { status: string; checks: Record<'telegram' | 'mtproto' | 'ollama', Check> }

interface Scenario { telegram?: () => Promise<unknown>; mtproto?: boolean; ollama?: (() => Promise<void>) | 'disabled' }

const dependencies = ({ telegram = async () => ({}), mtproto = true, ollama = async () => {} }: Scenario = {}): HealthDependencies => ({
  api: { getMe: telegram } as HealthDependencies['api'],
  reader: { isConnected: () => mtproto },
  messageGenerator: {
    isLLMAvailable: () => ollama !== 'disabled',
    testOllamaConnection: ollama === 'disabled' ? down : ollama
  }
})

afterEach(() => { mock.restoreAll() })

const get = async (scenario: Scenario, path: string) => {
  mock.method(console, 'log', () => {})
  const server = startHealthServer(dependencies(scenario), 0, PROBE_TIMEOUT_MS)
  await once(server, 'listening')
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`)
    return { code: response.status, body: await response.json() as Body }
  } finally {
    server.close()
  }
}

test('/health is 200 and every dependency ok when all answer', async () => {
  const { code, body } = await get({}, '/health')

  assert.equal(code, 200)
  assert.deepEqual(Object.values(body.checks).map(check => check.status), ['ok', 'ok', 'ok'])
})

test('/health stays 200 with Ollama down, and /health/ollama is 503', async () => {
  const all = await get({ ollama: down }, '/health')
  assert.equal(all.code, 200)
  assert.equal(all.body.checks.ollama.status, 'down')

  assert.equal((await get({ ollama: down }, '/health/ollama')).code, 503)
})

test('/health stays 200 with Ollama disabled, and /health/ollama is 503', async () => {
  const all = await get({ ollama: 'disabled' }, '/health')
  assert.equal(all.code, 200)
  assert.equal(all.body.checks.ollama.status, 'disabled')

  assert.equal((await get({ ollama: 'disabled' }, '/health/ollama')).code, 503)
})

test('/health stays 200 with MTProto disconnected, and /health/mtproto is 503', async () => {
  const all = await get({ mtproto: false }, '/health')
  assert.equal(all.code, 200)
  assert.equal(all.body.checks.mtproto.status, 'down')

  assert.equal((await get({ mtproto: false }, '/health/mtproto')).code, 503)
})

test('/health is 503 when Telegram is down', async () => {
  const { code, body } = await get({ telegram: down }, '/health')

  assert.equal(code, 503)
  assert.equal(body.checks.telegram.status, 'down')
})

test('/health answers 503 within the timeout when Telegram hangs', async () => {
  const { code, body } = await get({ telegram: never, ollama: never }, '/health')

  assert.equal(code, 503)
  assert.equal(body.checks.ollama.status, 'down')
})

test('an unknown dependency is 404', async () => {
  assert.equal((await get({}, '/health/nope')).code, 404)
})

const replies: Array<'ok' | 'refused' | 'unreachable'> = []
const api = new Api('1000:test-token', {
  fetch: (async () => {
    const reply = replies.shift()
    if (reply === 'unreachable') throw new Error('network down')
    const body = reply === 'refused' ? { ok: false, error_code: 502, description: 'Bad Gateway' } : { ok: true, result: [] }
    return new Response(JSON.stringify(body))
  }) as unknown as typeof fetch
})
api.config.use(pollingOutageLogger())

test('a polling outage logs once per failure streak, and once on recovery', async () => {
  const warnings = mock.method(console, 'warn', () => {})
  const infos = mock.method(console, 'log', () => {})
  replies.push('unreachable', 'refused', 'unreachable', 'ok', 'ok', 'refused')

  for (let poll = 0; poll < 6; poll++) await api.getUpdates().catch(() => {})

  assert.equal(warnings.mock.callCount(), 2)
  assert.equal(infos.mock.callCount(), 1)
})
