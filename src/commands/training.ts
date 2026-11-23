import type { Api } from 'grammy'
import { type SeasonManager } from '../training/season'
import { type MessageGenerator } from '../training/messages/messageGenerator'
import { describeReport, hasFailure, type SchedulerService } from '../training/scheduler'
import type { BotConfig } from '../config/env'
import { EMOJIS } from '../shared/emojis'
import { formatClock, formatDate } from '../shared/formatters'
import { sendWithFallback, threadOptions } from '../telegram/botApi'
import { type Command } from './registry'

const GENERATING_LLM_MESSAGE = 'Generating LLM message...'

interface TrainingCommandsDeps {
  config: Pick<BotConfig, 'telegram' | 'attendance'>;
  api: Api;
  seasonManager: SeasonManager;
  messageGenerator: MessageGenerator;
  scheduler: SchedulerService;
}

const HTML = { parse_mode: 'HTML' } as const

/** Admin commands to preview and send the training messages before the scheduler does. */
export const trainingCommands = ({ config, api, seasonManager, messageGenerator, scheduler }: TrainingCommandsDeps): Command[] => {
  const announcement = (useLLM = messageGenerator.isLLMAvailable()) =>
    messageGenerator.announcement(seasonManager.nextTraining(), { useLLM })
  const trainerRequest = (useLLM = messageGenerator.isLLMAvailable()) =>
    messageGenerator.trainerRequest(seasonManager.nextTraining(), { useLLM })

  return [
    {
      name: 'test_template',
      description: 'Preview template message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.MEMO} Template Message:\n\n${await announcement(false)}`, HTML)
      }
    },
    {
      name: 'test_llm',
      description: 'Preview LLM team message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} ${GENERATING_LLM_MESSAGE}`)
        await reply(`${EMOJIS.ROBOT} LLM Generated Message:\n\n${await announcement(true)}`, HTML)
      }
    },
    {
      name: 'test_trainer',
      description: 'Preview LLM trainer message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} ${GENERATING_LLM_MESSAGE}`)
        await reply(`${EMOJIS.ROBOT} Trainer LLM Generated Message:\n\n${await trainerRequest(true)}`, HTML)
      }
    },
    {
      name: 'test_key',
      description: 'Preview key-holder message',
      adminOnly: true,
      run: async ({ reply }) => {
        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        const status = keyRequestEnabled ? '' : `\n\n${EMOJIS.WARNING} Disabled for ${season}: it will not be sent.`
        await reply(`${EMOJIS.KEY} Key Message:\n\n${messageGenerator.keyRequest()}${status}`, HTML)
      }
    },
    {
      name: 'preview_team',
      description: 'Preview team message (template or LLM)',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.FRISBEE} <b>Team Message Preview:</b>\n\n${await announcement()}`, HTML)
      }
    },
    {
      name: 'preview_all',
      description: 'Preview both team and trainer messages',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Generating preview messages...`)
        await reply(`${EMOJIS.FRISBEE} <b>Team Message Preview:</b>\n\n${await announcement()}`, HTML)

        const { keyRequestEnabled, season } = seasonManager.nextTraining()
        if (keyRequestEnabled) {
          await reply(`${EMOJIS.KEY} <b>Key Message Preview:</b>\n\n${messageGenerator.keyRequest()}`, HTML)
        } else {
          await reply(`${EMOJIS.KEY} Key message disabled for ${season}`)
        }

        await reply(`${EMOJIS.RUNNER} <b>Trainer Message Preview:</b>\n\n${await trainerRequest()}`, HTML)
        await reply(`${EMOJIS.CHECK_MARK} Preview complete! Use <code>/send_to_all</code> to send to actual chats.`, HTML)
      }
    },
    {
      name: 'send_to_team',
      description: 'Send message to team chat',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Sending message to team chat...`)
        const fallback = () => messageGenerator.announcementTemplate(seasonManager.nextTraining())
        await sendWithFallback(api, config.telegram.teamChat.chatId, await announcement(), fallback, threadOptions(config.telegram.teamChat.threadId))
        await reply(`${EMOJIS.CHECK_MARK} Message sent to team chat!`)
      }
    },
    {
      name: 'send_to_all',
      description: 'Send messages to team and trainer chats',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Sending messages to team and trainer chats...`)
        const report = await scheduler.announceTraining()
        const header = hasFailure(report) ? `${EMOJIS.WARNING} Some messages failed:` : `${EMOJIS.CHECK_MARK} Messages sent:`
        await reply(`${header}\n\n${describeReport(report)}`)
      }
    },
    {
      name: 'attendance',
      description: 'Show live 👍 count on the training post',
      adminOnly: true,
      run: async ({ reply }) => {
        const attendance = await scheduler.inspectAttendance()
        if (!attendance) {
          await reply(`${EMOJIS.WARNING} No training post found for the next training - nothing to count yet.`)
          return
        }

        const { count, threshold, announcementId, training } = attendance
        const status = count >= threshold ? `${EMOJIS.CHECK_MARK} Enough players` : `${EMOJIS.WARNING} Below threshold`
        const { reminderHoursBefore, cancelHoursBefore } = config.attendance

        await reply(`${EMOJIS.THUMBS_UP} <b>Attendance</b>

${status}: <b>${count}</b> / <b>${threshold}</b>

${EMOJIS.CALENDAR} Training: ${formatDate(training.startsAt)} at ${formatClock(training.startsAt)}
${EMOJIS.MEMO} Poll message id: <code>${announcementId}</code>
${EMOJIS.CLOCK} Reminder ${reminderHoursBefore}h before, cancellation ${cancelHoursBefore}h before`, HTML)
      }
    }
  ]
}
