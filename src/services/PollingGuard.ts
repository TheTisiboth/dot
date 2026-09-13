import type TelegramBot from 'node-telegram-bot-api'
import { log } from '../utils/logger'

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 60_000
// A getUpdates long poll holds for 10s, so a quiet window past that means a request went through
const RECOVERY_WINDOW_MS = 15_000

interface PollingError extends Error {
  code?: string
  response?: { statusCode?: number; body?: { parameters?: { retry_after?: number } } }
}

/**
 * Backs polling off on errors. Left alone, node-telegram-bot-api retries getUpdates every 300ms,
 * which turns a Telegram outage (429, 502) into a flood of requests and one log line per attempt.
 */
export class PollingGuard {
  private readonly bot: TelegramBot
  private failures = 0
  private streakStartedAt = 0
  private lastMessage?: string
  private restartTimer?: NodeJS.Timeout
  private recoveryTimer?: NodeJS.Timeout
  private stopped = false

  constructor(bot: TelegramBot) {
    this.bot = bot
    this.bot.on('polling_error', (error) => { this.handleError(error as PollingError) })
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.restartTimer)
    clearTimeout(this.recoveryTimer)
  }

  private handleError(error: PollingError): void {
    if (this.stopped) return

    clearTimeout(this.recoveryTimer)
    if (this.failures === 0) this.streakStartedAt = Date.now()
    this.failures++

    const retryAfterSeconds = error.response?.body?.parameters?.retry_after
    const delay = retryAfterSeconds
      ? retryAfterSeconds * 1000
      : Math.min(MIN_BACKOFF_MS * 2 ** (this.failures - 1), MAX_BACKOFF_MS)

    // Stopping without cancel flags the in-flight loop as aborted, so it does not schedule its own retry
    void this.bot.stopPolling()

    const message = error.message.replace(/^(ETELEGRAM|EFATAL): /, '')
    if (message !== this.lastMessage) {
      log.warn('Telegram polling', `${message} - retrying in ${delay / 1000}s (attempt ${this.failures})`)
      this.lastMessage = message
    }

    this.restartTimer = setTimeout(() => { this.restart() }, delay)
  }

  private restart(): void {
    if (this.stopped) return

    void this.bot.startPolling()
    this.recoveryTimer = setTimeout(() => { this.markRecovered() }, RECOVERY_WINDOW_MS)
  }

  private markRecovered(): void {
    const seconds = Math.round((Date.now() - this.streakStartedAt) / 1000)
    log.bot(`Telegram polling recovered after ${this.failures} failed attempt${this.failures === 1 ? '' : 's'} (${seconds}s)`)
    this.failures = 0
    this.lastMessage = undefined
  }
}
