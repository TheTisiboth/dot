import * as cron from 'node-cron'
import { type SeasonManager } from './SeasonManager'
import { type MessageGenerator } from './MessageGenerator'
import { config } from '../config'
import { MESSAGES } from '../utils/constants'
import type TelegramBot from 'node-telegram-bot-api'
import { log } from '../utils/logger'

export class SchedulerService {
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly bot: TelegramBot
  private readonly chatId?: string | undefined

  constructor(
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    bot: TelegramBot
  ) {
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.bot = bot
    this.chatId = config.telegram.chatId || undefined
  }

  setupScheduler(): void {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig()

    if (!seasonConfig.practices || seasonConfig.practices.length === 0) {
      console.error('❌ No practice days configured')
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
        console.log(`🕐 Cron triggered at: ${now.toLocaleString()}`)
        console.log(MESSAGES.CHECKING_MESSAGE_SEND)

        if (this.seasonManager.shouldSendMessage()) {
          console.log(MESSAGES.SENDING_SCHEDULED_MESSAGE)
          await this.sendScheduledMessage()
          this.logNextScheduledMessage()
        } else {
          console.log(MESSAGES.NOT_TRAINING_DAY)
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

      console.log(`📅 Next reminder: ${reminderDate.toLocaleString()} (24h before ${nextTraining.dayName} ${nextTraining.time} training)`)
    } else {
      console.log(`📅 Next reminder: Today at practice time (should send now)`)
    }
  }

  async sendScheduledMessage(): Promise<void> {
    try {
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig()
      const practiceDay = this.seasonManager.getPracticeForDay()

      const useLLM = this.messageGenerator.isLLMAvailable()
      const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay)

      if (!this.chatId) {
        console.error(`❌ ${MESSAGES.CHAT_ID_NOT_CONFIGURED}`, message)
        return
      }

      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' })
      log.scheduler('Scheduled message sent', {
        chatId: this.chatId,
        season: seasonConfig.season,
        useLLM,
        time: practiceDay?.time,
        location: practiceDay?.location || seasonConfig.location
      })
    } catch (error) {
      log.error('Sending scheduled message', error)
    }
  }

  isConfigured(): boolean {
    return !!this.chatId
  }
}