import type { Api } from 'grammy'
import type { InlineKeyboardMarkup } from 'grammy/types'
import { type SeasonManager, type Training } from '../training/season'
import { type TrainingMessages } from '../training/messages/messages'
import * as templates from '../training/messages/templates'
import { type Attendance } from '../training/messages/templates'
import { type Announcer, describeReport, hasFailure } from '../training/announcer'
import { type AttendanceMonitor } from '../training/attendance'
import type { BotConfig } from '../config/env'
import { EMOJIS } from '../shared/emojis'
import { formatClock, formatDate } from '../shared/formatters'
import { senderFor } from '../telegram/sender'
import { type Command } from './registry'

const WRITING = `${EMOJIS.ROBOT} Writing it with the LLM...`

interface TrainingCommandsDeps {
  config: Pick<BotConfig, 'telegram' | 'attendance'>;
  api: Api;
  seasonManager: SeasonManager;
  messages: TrainingMessages;
  announcer: Announcer;
  attendance: AttendanceMonitor;
  /** Offers the LLM / template toggle. */
  llmEnabled: boolean;
}

const PART_LABELS = {
  announcement: 'Announcement',
  keyRequest: 'Key request',
  trainerRequest: 'Trainer request',
  attendanceReminder: 'Attendance reminder',
  cancellationNotice: 'Cancellation notice'
} as const
type Part = keyof typeof PART_LABELS
type Mode = 'llm' | 'template'

const BUTTON_LABELS = { all: 'Everything', ...PART_LABELS }
const PREVIEWS = Object.keys(PART_LABELS) as Part[]
/** What the day-before run posts, in its order. */
const SCHEDULED_RUN: Part[] = ['announcement', 'keyRequest', 'trainerRequest']
const LLM_WRITTEN: Part[] = ['announcement', 'trainerRequest', 'attendanceReminder']
const SAMPLED: Part[] = ['attendanceReminder', 'cancellationNotice']

// Both are only ever sent below the threshold
const sampleAttendance = ({ minAttendance }: Training): Attendance => ({ count: Math.floor(minAttendance / 2), threshold: minAttendance })

const MENU_TEXT = `${EMOJIS.MEMO} <b>Preview</b>

Tap a message to see it as the next training would get it. Previews stay in this chat.`

/** Callback data `preview:<part|all|mode>:<mode>`: the mode lives in the buttons, so a restart loses nothing. */
const menuFor = (llmEnabled: boolean) => (mode: Mode): InlineKeyboardMarkup => {
  const button = (target: keyof typeof BUTTON_LABELS) => ({ text: BUTTON_LABELS[target], callback_data: `preview:${target}:${mode}` })
  const other: Mode = mode === 'llm' ? 'template' : 'llm'
  return {
    inline_keyboard: [
      [button('all')],
      [button('announcement'), button('keyRequest'), button('trainerRequest')],
      [button('attendanceReminder'), button('cancellationNotice')],
      ...(llmEnabled ? [[{ text: mode === 'llm' ? `${EMOJIS.ROBOT} LLM · tap for template` : `${EMOJIS.MEMO} Template · tap for LLM`, callback_data: `preview:mode:${other}` }]] : [])
    ]
  }
}

/** Admin commands to preview and send the training messages before the scheduler does. */
export const trainingCommands = ({ config, api, seasonManager, messages, announcer, attendance, llmEnabled }: TrainingCommandsDeps): Command[] => {
  const announcement = () => messages.announcement(seasonManager.nextTraining())
  const menu = menuFor(llmEnabled)

  /** Why the scheduler would not send `part` for `training`, as the announcer and attendance monitor decide. */
  const notSent = (part: Part, training: Training): string | undefined => {
    if (training.cancelled) return 'training cancelled'
    if (part === 'keyRequest' && !training.keyRequestEnabled) return `disabled for this season (${training.season})`
    if ((part === 'trainerRequest' || part === 'cancellationNotice') && !config.telegram.enableTrainerMessages) return 'trainer requests off'
    return undefined
  }

  const draft = async (part: Part, training: Training, mode: Mode): Promise<string> => {
    const llm = mode === 'llm'
    switch (part) {
      case 'announcement': return llm ? await messages.announcement(training) : templates.announcement(training)
      case 'keyRequest': return templates.keyRequest()
      case 'trainerRequest': return llm ? await messages.trainerRequest(training) : templates.trainerRequest(training)
      case 'attendanceReminder': {
        const sample = sampleAttendance(training)
        return llm ? await messages.attendanceReminder(training, sample) : templates.attendanceReminder(training, sample)
      }
      case 'cancellationNotice': return templates.cancellationNotice(training, sampleAttendance(training), config.attendance.cancelHoursBefore)
    }
  }

  const preview = async (part: Part, training: Training, mode: Mode, notSentReason: string | undefined): Promise<string> => {
    const sample = SAMPLED.includes(part) ? ` (sample: ${sampleAttendance(training).count} of ${training.minAttendance} in)` : ''
    const status = notSentReason ? `\n\n⏭️ Not sent: ${notSentReason}.` : ''
    return `<b>${PART_LABELS[part]} preview</b>${sample}\n\n${await draft(part, training, mode)}${status}`
  }

  return [
    {
      name: 'preview',
      description: 'Preview what the next training gets',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.text(MENU_TEXT, { buttons: menu(llmEnabled ? 'llm' : 'template') })
      },
      onButton: async ({ data, reply, setButtons }) => {
        const [target = '', mode] = data.split(':')
        if (mode !== 'llm' && mode !== 'template') throw new Error(`Unknown preview button: ${data}`)
        if (target === 'mode') {
          await setButtons(menu(mode))
          return
        }

        const parts = target === 'all' ? SCHEDULED_RUN : PREVIEWS.filter(part => part === target)
        if (parts.length === 0) throw new Error(`Unknown preview button: ${data}`)

        const training = seasonManager.nextTraining()
        if (mode === 'llm' && parts.some(part => LLM_WRITTEN.includes(part))) await reply.plain(WRITING)
        for (const part of parts) {
          const reason = notSent(part, training)
          if (target === 'all' && reason) await reply.plain(`⏭️ ${PART_LABELS[part]}: ${reason}`)
          else await reply.text(await preview(part, training, mode, reason))
        }
        if (target === 'all') await reply.plain(`${EMOJIS.CHECK_MARK} That's everything for the team and trainers. /quiz_preview shows the quiz question.`)
      }
    },
    {
      name: 'send_to_team',
      description: 'Post the announcement to the team chat',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Posting the announcement to the team chat...`)
        const fallback = () => templates.announcement(seasonManager.nextTraining())
        await senderFor(api, config.telegram.teamChat).text(await announcement(), { fallback })
        await reply.plain(`${EMOJIS.CHECK_MARK} Announcement posted.`)
      }
    },
    {
      name: 'send_to_all',
      description: 'Post the announcement, requests and quiz question now',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Posting to the team, trainer and rules chats...`)
        const report = await announcer.announceTraining()
        const header = hasFailure(report) ? `${EMOJIS.WARNING} Some posts failed:` : `${EMOJIS.CHECK_MARK} Done:`
        await reply.plain(`${header}\n\n${describeReport(report)}`)
      }
    },
    {
      name: 'attendance',
      description: 'Show how many players are in so far',
      adminOnly: true,
      run: async ({ reply }) => {
        const check = await attendance.inspect()
        if (!check) {
          await reply.plain(`${EMOJIS.WARNING} No announcement for the next training yet: nothing to count.`)
          return
        }

        const { count, threshold, announcementId, training } = check
        const status = count >= threshold ? `${EMOJIS.CHECK_MARK} Enough players` : `${EMOJIS.WARNING} Not enough yet`
        const { reminderHoursBefore, cancelHoursBefore } = config.attendance

        await reply.text(`${EMOJIS.THUMBS_UP} <b>Attendance</b>

${status}: <b>${count}</b> / <b>${threshold}</b>

${EMOJIS.CALENDAR} Training: ${formatDate(training.startsAt)} at ${formatClock(training.startsAt)}
${EMOJIS.MEMO} Announcement id: <code>${announcementId}</code>
${EMOJIS.CLOCK} Reminder ${reminderHoursBefore}h before, cancellation notice ${cancelHoursBefore}h before`)
      }
    }
  ]
}
