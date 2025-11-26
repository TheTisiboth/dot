import * as cron from 'node-cron'
import { type SeasonManager } from './SeasonManager'
import { type MessageGenerator } from './MessageGenerator'
import { config } from '../config'
import type TelegramBot from 'node-telegram-bot-api'
import { log } from '../utils/logger'
import { type SeasonConfig, type PracticeDay } from '../types'
import { formatDateLocale, formatDateTimeLocale, extractLocationName } from '../utils/formatters'

export class SchedulerService {
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly bot: TelegramBot
  private readonly chatId: string
  private readonly chatThreadId?: string
  private readonly trainerChatId: string
  private readonly trainerChatThreadId?: string
  private readonly enableTrainerMessages: boolean

  constructor(
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    bot: TelegramBot
  ) {
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.bot = bot
    this.chatId = config.telegram.chatId
    this.chatThreadId = config.telegram.chatThreadId
    this.trainerChatId = config.telegram.trainerChatId
    this.trainerChatThreadId = config.telegram.trainerChatThreadId
    this.enableTrainerMessages = config.telegram.enableTrainerMessages
  }

  setupScheduler(): void {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    // Get unique practice times
    const uniqueTimes = [...new Set(seasonConfig.practices.map(p => p.time))]

    // Create a cron job for each unique practice time
    uniqueTimes.forEach(time => {
      const [hour, minute] = time.split(':').map(Number)
      const cronExpression = `${minute} ${hour} * * *`

      log.scheduler(`⏰ Registered daily reminder check at ${time}`)

      cron.schedule(cronExpression, async () => {
        const now = new Date()
        const tomorrow = new Date(now)
        tomorrow.setDate(now.getDate() + 1)

        log.scheduler(`🔔 Reminder check triggered: ${formatDateTimeLocale(now)}`)
        log.scheduler(`📆 Checking if training tomorrow (${formatDateLocale(tomorrow)})`)

        if (this.seasonManager.shouldSendMessage()) {
          log.scheduler('✅ Training tomorrow - sending reminders')
          await this.sendScheduledMessage()
          this.logNextScheduledMessage()
        } else {
          log.scheduler('⏭️  No training tomorrow - skipping')
          this.logNextScheduledMessage()
        }
      })
    })

    this.logNextScheduledMessage()
  }

  private logNextScheduledMessage(): void {
    const now = new Date()
    let nextTraining = this.seasonManager.getNextTrainingInfo()
    let reminderDate = new Date(nextTraining.date)
    reminderDate.setDate(reminderDate.getDate() - 1)
    reminderDate.setHours(parseInt(nextTraining.time.split(':')[0]), parseInt(nextTraining.time.split(':')[1]), 0, 0)

    // If the reminder has already passed, get the training after this one
    if (reminderDate <= now) {
      const dayAfterNextTraining = new Date(nextTraining.date)
      dayAfterNextTraining.setDate(dayAfterNextTraining.getDate() + 1)
      nextTraining = this.seasonManager.getNextTrainingInfo(dayAfterNextTraining)

      reminderDate = new Date(nextTraining.date)
      reminderDate.setDate(reminderDate.getDate() - 1)
      reminderDate.setHours(parseInt(nextTraining.time.split(':')[0]), parseInt(nextTraining.time.split(':')[1]), 0, 0)
    }

    const msUntilReminder = reminderDate.getTime() - now.getTime()
    const daysUntilReminder = Math.round(msUntilReminder / (1000 * 60 * 60 * 24))

    const reminderDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][reminderDate.getDay()]

    log.scheduler(`🔔 Next reminder: ${reminderDayName}, ${formatDateLocale(reminderDate)} at ${reminderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (in ${daysUntilReminder} days)`)
    log.scheduler(`📅 For training: ${nextTraining.dayName}, ${formatDateLocale(nextTraining.date)} at ${nextTraining.time}`)
  }

  async sendScheduledMessage(): Promise<void> {
    try {
      const nextTraining = this.seasonManager.getNextTrainingInfo()
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
      const practiceDay = nextTraining.practiceDay

      const useLLM = this.messageGenerator.isLLMAvailable()

      // Send team message
      const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay)

      log.bot(`Sending message to chat ${this.chatId}`)
      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        ...(this.chatThreadId && { message_thread_id: parseInt(this.chatThreadId) })
      })

      const locationName = extractLocationName(seasonConfig.location)
      const threadInfo = this.chatThreadId ? ` (thread ${this.chatThreadId})` : ''
      log.scheduler(`Scheduled message sent to team${threadInfo} - ${seasonConfig.season} at ${locationName} (${practiceDay.time}) using ${useLLM ? 'LLM' : 'template'}`)

      // Send trainer check message
      await this.sendTrainerCheckMessage(seasonConfig, practiceDay, useLLM)
    } catch (error) {
      log.error('Sending scheduled message', error)
    }
  }

  private async sendTrainerCheckMessage(
    seasonConfig: SeasonConfig,
    practiceDay: PracticeDay,
    useLLM: boolean
  ): Promise<void> {
    if (!this.enableTrainerMessages) {
      log.scheduler('Trainer messages disabled, skipping trainer check message')
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

      const locationName = extractLocationName(seasonConfig.location)
      const threadInfo = this.trainerChatThreadId ? ` (thread ${this.trainerChatThreadId})` : ''
      log.scheduler(`Trainer check message sent${threadInfo} - ${seasonConfig.season} at ${locationName} (${practiceDay.time}) using ${useLLM ? 'LLM' : 'template'}`)
    } catch (error) {
      log.error('Sending trainer check message', error)
    }
  }
}