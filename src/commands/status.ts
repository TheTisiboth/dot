import { type SeasonManager, type Training } from '../training/season'
import { type AttendanceMonitor, CHECK_LABELS, type CheckStatus, type CheckStatuses } from '../training/attendance'
import { type RulesQuizService } from '../quiz/service'
import { modeFor } from '../quiz/picker'
import { type Check } from '../health/server'
import type { BotConfig } from '../config/env'
import { EMOJIS } from '../shared/emojis'
import { capitalize, formatClock, formatDate, getDayName, link, locationLink } from '../shared/formatters'
import { log } from '../shared/logger'
import { type ChatTarget } from '../telegram/sender'
import { type Command } from './registry'

interface StatusDeps {
  config: Pick<BotConfig, 'telegram' | 'rulesQuiz'>;
  seasonManager: SeasonManager;
  attendance: Pick<AttendanceMonitor, 'inspect' | 'checksOf' | 'announcementOf'>;
  rulesQuiz: Pick<RulesQuizService, 'answerDue'>;
  /** The `/health` probes. */
  dependencies: () => Promise<Record<string, Check>>;
  startedAt: Date;
  version: string;
}

/** What the team chat history said: the 👍 count, or why there is none. */
type Count = { count: number; threshold: number; announcementId: number } | 'no announcement' | 'unreadable'

interface Snapshot {
  training: Training;
  nextAnnouncement: ReturnType<SeasonManager['nextAnnouncement']>;
  announcementId?: number;
  count: Count;
  checks: CheckStatuses;
  answerDue: ReturnType<RulesQuizService['answerDue']>;
  dependencies: Record<string, Check>;
}

const DEPENDENCY_NAMES: Record<string, string> = { telegram: 'Telegram', mtproto: 'MTProto', ollama: 'LLM' }
const DEPENDENCY_STATES: Record<Check['status'], string> = { ok: `${EMOJIS.CHECK_MARK} ok`, down: `${EMOJIS.CROSS_MARK} down`, disabled: 'off' }
const MINUTES_PER_DAY = 24 * 60

const when = (date: Date): string => `${getDayName(date.getDay())}, ${formatDate(date)} at ${formatClock(date)}`

/** A t.me link works for supergroups only, whose ids are -100 followed by the channel id. */
const messageLink = ({ chatId, threadId }: ChatTarget, messageId: number): string => {
  const channelId = /^-100(\d+)$/.exec(chatId)?.[1]
  if (!channelId) return `message <code>${messageId}</code>`
  return link(`https://t.me/c/${channelId}/${threadId ? `${threadId}/` : ''}${messageId}`, 'open it')
}

const uptime = (startedAt: Date, now: Date): string => {
  const minutes = Math.floor((now.getTime() - startedAt.getTime()) / 60_000)
  return `${Math.floor(minutes / MINUTES_PER_DAY)}d ${Math.floor((minutes % MINUTES_PER_DAY) / 60)}h ${minutes % 60}m`
}

const checkLine = (status: CheckStatus | undefined): string => {
  if (!status) return 'armed once the announcement is posted'
  switch (status.state) {
    case 'armed': return `armed for ${when(status.at)}`
    case 'fired': return `ran ${when(status.at)}`
    case 'skipped': return `skipped: ${status.reason}`
  }
}

const trainingSection = ({ startsAt, location, season, cancelled }: Training): string =>
  `${EMOJIS.RUNNER} <b>Next training</b>
${when(startsAt)}, ${locationLink(location)}
${capitalize(season)} season${cancelled ? ` · ${EMOJIS.CROSS_MARK} <b>Cancelled</b>` : ''}`

const announcementLine = ({ training, nextAnnouncement, announcementId, count }: Snapshot, chat: ChatTarget): string => {
  if (announcementId !== undefined) return `Posted: ${messageLink(chat, announcementId)}`
  if (nextAnnouncement.training.startsAt.getTime() === training.startsAt.getTime()) return `Due ${when(nextAnnouncement.announcesAt)}`
  return count === 'unreadable' ? 'Can\'t tell: the team chat can\'t be read' : `${EMOJIS.WARNING} Not found in the team chat`
}

const countLine = (count: Count): string => {
  if (count === 'unreadable') return 'Players in: can\'t tell, the team chat can\'t be read'
  if (count === 'no announcement') return 'Players in: nothing to count yet'
  return `Players in: <b>${count.count}</b> / ${count.threshold}`
}

const quizSection = (config: BotConfig['rulesQuiz'], training: Training, answerDue: Snapshot['answerDue']): string => {
  if (!config.enabled) return '<b>Rules quiz</b>: off'
  const answer = answerDue ? `Answer to <code>${answerDue.questionId}</code> due ${when(answerDue.at)}` : 'No answer pending'
  return `<b>Rules quiz</b>: on, ${modeFor(training.season)} questions\n${answer}`
}

const dependencyLines = (dependencies: Record<string, Check>): string =>
  Object.entries(dependencies).map(([name, { status }]) => `${DEPENDENCY_NAMES[name] ?? name}: ${DEPENDENCY_STATES[status]}`).join('\n')

/** The /status reply: a pure rendering of what the services hold at `now`. */
const statusText = (snapshot: Snapshot, { config, startedAt, version }: Pick<StatusDeps, 'config' | 'startedAt' | 'version'>, now: Date): string => `${EMOJIS.ROBOT} <b>Status</b>

${trainingSection(snapshot.training)}

${EMOJIS.MEGAPHONE} <b>Announcement</b>
${announcementLine(snapshot, config.telegram.teamChat)}
${countLine(snapshot.count)}
${CHECK_LABELS.reminder}: ${checkLine(snapshot.checks.reminder)}
${CHECK_LABELS.cancellation}: ${checkLine(snapshot.checks.cancellation)}

${quizSection(config.rulesQuiz, snapshot.training, snapshot.answerDue)}

<b>Dependencies</b>
${dependencyLines(snapshot.dependencies)}

${EMOJIS.CLOCK} dot ${version}, up ${uptime(startedAt, now)}`

/** Admin command: what the bot will do next, read from the services; it changes nothing. */
export const statusCommand = ({ config, seasonManager, attendance, rulesQuiz, dependencies, startedAt, version }: StatusDeps): Command => ({
  name: 'status',
  description: 'Show what the bot will do next',
  adminOnly: true,
  run: async ({ reply }) => {
    const now = new Date()
    const training = seasonManager.nextTraining(now)
    const checks = await dependencies()

    // Read only when MTProto is up: a down one would hold the reply for its connect timeout
    let count: Count = 'unreadable'
    if (checks.mtproto?.status === 'ok') {
      try {
        count = await attendance.inspect() ?? 'no announcement'
      } catch (error) {
        log.error('Reading the attendance for /status', error)
      }
    }

    const snapshot: Snapshot = {
      training,
      nextAnnouncement: seasonManager.nextAnnouncement(now),
      announcementId: typeof count === 'object' ? count.announcementId : attendance.announcementOf(training),
      count,
      checks: attendance.checksOf(training),
      answerDue: rulesQuiz.answerDue(),
      dependencies: checks
    }
    await reply.text(statusText(snapshot, { config, startedAt, version }, now))
  }
})
