// sessions comes from the package root: Node's ESM loader cannot import the 'telegram/sessions' directory
import { TelegramClient, sessions, Logger } from 'telegram'
// Type-only: the LogLevel enum is not re-exported from the root, and ESM cannot deep-import it without an extension
import type { LogLevel } from 'telegram/extensions/Logger'
import type { BotConfig } from '../../config/env'
import { TimeoutError, withTimeout } from '../../shared/async'
import { errorMessage, log } from '../../shared/logger'

const DIALOGS_LIMIT = 100
const CONNECT_TIMEOUT_MS = 20_000
// A request on a connection that died silently never settles: GramJS has no request timeout
const REQUEST_TIMEOUT_MS = 30_000

export type MtprotoClient = Pick<TelegramClient, 'connected' | 'connect' | 'disconnect' | 'getDialogs' | 'getInputEntity' | 'invoke' | 'getMessages'>

export function createMtprotoClient({ session, apiId, apiHash }: BotConfig['mtproto']): TelegramClient {
  const client = new TelegramClient(
    new sessions.StringSession(session),
    apiId,
    apiHash,
    // GramJS prints raw stack traces for routine keep-alive timeouts it recovers from on its own.
    // Real failures still reach us as rejected calls.
    // WebSocket on 443: networks that filter MTProto's raw TCP still let HTTPS through.
    // Retries without limit (GramJS's default): after a capped number of failed reconnects, GramJS
    // gives up for good and every later request waits forever - a few minutes offline was enough
    { connectionRetries: Infinity, useWSS: true, baseLogger: new Logger('none' as LogLevel) }
  )
  client.onError = async (error) => {
    // GramJS's idle update loop throws TIMEOUT routinely and reconnects itself
    if (error.message === 'TIMEOUT') return
    log.warn('MTProto', `Connection issue, GramJS retries on its own: ${error.message}`)
  }
  return client
}

/**
 * The user-account (MTProto) connection: connects on demand, bounds every request in time,
 * and reconnects once when a request finds it dead.
 */
export class MtprotoConnection {
  private readonly client: MtprotoClient
  private connected = false
  private connecting?: Promise<void>

  constructor(client: MtprotoClient) {
    this.client = client
  }

  async connect(): Promise<void> {
    if (this.connected) return

    // Shared: requests that time out together must not open two connections at once
    this.connecting ??= this.open().finally(() => { this.connecting = undefined })
    await this.connecting
  }

  private async open(): Promise<void> {
    // GramJS retries a failed handshake forever rather than throwing, so an unreachable
    // endpoint or a revoked session would otherwise hang the caller indefinitely
    try {
      await withTimeout(
        this.establish(),
        CONNECT_TIMEOUT_MS,
        `MTProto connection timed out after ${CONNECT_TIMEOUT_MS / 1000}s (check TELEGRAM_SESSION is still valid)`
      )
    } catch (error) {
      await this.stopClient()
      throw error
    }

    this.connected = true
    log.bot('MTProto reader connected')
  }

  private async establish(): Promise<void> {
    await this.client.connect()
    // Warms the entity cache, without which getInputEntity() cannot resolve a chat id to its access hash
    await this.client.getDialogs({ limit: DIALOGS_LIMIT })
  }

  /** Stops the background reconnect loop GramJS leaves running after a failed connect. */
  private async stopClient(): Promise<void> {
    try {
      await this.client.disconnect()
    } catch (error) {
      log.warn('MTProto', `Failed to stop client after connection error: ${errorMessage(error)}`)
    }
  }

  /**
   * Runs one MTProto request, bounded in time. A timeout or a dropped connection resets the client
   * and retries once on a fresh connection; a second failure, or a Telegram error, reaches the caller.
   */
  async request<T>(label: string, run: (client: MtprotoClient) => Promise<T>): Promise<T> {
    try {
      return await this.attempt(label, run)
    } catch (error) {
      // A Telegram error (no access, flood wait...) would fail again the same way on a new connection
      if (!(error instanceof TimeoutError) && this.client.connected) throw error

      log.warn('MTProto', `${label} failed, reconnecting and retrying once: ${errorMessage(error)}`)
      await this.reset()
      return await this.attempt(label, run)
    }
  }

  private async attempt<T>(label: string, run: (client: MtprotoClient) => Promise<T>): Promise<T> {
    // GramJS clears its own flag when it gives up reconnecting, while ours would still say connected
    if (!this.client.connected) this.connected = false
    if (!this.connected) await this.connect()

    return await withTimeout(run(this.client), REQUEST_TIMEOUT_MS, `MTProto ${label} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
  }

  /** Drops the connection, so the next request opens a fresh one. */
  private async reset(): Promise<void> {
    this.connected = false
    await this.stopClient()
  }

  /** Whether the reader holds a live connection, without asking Telegram. */
  isConnected(): boolean {
    return this.connected && this.client.connected === true
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return
    await this.client.disconnect()
    this.connected = false
    log.bot('MTProto reader disconnected')
  }
}
