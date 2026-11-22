import * as cron from 'node-cron'
import { type SeasonManager } from './SeasonManager'
import { type MessageGenerator } from './MessageGenerator'
import { type ReactionReader } from './ReactionReader'
import type { BotConfig } from '../config/env'
import type { Api } from 'grammy'
import { errorMessage, log } from '../utils/logger'
import { type RulesQuizService } from './RulesQuizService'
import { type SeasonConfig, type Attendance, type PartResult, type TrainingInfo } from '../types'
import { CANCELLATION_SIGNATURE, EMOJIS } from '../utils/constants'
import { atTime, hoursBefore } from '../utils/dateHelpers'
import { formatDateLocale, formatDateTimeLocale, formatTime, getDayName } from '../utils/formatters'
import { type ChatTarget, sendWithFallback, threadOptions } from '../utils/telegram'

// Long enough for a network blip to pass, short enough that the team still reads the post the day before
const RETRY_DELAY_MS = 10 * 60_000

export const PART_NAMES = {
  announcement: 'Announcement',
  keyRequest: 'Key request',
  trainerRequest: 'Trainer request',
  quiz: 'Rules quiz'
} as const

export type AnnounceReport = Record<keyof typeof PART_NAMES, PartResult>

interface AttendanceCheck extends Attendance {
  pollMessageId: number
  training: TrainingInfo
}

export class SchedulerService {
  private readonly config: Pick<BotConfig, 'telegram' | 'attendance'>
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly reactionReader: ReactionReader
  private readonly bot: Api
  private readonly rulesQuiz: RulesQuizService
  private readonly teamChat: ChatTarget
  private readonly trainerChat: ChatTarget
  private readonly enableTrainerMessages: boolean

  // Keyed by training: once that training starts, the post no longer counts for the next one
  private trainingPost?: { trainingAt: Date; messageId: number }
  private timers: NodeJS.Timeout[] = []
  private retryTimer?: NodeJS.Timeout

  constructor(
    config: Pick<BotConfig, 'telegram' | 'attendance'>,
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    reactionReader: ReactionReader,
    bot: Api,
    rulesQuiz: RulesQuizService
  ) {
    this.config = config
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.reactionReader = reactionReader
    this.bot = bot
    this.rulesQuiz = rulesQuiz
    this.teamChat = config.telegram.teamChat
    this.trainerChat = config.telegram.trainerChat
    this.enableTrainerMessages = config.telegram.enableTrainerMessages
  }

  setupScheduler(): void {
    this.seasonManager.getAllPracticeTimes().forEach(practiceTime => {
      const cronExpression = `${practiceTime.minute} ${practiceTime.hour} * * *`
      const time = formatTime(practiceTime)

      log.scheduler(`⏰ Registered daily reminder check at ${time}`)

      cron.schedule(cronExpression, async () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)

        if (this.seasonManager.shouldSendMessage(practiceTime)) {
          log.scheduler(`✅ Training tomorrow (${formatDateLocale(tomorrow)}) at ${time} - sending reminders`)
          await this.runScheduled()
        } else {
          log.scheduler(`⏭️  No training tomorrow (${formatDateLocale(tomorrow)}) at ${time} - skipping`)
        }
        this.logNextScheduledMessage()
      })
    })

    // Re-arm on startup: a restart must not silently drop an attendance check or a quiz answer
    this.armAttendanceTimers()
    void this.rulesQuiz.armAnswer()
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

    const training = this.seasonManager.getNextTrainingInfo()
    if (training.isCancelled) {
      log.scheduler('⏭️  Attendance checks skipped - training cancelled')
      return
    }

    const trainingAt = this.getTrainingAt(training)
    const { reminderHoursBefore, cancelHoursBefore } = this.config.attendance

    this.armTimer('Attendance reminder', hoursBefore(trainingAt, reminderHoursBefore), trainingAt, () =>
      this.runReminderCheck(training)
    )
    this.armTimer('Training cancellation', hoursBefore(trainingAt, cancelHoursBefore), trainingAt, () =>
      this.runCancellationCheck(training)
    )
  }

  private armTimer(label: string, firesAt: Date, trainingAt: Date, check: () => Promise<void>): void {
    const now = new Date()

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
  private async getAttendance(training: TrainingInfo): Promise<AttendanceCheck | null> {
    const trainingAt = this.getTrainingAt(training)

    if (this.trainingPost?.trainingAt.getTime() !== trainingAt.getTime()) {
      const messageId = await this.reactionReader.findPollMessage(this.teamChat.chatId, this.teamChat.threadId, trainingAt)
      this.trainingPost = messageId ? { trainingAt, messageId } : undefined
    }

    if (!this.trainingPost) {
      log.warn('Attendance', 'Training post not found - skipping check')
      return null
    }

    const pollMessageId = this.trainingPost.messageId
    const count = await this.reactionReader.getThumbsUpCount(this.teamChat.chatId, pollMessageId)
    const threshold = this.seasonManager.getCurrentSeasonConfig(trainingAt).minAttendance

    log.scheduler(`👍 Attendance: ${count}/${threshold} for training at ${formatDateTimeLocale(trainingAt)}`)

    return { pollMessageId, count, threshold, training }
  }

  private async runReminderCheck(training: TrainingInfo): Promise<void> {
    try {
      const attendance = await this.getAttendance(training)
      if (!attendance) return

      const { pollMessageId, count, threshold } = attendance

      if (count >= threshold) {
        log.scheduler(`⏭️  Reminder skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (await this.reactionReader.hasBotReplyTo(this.teamChat.chatId, this.teamChat.threadId, pollMessageId)) {
        log.scheduler('⏭️  Reminder already sent - skipping')
        return
      }

      const message = await this.messageGenerator.generateReminderMessage(
        training,
        { useLLM: this.messageGenerator.isLLMAvailable() },
        { count, threshold }
      )

      await sendWithFallback(this.bot, this.teamChat.chatId, message, () => this.messageGenerator.generateReminderTemplateMessage({ count, threshold }, training), {
        reply_to_message_id: pollMessageId,
        ...threadOptions(this.teamChat.threadId)
      })

      log.scheduler(`📣 Attendance reminder sent to team (${count}/${threshold})`)
    } catch (error) {
      log.error('Running attendance reminder check', error)
    }
  }

  private async runCancellationCheck(training: TrainingInfo): Promise<void> {
    try {
      const attendance = await this.getAttendance(training)
      if (!attendance) return

      const { count, threshold } = attendance

      if (count >= threshold) {
        log.scheduler(`⏭️  Cancellation skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (!this.enableTrainerMessages) {
        log.scheduler('⏭️  Trainer messages disabled - not sending cancellation')
        return
      }

      const since = hoursBefore(this.getTrainingAt(training), this.config.attendance.cancelHoursBefore + 1)
      const alreadyCancelled = await this.reactionReader.hasBotMessageContaining(
        this.trainerChat.chatId,
        this.trainerChat.threadId,
        CANCELLATION_SIGNATURE,
        since
      )
      if (alreadyCancelled) {
        log.scheduler('⏭️  Cancellation already sent - skipping')
        return
      }

      const message = this.messageGenerator.generateCancellationMessage(training, { count, threshold })

      await this.bot.sendMessage(this.trainerChat.chatId, message, {
        parse_mode: 'HTML',
        ...threadOptions(this.trainerChat.threadId)
      })

      log.scheduler(`❌ Cancellation sent to trainers (${count}/${threshold})`)
    } catch (error) {
      log.error('Running training cancellation check', error)
    }
  }

  /** Exposed for the /attendance admin command. */
  async inspectAttendance(): Promise<AttendanceCheck | null> {
    return await this.getAttendance(this.seasonManager.getNextTrainingInfo())
  }

  private logNextScheduledMessage(): void {
    const now = new Date()
    // The cron fires at the practice's base time, which EXCEPTIONAL_TIME does not move
    const reminderDateFor = (training: TrainingInfo): Date => {
      const date = atTime(training.date, training.practiceDay.time)
      date.setDate(date.getDate() - 1)
      return date
    }

    let nextTraining = this.seasonManager.getNextTrainingInfo()
    let reminderDate = reminderDateFor(nextTraining)

    // If the reminder has already passed, get the training after this one
    if (reminderDate <= now) {
      const dayAfterNextTraining = new Date(nextTraining.date)
      dayAfterNextTraining.setDate(dayAfterNextTraining.getDate() + 1)
      nextTraining = this.seasonManager.getNextTrainingInfo(dayAfterNextTraining)
      reminderDate = reminderDateFor(nextTraining)
    }

    const msUntilReminder = reminderDate.getTime() - now.getTime()
    const daysUntilReminder = Math.round(msUntilReminder / (1000 * 60 * 60 * 24))

    const reminderDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][reminderDate.getDay()]

    log.scheduler(`🔔 Next reminder: ${reminderDayName}, ${formatDateLocale(reminderDate)} at ${reminderDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (in ${daysUntilReminder} days)`)
    log.scheduler(`📅 For training: ${getDayName(nextTraining.date.getDay())}, ${formatDateLocale(nextTraining.date)} at ${formatTime(nextTraining.time)}`)
  }

  /** Posts the announcement, key and trainer requests, then the quiz, and says what happened to each (used by /send_to_all). */
  async sendScheduledMessage(): Promise<AnnounceReport> {
    const training = await this.announce()
    // A failed announcement must not skip the quiz, which goes out even if training is cancelled
    return { ...training, quiz: await this.rulesQuiz.sendScheduled() }
  }

  /** The cron job: a failed announcement is retried once, later; whatever still failed is reported to the admin chat. */
  private async runScheduled(): Promise<void> {
    clearTimeout(this.retryTimer)
    const report = await this.sendScheduledMessage()
    if (report.announcement.status !== 'failed') {
      await this.alertFailures(report)
      return
    }

    log.scheduler(`🔁 Announcement retry in ${RETRY_DELAY_MS / 60_000} min`)
    this.retryTimer = setTimeout(() => {
      void this.announce().then(training => this.alertFailures({ ...training, quiz: report.quiz }))
    }, RETRY_DELAY_MS)
  }

  private async alertFailures(report: AnnounceReport): Promise<void> {
    if (!hasFailure(report)) return

    try {
      await this.bot.sendMessage(this.config.telegram.adminChatId, `${EMOJIS.WARNING} Scheduled training messages failed:\n\n${describeReport(report, true)}`)
    } catch (error) {
      log.error('Alerting the admin chat', error)
    }
  }

  /** Key and trainer requests wait for the announcement, so a retry never posts them twice. */
  private async announce(): Promise<Omit<AnnounceReport, 'quiz'>> {
    const nextTraining = this.seasonManager.getNextTrainingInfo()
    if (nextTraining.isCancelled) {
      log.scheduler('⏭️  Training cancelled - nothing sent to team or trainers')
      const cancelled: PartResult = { status: 'skipped', reason: 'training cancelled' }
      return { announcement: cancelled, keyRequest: cancelled, trainerRequest: cancelled }
    }

    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(nextTraining.date)
    const useLLM = this.messageGenerator.isLLMAvailable()

    const announcement = await attempt('Sending announcement', async () => {
      const message = await this.messageGenerator.generateMessage(nextTraining, { useLLM })

      log.bot(`Sending message to chat ${this.teamChat.chatId}`)
      const sent = await sendWithFallback(this.bot, this.teamChat.chatId, message, () => this.messageGenerator.generateTemplateMessage(nextTraining), threadOptions(this.teamChat.threadId))

      // The training post is the poll: its 👍 reactions are the attendance count
      this.trainingPost = { trainingAt: this.getTrainingAt(nextTraining), messageId: sent.message_id }
      this.armAttendanceTimers()

      const threadInfo = this.teamChat.threadId ? ` (thread ${this.teamChat.threadId})` : ''
      log.scheduler(`Scheduled message sent to team${threadInfo} - ${nextTraining.season} at ${nextTraining.location.name} (${formatTime(nextTraining.time)}) using ${useLLM ? 'LLM' : 'template'}`)
    })

    if (announcement.status === 'failed') {
      const notSent: PartResult = { status: 'skipped', reason: 'announcement failed' }
      return { announcement, keyRequest: notSent, trainerRequest: notSent }
    }

    return {
      announcement,
      keyRequest: await this.sendKeyMessage(seasonConfig),
      trainerRequest: await this.sendTrainerCheckMessage(nextTraining, useLLM)
    }
  }

  private async sendKeyMessage(seasonConfig: SeasonConfig): Promise<PartResult> {
    if (!seasonConfig.keyMessageEnabled) {
      log.scheduler(`Key message disabled for ${seasonConfig.season}, skipping`)
      return { status: 'skipped', reason: `disabled for ${seasonConfig.season}` }
    }

    return await attempt('Sending key message', async () => {
      const keyMessage = this.messageGenerator.generateKeyMessage()

      log.bot(`Sending message to chat ${this.teamChat.chatId}`)
      await this.bot.sendMessage(this.teamChat.chatId, keyMessage, {
        parse_mode: 'HTML',
        ...threadOptions(this.teamChat.threadId)
      })

      const threadInfo = this.teamChat.threadId ? ` (thread ${this.teamChat.threadId})` : ''
      log.scheduler(`Key message sent to team${threadInfo}`)
    })
  }

  private async sendTrainerCheckMessage(training: TrainingInfo, useLLM: boolean): Promise<PartResult> {
    if (!this.enableTrainerMessages) {
      log.scheduler('Trainer messages disabled, skipping trainer check message')
      return { status: 'skipped', reason: 'trainer messages disabled' }
    }

    return await attempt('Sending trainer check message', async () => {
      const trainerMessage = await this.messageGenerator.generateTrainerMessage(training, { useLLM })

      log.bot(`Sending message to chat ${this.trainerChat.chatId}`)
      await sendWithFallback(this.bot, this.trainerChat.chatId, trainerMessage, () => this.messageGenerator.generateTrainerTemplateMessage(training), threadOptions(this.trainerChat.threadId))

      const threadInfo = this.trainerChat.threadId ? ` (thread ${this.trainerChat.threadId})` : ''
      log.scheduler(`Trainer check message sent${threadInfo} - ${training.season} at ${training.location.name} (${formatTime(training.time)}) using ${useLLM ? 'LLM' : 'template'}`)
    })
  }
}

/** Each part fails on its own: one lost message never keeps the next from going out. */
const attempt = async (context: string, send: () => Promise<void>): Promise<PartResult> => {
  try {
    await send()
    return { status: 'sent' }
  } catch (error) {
    log.error(context, error)
    return { status: 'failed', error: errorMessage(error) }
  }
}

export const hasFailure = (report: AnnounceReport): boolean => Object.values(report).some(({ status }) => status === 'failed')

const describePart = (result: PartResult): string => {
  switch (result.status) {
    case 'sent': return `${EMOJIS.CHECK_MARK} sent`
    case 'skipped': return `⏭️ skipped (${result.reason})`
    case 'failed': return `${EMOJIS.CROSS_MARK} failed: ${result.error}`
  }
}

/** One line per part, plain text: error messages may hold HTML characters. */
export const describeReport = (report: AnnounceReport, onlyFailed = false): string =>
  (Object.keys(PART_NAMES) as Array<keyof AnnounceReport>)
    .filter(part => !onlyFailed || report[part].status === 'failed')
    .map(part => `${PART_NAMES[part]}: ${describePart(report[part])}`)
    .join('\n')
