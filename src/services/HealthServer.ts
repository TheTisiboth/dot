import express, { type Application } from 'express'
import type TelegramBot from 'node-telegram-bot-api'
import { EMOJIS } from '../utils/constants'
import { log } from '../utils/logger'
import type { MessageGenerator } from './MessageGenerator'

export class HealthServer {
  private readonly app: Application
  private readonly bot: TelegramBot
  private readonly messageGenerator: MessageGenerator

  constructor(bot: TelegramBot, messageGenerator: MessageGenerator) {
    this.bot = bot
    this.messageGenerator = messageGenerator
    this.app = express()
    this.setupRoutes()
  }

  private setupRoutes(): void {
    this.app.get('/health', async (_req, res) => {
      try {
        await this.bot.getMe()

        res.json({
          status: 'ok',
          telegram: 'connected',
          ollama: this.messageGenerator.getLLMProvider()
        })
      } catch (error) {
        log.error('Health check failed', error as Error)
        res.status(503).json({
          status: 'error',
          telegram: 'disconnected',
          error: (error as Error).message
        })
      }
    })

    this.app.get('/health/ollama', async (_req, res) => {
      try {
        const provider = this.messageGenerator.getLLMProvider()
        if (provider === 'Templates') {
          res.status(503).json({ status: 'disabled', provider: 'Templates' })
        } else {
          res.json({ status: 'ok', provider })
        }
      } catch (error) {
        res.status(503).json({ status: 'error', error: (error as Error).message })
      }
    })
  }

  start(): void {
    const port = process.env.HEALTH_PORT || 3004
    this.app.listen(port, () => {
      log.bot(`${EMOJIS.ROBOT} Health server listening on port ${port}`)
    })
  }
}
