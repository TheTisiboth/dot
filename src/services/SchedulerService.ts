import * as cron from 'node-cron'
import { type SeasonManager } from './SeasonManager'
import { type MessageGenerator } from './MessageGenerator'
import { config } from '../config'
import type TelegramBot from 'node-telegram-bot-api'
import { log } from '../utils/logger'
import { type SeasonConfig, type PracticeDay } from '../types'

export class SchedulerService {
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly bot: TelegramBot
  private readonly chatId?: string | undefined
  private readonly chatThreadId?: string | undefined
  private readonly trainerChatId?: string | undefined
  private readonly trainerChatThreadId?: string | undefined

  constructor(
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    bot: TelegramBot
  ) {
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.bot = bot
    this.chatId = config.telegram.chatId || undefined
    this.chatThreadId = config.telegram.chatThreadId || undefined
    this.trainerChatId = config.telegram.trainerChatId || undefined
    this.trainerChatThreadId = config.telegram.trainerChatThreadId || undefined
  }

  setupScheduler(): void {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    if (!seasonConfig.practices || seasonConfig.practices.length === 0) {
      log.error('Scheduler setup', new Error('No practice days configured'))
      return
    }

    // Get unique practice times
    const uniqueTimes = [...new Set(seasonConfig.practices.map(p => p.time))]

    // Create a cron job for each unique practice time
    uniqueTimes.forEach(time => {
      const [hour, minute] = time.split(':').map(Number)
      const cronExpression = `${minute} ${hour} * * *`

      cron.schedule(cronExpression, async () => {
        const now = new Date()
        log.scheduler('Cron triggered', { time: now.toLocaleString() })

        if (this.seasonManager.shouldSendMessage()) {
          log.scheduler('Training tomorrow - sending message')
          await this.sendScheduledMessage()
          this.logNextScheduledMessage()
        } else {
          log.scheduler('Not a training day')
        }
      })
    })

    this.logNextScheduledMessage()
  }

  private logNextScheduledMessage(): void {
    if (!this.seasonManager.shouldSendMessage()) {
      const nextTraining = this.seasonManager.getNextTrainingInfo()
      const reminderDate = new Date(nextTraining.date)
      reminderDate.setDate(reminderDate.getDate() - 1)
      reminderDate.setHours(parseInt(nextTraining.time.split(':')[0]), parseInt(nextTraining.time.split(':')[1]), 0, 0)

      log.scheduler('Next reminder scheduled', {
        date: reminderDate.toLocaleString(),
        trainingDay: nextTraining.dayName,
        trainingTime: nextTraining.time
      })
    } else {
      log.scheduler('Next reminder: Today at practice time (should send now)')
    }
  }

  async sendScheduledMessage(): Promise<void> {
    try {
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig()
      const practiceDay = this.seasonManager.getPracticeForDay()

      const useLLM = this.messageGenerator.isLLMAvailable()

      // Send team message
      const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay)

      if (!this.chatId) {
        log.error('Sending scheduled message', new Error('Chat ID not configured'))
        return
      }

      log.bot(`Sending message to chat ${this.chatId}`)
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        ...(this.chatThreadId && { message_thread_id: parseInt(this.chatThreadId) })
      })
      log.scheduler('Scheduled message sent to team', {
        chatId: this.chatId,
        messageThreadId: this.chatThreadId,
        season: seasonConfig.season,
        useLLM,
        time: practiceDay?.time,
        location: practiceDay?.location || seasonConfig.location
      })

      // Send trainer check message
      await this.sendTrainerCheckMessage(seasonConfig, practiceDay, useLLM)
    } catch (error) {
      log.error('Sending scheduled message', error)
    }
  }

  private async sendTrainerCheckMessage(
    seasonConfig: SeasonConfig,
    practiceDay: PracticeDay | undefined,
    useLLM: boolean
  ): Promise<void> {
    if (!this.trainerChatId) {
      log.scheduler('Trainer chat ID not configured, skipping trainer check')
      return
    }

    try {
      const trainerMessage = await this.messageGenerator.generateTrainerMessage(
        seasonConfig,
        { useLLM },
        practiceDay
      )

      log.bot(`Sending message to chat ${this.trainerChatId}`)
      await this.bot.sendMessage(this.trainerChatId, trainerMessage, {
        parse_mode: 'Markdown',
        ...(this.trainerChatThreadId && { message_thread_id: parseInt(this.trainerChatThreadId) })
      })
      log.scheduler('Trainer check message sent to trainers', {
        chatId: this.trainerChatId,
        messageThreadId: this.trainerChatThreadId,
        season: seasonConfig.season,
        useLLM,
        time: practiceDay?.time,
        location: practiceDay?.location || seasonConfig.location
      })
    } catch (error) {
      log.error('Sending trainer check message', error)
    }
  }

  isConfigured(): boolean {
    return !!this.chatId
  }
}