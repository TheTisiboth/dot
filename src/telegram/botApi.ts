import { type Transformer } from 'grammy'
import { errorMessage, log } from '../shared/logger'

// Bot API sendPoll limits
export const POLL_LIMITS = { question: 300, option: 100 } as const

/**
 * grammY reports a failed getUpdates only through `debug`, so a Telegram outage would leave no log line.
 * Logs the first failure of a streak and the recovery, not every retry.
 */
export const pollingOutageLogger = (): Transformer => {
  let failing = false
  const update = (failed: boolean, reason: string) => {
    if (failed && !failing) log.warn('Telegram polling', `getUpdates failing, retrying until it recovers: ${reason}`)
    if (!failed && failing) log.bot('Telegram polling recovered')
    failing = failed
  }
  return async (prev, method, payload, signal) => {
    if (method !== 'getUpdates') return prev(method, payload, signal)
    try {
      const response = await prev(method, payload, signal)
      update(!response.ok, response.ok ? '' : response.description)
      return response
    } catch (error) {
      // Stopping the bot aborts the pending poll: not an outage
      if (!signal?.aborted) update(true, errorMessage(error))
      throw error
    }
  }
}
