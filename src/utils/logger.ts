export const log = {
  command: (command: string, chatId: number, userId?: string | number, threadId?: number) => {
    const threadStr = threadId ? `, Thread: ${threadId}` : ''
    console.log(`⚡ [Command] ${command} - Chat: ${chatId}${threadStr}, User: ${userId || 'unknown'}`)
  },

  scheduler: (action: string) => {
    console.log(`⏰ [Scheduler] ${action}`)
  },

  messageGen: (action: string) => {
    console.log(`✍️  [MessageGen] ${action}`)
  },

  auth: (message: string, userId?: string | number, chatId?: number) => {
    console.log(`🔐 [Auth] ${message} - User: ${userId || 'unknown'}, Chat: ${chatId || 'unknown'}`)
  },

  bot: (message: string) => {
    console.log(`🤖 [Bot] ${message}`)
  },

  warn: (context: string, message: string) => {
    console.warn(`⚠️  [Warning] ${context}: ${message}`)
  },

  error: (context: string, error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`❌ [Error] ${context}: ${errorMessage}`)
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack)
    }
  }
}
