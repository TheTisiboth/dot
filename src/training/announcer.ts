import type { Api } from 'grammy'
import { type SeasonManager, type Training } from './season'
import { type MessageGenerator } from './messages/messageGenerator'
import { type AttendanceMonitor } from './attendance'
import type { BotConfig } from '../config/env'
import { type RulesQuizService } from '../quiz/service'
import { errorMessage, log } from '../shared/logger'
import { EMOJIS } from '../shared/emojis'
import { formatClock } from '../shared/formatters'
import { senderFor } from '../telegram/sender'

export const PART_NAMES = {
  announcement: 'Announcement',
  keyRequest: 'Key request',
  trainerRequest: 'Trainer request',
  quiz: 'Rules quiz'
} as const

/** What happened to one message of a job: sent, deliberately not sent, or lost to an error. */
export type PartResult =
  | { status: 'sent' }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; error: string }

export type AnnounceReport = Record<keyof typeof PART_NAMES, PartResult>

interface AnnouncerDeps {
  config: Pick<BotConfig, 'telegram'>;
  seasonManager: SeasonManager;
  messageGenerator: MessageGenerator;
  attendance: AttendanceMonitor;
  bot: Api;
  rulesQuiz: RulesQuizService;
}

export type Announcer = ReturnType<typeof announcer>

/** The day-before posts: announcement, key and trainer requests, then the quiz. */
export const announcer = ({ config, seasonManager, messageGenerator, attendance, bot, rulesQuiz }: AnnouncerDeps) => {
  const toTeam = senderFor(bot, config.telegram.teamChat)
  const toTrainers = senderFor(bot, config.telegram.trainerChat)
  const { enableTrainerMessages } = config.telegram

  const sendKeyRequest = async (training: Training): Promise<PartResult> => {
    if (!training.keyRequestEnabled) {
      log.scheduler(`Key request disabled for ${training.season}, skipping`)
      return { status: 'skipped', reason: `disabled for ${training.season}` }
    }

    return await attempt('Sending key request', async () => {
      await toTeam.text(messageGenerator.keyRequest())
      log.scheduler('Key request sent to team')
    })
  }

  const sendTrainerRequest = async (training: Training, useLLM: boolean): Promise<PartResult> => {
    if (!enableTrainerMessages) {
      log.scheduler('Trainer messages disabled, skipping trainer request')
      return { status: 'skipped', reason: 'trainer messages disabled' }
    }

    return await attempt('Sending trainer request', async () => {
      const trainerRequest = await messageGenerator.trainerRequest(training, { useLLM })
      await toTrainers.text(trainerRequest, { fallback: () => messageGenerator.trainerRequestTemplate(training) })

      log.scheduler(`Trainer request sent - ${training.season} at ${training.location.name} (${formatClock(training.startsAt)}) using ${useLLM ? 'LLM' : 'template'}`)
    })
  }

  /** Key and trainer requests wait for the announcement, so a retry never posts them twice. */
  const announce = async (training: Training): Promise<Omit<AnnounceReport, 'quiz'>> => {
    if (training.cancelled) {
      log.scheduler('⏭️  Training cancelled - nothing sent to team or trainers')
      const cancelled: PartResult = { status: 'skipped', reason: 'training cancelled' }
      return { announcement: cancelled, keyRequest: cancelled, trainerRequest: cancelled }
    }

    const useLLM = messageGenerator.isLLMAvailable()

    const announcement = await attempt('Sending announcement', async () => {
      const message = await messageGenerator.announcement(training, { useLLM })
      const messageId = await toTeam.text(message, { fallback: () => messageGenerator.announcementTemplate(training) })
      attendance.track(training, messageId)

      log.scheduler(`Announcement sent to team - ${training.season} at ${training.location.name} (${formatClock(training.startsAt)}) using ${useLLM ? 'LLM' : 'template'}`)
    })

    if (announcement.status === 'failed') {
      const notSent: PartResult = { status: 'skipped', reason: 'announcement failed' }
      return { announcement, keyRequest: notSent, trainerRequest: notSent }
    }

    return {
      announcement,
      keyRequest: await sendKeyRequest(training),
      trainerRequest: await sendTrainerRequest(training, useLLM)
    }
  }

  return {
    announce,

    /** Posts the announcement, key and trainer requests, then the quiz, and says what happened to each (used by /send_to_all). */
    async announceTraining(training = seasonManager.nextTraining()): Promise<AnnounceReport> {
      const parts = await announce(training)
      // A failed announcement must not skip the quiz, which goes out even if training is cancelled
      return { ...parts, quiz: await rulesQuiz.sendScheduled() }
    }
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
