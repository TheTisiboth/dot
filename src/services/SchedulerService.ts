import * as cron from 'node-cron'
import { type SeasonManager } from './SeasonManager'
import { type MessageGenerator } from './MessageGenerator'
import { type ReactionReader } from './ReactionReader'
import { config } from '../config'
import type TelegramBot from 'node-telegram-bot-api'
import { log } from '../utils/logger'
import { type SeasonConfig, type PracticeDay, type Attendance, type TrainingInfo } from '../types'
import { CANCELLATION_SIGNATURE } from '../utils/constants'
import { atTime, hoursBefore, getEffectiveDate } from '../utils/dateHelpers'
import { formatDateLocale, formatDateTimeLocale, extractLocationName } from '../utils/formatters'

interface AttendanceCheck extends Attendance {
  pollMessageId: number
  training: TrainingInfo
}

export class SchedulerService {
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly reactionReader: ReactionReader
  private readonly bot: TelegramBot
  private readonly chatId: string
  private readonly chatThreadId?: string
  private readonly trainerChatId: string
  private readonly trainerChatThreadId?: string
  private readonly enableTrainerMessages: boolean

  private pollMessageId?: number
  private timers: NodeJS.Timeout[] = []

  constructor(
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    reactionReader: ReactionReader,
    bot: TelegramBot
  ) {
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.reactionReader = reactionReader
    this.bot = bot
    this.chatId = config.telegram.chatId
    this.chatThreadId = config.telegram.chatThreadId
    this.trainerChatId = config.telegram.trainerChatId
    this.trainerChatThreadId = config.telegram.trainerChatThreadId
    this.enableTrainerMessages = config.telegram.enableTrainerMessages

    // The trainer post also asks for a 👍, so with both posts loose in the same chat there is
    // nothing left to tell them apart once the training post's id is lost to a restart
    if (this.trainerChatId === this.chatId && !this.trainerChatThreadId && !this.chatThreadId) {
      log.warn(
        'Attendance',
        'Team and trainer messages share one chat with no threads - after a restart the training post cannot be told apart from the trainer post. Set CHAT_THREAD_ID or TRAINER_CHAT_THREAD_ID.'
      )
    }
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

    // Re-arm on startup: a restart must not silently drop an attendance check
    this.armAttendanceTimers()
    this.logNextScheduledMessage()
  }

  /**
   * Arms one-shot timers for the attendance checks.
   *
   * Called after posting the training post and again on startup. A boundary that already
   * passed fires immediately (catch-up); the history check keeps that from double-posting.
   */
  armAttendanceTimers(): void {
    this.clearTimers()

    const trainingAt = this.getTrainingAt(this.seasonManager.getNextTrainingInfo())
    const { reminderHoursBefore, cancelHoursBefore } = config.attendance

    this.armTimer('Attendance reminder', hoursBefore(trainingAt, reminderHoursBefore), trainingAt, () =>
      this.runReminderCheck(trainingAt)
    )
    this.armTimer('Training cancellation', hoursBefore(trainingAt, cancelHoursBefore), trainingAt, () =>
      this.runCancellationCheck(trainingAt)
    )
  }

  private armTimer(label: string, firesAt: Date, trainingAt: Date, check: () => Promise<void>): void {
    const now = getEffectiveDate(new Date())

    if (now > trainingAt) {
      log.scheduler(`⏭️  ${label} skipped - training already started`)
      return
    }

    const delay = Math.max(0, firesAt.getTime() - now.getTime())
    const when = delay === 0 ? 'now (catch-up)' : formatDateTimeLocale(firesAt)
    log.scheduler(`⏰ ${label} armed for ${when}`)

    this.timers.push(setTimeout(() => { void check() }, delay))
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout)
    this.timers = []
  }

  private getTrainingAt(training: TrainingInfo): Date {
    return atTime(training.date, training.time)
  }

  /**
   * Reads the live 👍 count off the training post.
   * Returns null when the post cannot be found, so a missing post never cancels a training.
   */
  private async getAttendance(trainingAt: Date): Promise<AttendanceCheck | null> {
    const training = this.seasonManager.getNextTrainingInfo()

    this.pollMessageId ??= await this.reactionReader.findPollMessage(this.chatId, this.chatThreadId, trainingAt)

    if (!this.pollMessageId) {
      log.warn('Attendance', 'Training post not found - skipping check')
      return null
    }

    const count = await this.reactionReader.getThumbsUpCount(this.chatId, this.pollMessageId)
    const threshold = this.seasonManager.getCurrentSeasonConfig(trainingAt).minAttendance

    log.scheduler(`👍 Attendance: ${count}/${threshold} for training at ${formatDateTimeLocale(trainingAt)}`)

    return { pollMessageId: this.pollMessageId, count, threshold, training }
  }

  private async runReminderCheck(trainingAt: Date): Promise<void> {
    try {
      const attendance = await this.getAttendance(trainingAt)
      if (!attendance) return

      const { pollMessageId, count, threshold, training } = attendance

      if (count >= threshold) {
        log.scheduler(`⏭️  Reminder skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (await this.reactionReader.hasBotReplyTo(this.chatId, this.chatThreadId, pollMessageId)) {
        log.scheduler('⏭️  Reminder already sent - skipping')
        return
      }

      const seasonConfig = this.seasonManager.getCurrentSeasonConfig(trainingAt)
      const message = await this.messageGenerator.generateReminderMessage(
        seasonConfig,
        { useLLM: this.messageGenerator.isLLMAvailable() },
        training.practiceDay,
        { count, threshold }
      )

      await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        reply_to_message_id: pollMessageId,
        ...(this.chatThreadId && { message_thread_id: parseInt(this.chatThreadId) })
      })

      log.scheduler(`📣 Attendance reminder sent to team (${count}/${threshold})`)
    } catch (error) {
      log.error('Running attendance reminder check', error)
    }
  }

  private async runCancellationCheck(trainingAt: Date): Promise<void> {
    try {
      const attendance = await this.getAttendance(trainingAt)
      if (!attendance) return

      const { count, threshold, training } = attendance

      if (count >= threshold) {
        log.scheduler(`⏭️  Cancellation skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (!this.enableTrainerMessages) {
        log.scheduler('⏭️  Trainer messages disabled - not sending cancellation')
        return
      }

      const since = hoursBefore(trainingAt, config.attendance.cancelHoursBefore + 1)
      const alreadyCancelled = await this.reactionReader.hasBotMessageContaining(
        this.trainerChatId,
        this.trainerChatThreadId,
        CANCELLATION_SIGNATURE,
        since
      )
      if (alreadyCancelled) {
        log.scheduler('⏭️  Cancellation already sent - skipping')
        return
      }

      const seasonConfig = this.seasonManager.getCurrentSeasonConfig(trainingAt)
      const message = this.messageGenerator.generateCancellationMessage(seasonConfig, training.practiceDay, {
        count,
        threshold
      })

      await this.bot.sendMessage(this.trainerChatId, message, {
        parse_mode: 'Markdown',
        ...(this.trainerChatThreadId && { message_thread_id: parseInt(this.trainerChatThreadId) })
      })

      log.scheduler(`❌ Cancellation sent to trainers (${count}/${threshold})`)
    } catch (error) {
      log.error('Running training cancellation check', error)
    }
  }

  /** Exposed for the /attendance admin command. */
  async inspectAttendance(): Promise<AttendanceCheck | null> {
    return await this.getAttendance(this.getTrainingAt(this.seasonManager.getNextTrainingInfo()))
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
      const sent = await this.bot.sendMessage(this.chatId, message, {
        parse_mode: 'Markdown',
        ...(this.chatThreadId && { message_thread_id: parseInt(this.chatThreadId) })
      })

      // The training post is the poll: its 👍 reactions are the attendance count
      this.pollMessageId = sent.message_id
      this.armAttendanceTimers()

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
