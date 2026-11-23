import type { Api } from 'grammy'
import { type SeasonManager, type Training } from './season'
import { type Attendance, type MessageGenerator } from './messages/messageGenerator'
import { type TrainingHistory } from './history'
import { CANCELLATION_SIGNATURE } from './markers'
import type { BotConfig } from '../config/env'
import { log } from '../shared/logger'
import { armAt, hoursBefore } from '../shared/time'
import { formatDateTimeLocale } from '../shared/formatters'
import { type Sender, senderFor } from '../telegram/sender'

interface AttendanceCheck extends Attendance {
  announcementId: number
  training: Training
}

/** The attendance reminder and the cancellation notice, read off the announcement's 👍 count. */
export class AttendanceMonitor {
  private readonly config: Pick<BotConfig, 'telegram' | 'attendance'>
  private readonly seasonManager: SeasonManager
  private readonly messageGenerator: MessageGenerator
  private readonly history: TrainingHistory
  private readonly toTeam: Sender
  private readonly toTrainers: Sender

  // Keyed by training start: consecutive days can have two trainings announced at once
  private readonly posts = new Map<number, number>()
  private readonly timers = new Map<number, NodeJS.Timeout[]>()

  constructor(config: Pick<BotConfig, 'telegram' | 'attendance'>, seasonManager: SeasonManager, messageGenerator: MessageGenerator, history: TrainingHistory, bot: Api) {
    this.config = config
    this.seasonManager = seasonManager
    this.messageGenerator = messageGenerator
    this.history = history
    this.toTeam = senderFor(bot, config.telegram.teamChat)
    this.toTrainers = senderFor(bot, config.telegram.trainerChat)
  }

  /** The announcement just posted: its 👍 reactions are the attendance count. */
  track(training: Training, messageId: number): void {
    const now = Date.now()
    for (const byTraining of [this.posts, this.timers]) for (const startsAt of byTraining.keys()) if (startsAt < now) byTraining.delete(startsAt)

    this.posts.set(training.startsAt.getTime(), messageId)
    this.arm(training)
  }

  /** On startup: the next training's checks, which the restart dropped. */
  armTimers(): void {
    this.arm(this.seasonManager.nextTraining())
  }

  /**
   * Arms one-shot timers for the attendance checks of `training`, replacing any it had.
   * A boundary that already passed fires immediately (catch-up); the history check keeps that from double-posting.
   */
  private arm(training: Training): void {
    const key = training.startsAt.getTime()
    this.timers.get(key)?.forEach(clearTimeout)
    this.timers.delete(key)

    if (training.cancelled) {
      log.scheduler('⏭️  Attendance checks skipped - training cancelled')
      return
    }

    const { reminderHoursBefore, cancelHoursBefore } = this.config.attendance
    this.timers.set(key, [
      this.armTimer('Attendance reminder', hoursBefore(training.startsAt, reminderHoursBefore), training.startsAt, () => this.runReminderCheck(training)),
      this.armTimer('Cancellation notice', hoursBefore(training.startsAt, cancelHoursBefore), training.startsAt, () => this.runCancellationCheck(training))
    ].filter(timer => timer !== undefined))
  }

  private armTimer(label: string, firesAt: Date, trainingAt: Date, check: () => Promise<void>): NodeJS.Timeout | undefined {
    const now = new Date()

    if (now > trainingAt) {
      log.scheduler(`⏭️  ${label} skipped - training already started`)
      return undefined
    }

    log.scheduler(`⏰ ${label} armed for ${firesAt <= now ? 'now (catch-up)' : formatDateTimeLocale(firesAt)}`)
    return armAt(firesAt, () => { void check() })
  }

  /** Exposed for the /attendance admin command. */
  async inspect(): Promise<AttendanceCheck | null> {
    return await this.getAttendance(this.seasonManager.nextTraining())
  }

  /**
   * Reads the live 👍 count off the training post.
   * Returns null when the post cannot be found, so a missing post never cancels a training.
   */
  private async getAttendance(training: Training): Promise<AttendanceCheck | null> {
    const trainingAt = training.startsAt
    const { teamChat } = this.config.telegram

    const announcementId = this.posts.get(trainingAt.getTime()) ?? await this.history.findAnnouncement(teamChat.chatId, teamChat.threadId, trainingAt)
    if (announcementId === undefined) {
      log.warn('Attendance', 'Training post not found - skipping check')
      return null
    }
    this.posts.set(trainingAt.getTime(), announcementId)

    const count = await this.history.getThumbsUpCount(teamChat.chatId, announcementId)
    const threshold = training.minAttendance

    log.scheduler(`👍 Attendance: ${count}/${threshold} for training at ${formatDateTimeLocale(trainingAt)}`)

    return { announcementId, count, threshold, training }
  }

  private async runReminderCheck(training: Training): Promise<void> {
    try {
      const attendance = await this.getAttendance(training)
      if (!attendance) return

      const { announcementId, count, threshold } = attendance
      const { teamChat } = this.config.telegram

      if (count >= threshold) {
        log.scheduler(`⏭️  Attendance reminder skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (await this.history.hasBotReplyTo(teamChat.chatId, teamChat.threadId, announcementId)) {
        log.scheduler('⏭️  Attendance reminder already sent - skipping')
        return
      }

      const message = await this.messageGenerator.attendanceReminder(training, { useLLM: this.messageGenerator.isLLMAvailable() }, { count, threshold })
      await this.toTeam.text(message, {
        replyTo: announcementId,
        fallback: () => this.messageGenerator.attendanceReminderTemplate({ count, threshold }, training)
      })

      log.scheduler(`📣 Attendance reminder sent to team (${count}/${threshold})`)
    } catch (error) {
      log.error('Sending attendance reminder', error)
    }
  }

  private async runCancellationCheck(training: Training): Promise<void> {
    try {
      const attendance = await this.getAttendance(training)
      if (!attendance) return

      const { count, threshold } = attendance

      if (count >= threshold) {
        log.scheduler(`⏭️  Cancellation notice skipped - attendance reached (${count}/${threshold})`)
        return
      }

      if (!this.config.telegram.enableTrainerMessages) {
        log.scheduler('⏭️  Trainer messages disabled - not sending cancellation notice')
        return
      }

      const { trainerChat } = this.config.telegram
      const since = hoursBefore(training.startsAt, this.config.attendance.cancelHoursBefore + 1)
      if (await this.history.hasBotMessageContaining(trainerChat.chatId, trainerChat.threadId, CANCELLATION_SIGNATURE, since)) {
        log.scheduler('⏭️  Cancellation notice already sent - skipping')
        return
      }

      await this.toTrainers.text(this.messageGenerator.cancellationNotice(training, { count, threshold }))

      log.scheduler(`❌ Cancellation notice sent to trainers (${count}/${threshold})`)
    } catch (error) {
      log.error('Sending cancellation notice', error)
    }
  }
}
