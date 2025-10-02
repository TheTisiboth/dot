export const log = {
  command: (command: string, chatId: number, userId?: string | number) => {
    console.log(`[Command] ${command} - Chat: ${chatId}, User: ${userId || 'unknown'}`)
  },

  scheduler: (action: string, details?: Record<string, unknown>) => {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : ''
    console.log(`[Scheduler] ${action}${detailsStr}`)
  },

  messageGen: (action: string, details?: Record<string, unknown>) => {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : ''
    console.log(`[MessageGen] ${action}${detailsStr}`)
  },

  auth: (message: string, userId?: string | number, chatId?: number) => {
    console.log(`[Auth] ${message} - User: ${userId || 'unknown'}, Chat: ${chatId || 'unknown'}`)
  },

  bot: (message: string, details?: Record<string, unknown>) => {
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : ''
    console.log(`[Bot] ${message}${detailsStr}`)
  },

  config: (message: string) => {
    console.log(`[Config] ${message}`)
  },

  warn: (context: string, message: string) => {
    console.warn(`[Warning] ${context}: ${message}`)
  },

  error: (context: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Error] ${context}: ${errorMessage}`)
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
}
