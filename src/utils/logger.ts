import { inspect } from 'node:util'

export const log = {
  command: (command: string, chatId: number, userId?: string | number, threadId?: number) => {
    const threadStr = threadId ? `, Thread: ${threadId}` : ''
    console.log(`[Command] ${command} - Chat: ${chatId}${threadStr}, User: ${userId || 'unknown'}`)
  },

  scheduler: (action: string) => {
    console.log(`[Scheduler] ${action}`)
  },

  messageGen: (action: string) => {
    console.log(`[MessageGen] ${action}`)
  },

  auth: (message: string, userId?: string | number, chatId?: number) => {
    console.log(`[Auth] ${message} - User: ${userId || 'unknown'}, Chat: ${chatId || 'unknown'}`)
  },

  bot: (message: string) => {
    console.log(`[Bot] ${message}`)
  },

  warn: (context: string, message: string) => {
    console.warn(`⚠️  [Warning] ${context}: ${message}`)
  },

  error: (context: string, error: unknown) => {
    console.error(`❌ [Error] ${context}: ${errorMessage(error)}`)
    if (Error.isError(error) && error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
}

// GramJS and the Bot API client can reject with plain objects or strings, not only Errors
export const errorMessage = (error: unknown, seen = new Set<Error>()): string => {
  if (!Error.isError(error)) return typeof error === 'string' ? error : inspect(error, { breakLength: Infinity })
  if (seen.has(error)) return '[Circular]'
  seen.add(error)
  return error.cause === undefined ? error.message : `${error.message} (cause: ${errorMessage(error.cause, seen)})`
}
