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

const WRITING = `${EMOJIS.ROBOT} Writing it with the LLM...`

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
      description: 'Preview the template announcement',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.text(`${EMOJIS.MEMO} Template announcement:\n\n${templates.announcement(seasonManager.nextTraining())}`)
      }
    },
    {
      name: 'test_llm',
      description: 'Preview the LLM announcement',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(WRITING)
        await reply.text(`${EMOJIS.ROBOT} Announcement:\n\n${await announcement()}`)
      }
    },
    {
      name: 'test_trainer',
      description: 'Preview the LLM trainer request',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(WRITING)
        await reply.text(`${EMOJIS.ROBOT} Trainer request:\n\n${await trainerRequest()}`)
      }
    },
    {
      name: 'test_key',
      description: 'Preview the key request',
      adminOnly: true,
      run: async ({ reply }) => {
        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        const status = keyRequestEnabled ? '' : `\n\n${EMOJIS.WARNING} Off for ${season}: it won't be sent.`
        await reply.text(`${EMOJIS.KEY} Key request:\n\n${templates.keyRequest()}${status}`)
      }
    },
    {
      name: 'preview_team',
      description: 'Preview the announcement as it would be posted',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.text(`${EMOJIS.FRISBEE} <b>Announcement preview:</b>\n\n${await announcement()}`)
      }
    },
    {
      name: 'preview_all',
      description: 'Preview the announcement, key and trainer requests',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply.plain(`${EMOJIS.ROBOT} Writing the previews...`)
        await reply.text(`${EMOJIS.FRISBEE} <b>Announcement preview:</b>\n\n${await announcement()}`)

        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        if (keyRequestEnabled) {
          await reply.text(`${EMOJIS.KEY} <b>Key request preview:</b>\n\n${templates.keyRequest()}`)
        } else {
          await reply.plain(`${EMOJIS.KEY} Key request off for ${season}`)
        }

        await reply.text(`${EMOJIS.RUNNER} <b>Trainer request preview:</b>\n\n${await trainerRequest()}`)
        await reply.text(`${EMOJIS.CHECK_MARK} Previews done. <code>/send_to_all</code> posts them for real.`)
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
      description: 'Show the live 👍 count on the announcement',
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
