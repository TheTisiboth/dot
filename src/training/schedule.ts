import * as cron from 'node-cron'
import type { Api } from 'grammy'
import { type SeasonManager } from './season'
import { type AttendanceMonitor } from './attendance'
import { type AnnounceReport, type Announcer, describeReport, hasFailure } from './announcer'
import type { BotConfig } from '../config/env'
import { type RulesQuizService } from '../quiz/service'
import { log } from '../shared/logger'
import { EMOJIS } from '../shared/emojis'
import { formatClock, formatDateLocale, formatTime, getDayName } from '../shared/formatters'
import { senderFor } from '../telegram/sender'

// Long enough for a network blip to pass, short enough that the team still reads the post the day before
const RETRY_DELAY_MS = 10 * 60_000

interface ScheduleDeps {
  config: Pick<BotConfig, 'telegram'>;
  seasonManager: SeasonManager;
  announcer: Announcer;
  attendance: AttendanceMonitor;
  rulesQuiz: RulesQuizService;
  bot: Api;
}

/** Registers a daily cron per practice time, and re-arms on startup what a restart would drop. */
export const startSchedule = ({ config, seasonManager, announcer, attendance, rulesQuiz, bot }: ScheduleDeps): void => {
  const toAdmin = senderFor(bot, { chatId: config.telegram.adminChatId })
  let retryTimer: NodeJS.Timeout | undefined

  const alertFailures = async (report: AnnounceReport): Promise<void> => {
    if (!hasFailure(report)) return

    try {
      await toAdmin.plain(`${EMOJIS.WARNING} Scheduled training messages failed:\n\n${describeReport(report, true)}`)
    } catch (error) {
      log.error('Alerting the admin chat', error)
    }
  }

  /** The cron job: a failed announcement is retried once, later; whatever still failed is reported to the admin chat. */
  const runScheduled = async (): Promise<void> => {
    clearTimeout(retryTimer)
    const report = await announcer.announceTraining()
    if (report.announcement.status !== 'failed') {
      await alertFailures(report)
      return
    }

    log.scheduler(`🔁 Announcement retry in ${RETRY_DELAY_MS / 60_000} min`)
    retryTimer = setTimeout(() => {
      void announcer.announce().then(training => alertFailures({ ...training, quiz: report.quiz }))
    }, RETRY_DELAY_MS)
  }

  const logNextAnnouncement = (): void => {
    const now = new Date()
    const { announcesAt, training } = seasonManager.nextAnnouncement(now)
    const daysUntil = Math.round((announcesAt.getTime() - now.getTime()) / (24 * 60 * 60_000))

    log.scheduler(`🔔 Next announcement: ${getDayName(announcesAt.getDay())}, ${formatDateLocale(announcesAt)} at ${formatClock(announcesAt)} (in ${daysUntil} days)`)
    log.scheduler(`📅 For training: ${getDayName(training.startsAt.getDay())}, ${formatDateLocale(training.startsAt)} at ${formatClock(training.startsAt)}`)
  }

  seasonManager.getAllPracticeTimes().forEach(practiceTime => {
    const time = formatTime(practiceTime)
    log.scheduler(`⏰ Registered daily announcement check at ${time}`)

    cron.schedule(`${practiceTime.minute} ${practiceTime.hour} * * *`, async () => {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      if (seasonManager.isAnnouncementDue(practiceTime)) {
        log.scheduler(`✅ Training tomorrow (${formatDateLocale(tomorrow)}) at ${time} - sending announcement`)
        await runScheduled()
      } else {
        log.scheduler(`⏭️  No training tomorrow (${formatDateLocale(tomorrow)}) at ${time} - skipping`)
      }
      logNextAnnouncement()
    })
  })

  // Re-arm on startup: a restart must not silently drop an attendance check or a quiz answer
  attendance.armTimers()
  void rulesQuiz.armAnswer()
  logNextAnnouncement()
}
