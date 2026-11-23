import { Bot } from 'grammy'
import { Ollama } from 'ollama'
import { readEnv } from './config'
import { type BotConfig, loadConfig } from './config/env'
import { createMtprotoClient } from './telegram/mtproto/client'
import { buildApp } from './app'
import { log } from './shared/logger'

const loadConfigOrExit = (): BotConfig => {
  try {
    return loadConfig(readEnv())
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}\n\nPlease check your .env file.`)
    process.exit(1)
  }
}

const config = loadConfigOrExit()
const app = buildApp(config, {
  bot: new Bot(config.telegram.token),
  mtproto: createMtprotoClient(config.mtproto),
  ollama: config.ollama.enabled ? new Ollama({ host: config.ollama.host }) : null
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection', reason)
})

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', error)
  process.exit(1)
})

let shuttingDown = false
const shutdown = (signal: string): void => {
  if (shuttingDown) return
  shuttingDown = true

  log.bot(`Received ${signal}, stopping polling...`)
  void app.stop().then(() => {
    log.bot('Polling stopped, exiting')
    process.exit(0)
  })
}

process.on('SIGTERM', () => { shutdown('SIGTERM') })
process.on('SIGINT', () => { shutdown('SIGINT') })

// Polling only gives up on a rejected token or a second poller (409, e.g. a deploy overlap): exit so Docker restarts it
void app.start((error) => {
  log.error('Telegram polling stopped', error)
  process.exit(1)
})
