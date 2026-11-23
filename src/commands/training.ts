import type { Api } from 'grammy'
import { type SeasonManager } from '../training/season'
import { type TrainingMessages } from '../training/messages/messages'
import * as templates from '../training/messages/templates'
import { type Announcer, describeReport, hasFailure } from '../training/announcer'
import { type AttendanceMonitor } from '../training/attendance'
import type { BotConfig } from '../config/env'
import { EMOJIS } from '../shared/emojis'
import { formatClock, formatDate } from '../shared/formatters'
import { senderFor } from '../telegram/sender'
import { type Command } from './registry'

const GENERATING_LLM_MESSAGE = 'Generating LLM message...'

interface TrainingCommandsDeps {
  config: Pick<BotConfig, 'telegram' | 'attendance'>;
  api: Api;
  seasonManager: SeasonManager;
  messages: TrainingMessages;
  announcer: Announcer;
  attendance: AttendanceMonitor;
}

/** Admin commands to preview and send the training messages before the scheduler does. */
export const trainingCommands = ({ config, api, seasonManager, messages, announcer, attendance }: TrainingCommandsDeps): Command[] => {
  const announcement = () => messages.announcement(seasonManager.nextTraining())
  const trainerRequest = () => messages.trainerRequest(seasonManager.nextTraining())

  return [
    {
      name: 'test_template',
      description: 'Preview template message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.text(`${EMOJIS.MEMO} Template Message:\n\n${templates.announcement(seasonManager.nextTraining())}`)
      }
    },
    {
      name: 'test_llm',
      description: 'Preview LLM team message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} ${GENERATING_LLM_MESSAGE}`)
        await reply.text(`${EMOJIS.ROBOT} LLM Generated Message:\n\n${await announcement()}`)
      }
    },
    {
      name: 'test_trainer',
      description: 'Preview LLM trainer message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} ${GENERATING_LLM_MESSAGE}`)
        await reply.text(`${EMOJIS.ROBOT} Trainer LLM Generated Message:\n\n${await trainerRequest()}`)
      }
    },
    {
      name: 'test_key',
      description: 'Preview key-holder message',
      adminOnly: true,
      run: async ({ reply }) => {
        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        const status = keyRequestEnabled ? '' : `\n\n${EMOJIS.WARNING} Disabled for ${season}: it will not be sent.`
        await reply.text(`${EMOJIS.KEY} Key Message:\n\n${templates.keyRequest()}${status}`)
      }
    },
    {
      name: 'preview_team',
      description: 'Preview team message (template or LLM)',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.text(`${EMOJIS.FRISBEE} <b>Team Message Preview:</b>\n\n${await announcement()}`)
      }
    },
    {
      name: 'preview_all',
      description: 'Preview both team and trainer messages',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Generating preview messages...`)
        await reply.text(`${EMOJIS.FRISBEE} <b>Team Message Preview:</b>\n\n${await announcement()}`)

        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        if (keyRequestEnabled) {
          await reply.text(`${EMOJIS.KEY} <b>Key Message Preview:</b>\n\n${templates.keyRequest()}`)
        } else {
          await reply.plain(`${EMOJIS.KEY} Key message disabled for ${season}`)
        }

        await reply.text(`${EMOJIS.RUNNER} <b>Trainer Message Preview:</b>\n\n${await trainerRequest()}`)
        await reply.text(`${EMOJIS.CHECK_MARK} Preview complete! Use <code>/send_to_all</code> to send to actual chats.`)
      }
    },
    {
      name: 'send_to_team',
      description: 'Send message to team chat',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Sending message to team chat...`)
        const fallback = () => templates.announcement(seasonManager.nextTraining())
        await senderFor(api, config.telegram.teamChat).text(await announcement(), { fallback })
        await reply.plain(`${EMOJIS.CHECK_MARK} Message sent to team chat!`)
      }
    },
    {
      name: 'send_to_all',
      description: 'Send messages to team and trainer chats',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Sending messages to team and trainer chats...`)
        const report = await announcer.announceTraining()
        const header = hasFailure(report) ? `${EMOJIS.WARNING} Some messages failed:` : `${EMOJIS.CHECK_MARK} Messages sent:`
        await reply.plain(`${header}\n\n${describeReport(report)}`)
      }
    },
    {
      name: 'attendance',
      description: 'Show live 👍 count on the training post',
      adminOnly: true,
      run: async ({ reply }) => {
        const check = await attendance.inspect()
        if (!check) {
          await reply.plain(`${EMOJIS.WARNING} No training post found for the next training - nothing to count yet.`)
          return
        }

        const { count, threshold, announcementId, training } = check
        const status = count >= threshold ? `${EMOJIS.CHECK_MARK} Enough players` : `${EMOJIS.WARNING} Below threshold`
        const { reminderHoursBefore, cancelHoursBefore } = config.attendance

        await reply.text(`${EMOJIS.THUMBS_UP} <b>Attendance</b>

${status}: <b>${count}</b> / <b>${threshold}</b>

${EMOJIS.CALENDAR} Training: ${formatDate(training.startsAt)} at ${formatClock(training.startsAt)}
${EMOJIS.MEMO} Poll message id: <code>${announcementId}</code>
${EMOJIS.CLOCK} Reminder ${reminderHoursBefore}h before, cancellation ${cancelHoursBefore}h before`)
      }
    }
  ]
}
