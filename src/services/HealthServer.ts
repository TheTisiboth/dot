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
    // Aggregate health check - tests all services
    this.app.get('/health', async (_req, res) => {
      const checks = {
        telegram: { status: 'unknown', responseTime: 0 },
        ollama: { status: 'unknown', responseTime: 0 }
      }
      let overallStatus = 'ok'
      let errorMessage: string | undefined

      // Test Telegram connection
      try {
        const telegramStartTime = Date.now()
        await this.bot.getMe()
        checks.telegram = {
          status: 'connected',
          responseTime: Date.now() - telegramStartTime
        }
      } catch (error) {
        checks.telegram.status = 'disconnected'
        overallStatus = 'error'
        errorMessage = `Telegram: ${(error as Error).message}`
      }

      // Test Ollama connection
      try {
        const ollamaStartTime = Date.now()
        if (!this.messageGenerator.isLLMAvailable()) {
          checks.ollama = { status: 'disabled', responseTime: 0 }
          overallStatus = 'error'
          errorMessage = errorMessage ? `${errorMessage}; Ollama: disabled` : 'Ollama: disabled'
        } else {
          // Actually test connectivity by calling Ollama
          await this.messageGenerator.testOllamaConnection()
          checks.ollama = {
            status: 'connected',
            responseTime: Date.now() - ollamaStartTime
          }
        }
      } catch (error) {
        checks.ollama.status = 'disconnected'
        overallStatus = 'error'
        errorMessage = errorMessage ? `${errorMessage}; Ollama: ${(error as Error).message}` : `Ollama: ${(error as Error).message}`
      }

      const statusCode = overallStatus === 'ok' ? 200 : 503

      res.status(statusCode).json({
        status: overallStatus,
        checks: {
          telegram: checks.telegram.status,
          telegramResponseTime: `${checks.telegram.responseTime}ms`,
          ollama: checks.ollama.status,
          ollamaResponseTime: `${checks.ollama.responseTime}ms`
        },
        ...(errorMessage && { error: errorMessage }),
        timestamp: new Date().toISOString()
      })
    })

    // Telegram-only health check
    this.app.get('/health/telegram', async (_req, res) => {
      try {
        const startTime = Date.now()
        await this.bot.getMe()
        const responseTime = Date.now() - startTime

        res.json({
          status: 'ok',
          service: 'telegram',
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        })
      } catch (error) {
        res.status(503).json({
          status: 'error',
          service: 'telegram',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        })
      }
    })

    // Ollama-only health check
    this.app.get('/health/ollama', async (_req, res) => {
      try {
        const startTime = Date.now()
        if (!this.messageGenerator.isLLMAvailable()) {
          res.status(503).json({
            status: 'disabled',
            service: 'ollama',
            provider: 'disabled',
            timestamp: new Date().toISOString()
          })
        } else {
          // Actually test connectivity by calling Ollama
          await this.messageGenerator.testOllamaConnection()
          const provider = this.messageGenerator.getLLMProvider()
          const responseTime = Date.now() - startTime
          res.json({
            status: 'ok',
            service: 'ollama',
            provider,
            responseTime: `${responseTime}ms`,
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        res.status(503).json({
          status: 'error',
          service: 'ollama',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        })
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
