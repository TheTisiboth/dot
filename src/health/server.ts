import { createServer, type Server } from 'node:http'
import type { Api } from 'grammy'
import { withTimeout } from '../shared/async'
import { EMOJIS } from '../shared/emojis'
import { errorMessage, log } from '../shared/logger'
import type { MessageGenerator } from '../training/messages/messageGenerator'
import type { ReactionReader } from '../telegram/mtproto/reactionReader'

// Fixed: the compose port mapping and healthcheck use it
export const HEALTH_PORT = 3004
// Below the compose healthcheck timeout (10s), so a hanging dependency answers 503 instead of no answer
export const PROBE_TIMEOUT_MS = 5_000

type Status = 'ok' | 'disabled' | 'down'

interface Check {
  status: Status;
  responseTimeMs?: number;
  error?: string;
}

export interface HealthDependencies {
  api: Pick<Api, 'getMe'>;
  reader: Pick<ReactionReader, 'isConnected'>;
  messageGenerator: Pick<MessageGenerator, 'isLLMAvailable' | 'testOllamaConnection'>;
}

const probe = async (name: string, run: () => Promise<unknown>, timeoutMs: number): Promise<Check> => {
  const startedAt = Date.now()
  try {
    await withTimeout(run(), timeoutMs, `${name} did not answer within ${timeoutMs}ms`)
    return { status: 'ok', responseTimeMs: Date.now() - startedAt }
  } catch (error) {
    return { status: 'down', responseTimeMs: Date.now() - startedAt, error: errorMessage(error) }
  }
}

const dependencyChecks = ({ api, reader, messageGenerator }: HealthDependencies, timeoutMs: number): Record<string, () => Promise<Check>> => ({
  telegram: () => probe('Telegram', () => api.getMe(), timeoutMs),
  mtproto: async () => ({ status: reader.isConnected() ? 'ok' : 'down' }),
  ollama: async () => messageGenerator.isLLMAvailable()
    ? probe('Ollama', () => messageGenerator.testOllamaConnection(), timeoutMs)
    : { status: 'disabled' }
})

const respond = async (path: string, checks: Record<string, () => Promise<Check>>): Promise<{ code: number; body: object }> => {
  const timestamp = new Date().toISOString()
  if (path === '/health') {
    const results = Object.fromEntries(await Promise.all(Object.entries(checks).map(async ([name, check]) => [name, await check()] as const)))
    // Only Telegram is vital: without MTProto or Ollama the bot still posts, with templates as the LLM fallback
    const status = results.telegram.status === 'ok' ? 'ok' : 'down'
    return { code: status === 'ok' ? 200 : 503, body: { status, checks: results, timestamp } }
  }
  const name = path.startsWith('/health/') ? path.slice('/health/'.length) : ''
  if (!Object.hasOwn(checks, name)) return { code: 404, body: { error: 'Not found' } }
  const result = await checks[name]()
  return { code: result.status === 'ok' ? 200 : 503, body: { name, ...result, timestamp } }
}

/** `GET /health`: 503 only when Telegram is down. `GET /health/<telegram|mtproto|ollama>`: 503 when that one is not ok. */
export const startHealthServer = (dependencies: HealthDependencies, port: number, timeoutMs: number): Server => {
  const checks = dependencyChecks(dependencies, timeoutMs)
  const server = createServer((req, res) => {
    // Not `new URL`: it throws on a malformed path, outside the catch below, and would crash the bot
    respond((req.url ?? '').split('?')[0], checks)
      .then(({ code, body }) => {
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(body))
      })
      .catch((error: unknown) => {
        log.error('Health check', error)
        res.writeHead(500).end()
      })
  })
  server.listen(port, () => { log.bot(`${EMOJIS.ROBOT} Health server listening on port ${port}`) })
  return server
}
