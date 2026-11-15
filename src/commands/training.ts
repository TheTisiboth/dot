import type { Api } from 'grammy'
import { type SeasonManager } from '../services/SeasonManager'
import { type MessageGenerator } from '../services/MessageGenerator'
import { describeReport, hasFailure, type SchedulerService } from '../services/SchedulerService'
import { config } from '../config'
import { EMOJIS, MESSAGES } from '../utils/constants'
import { formatDate } from '../utils/formatters'
import { threadOptions } from '../utils/telegram'
import { type Command } from './registry'

interface TrainingCommandsDeps {
  api: Api;
  seasonManager: SeasonManager;
  messageGenerator: MessageGenerator;
  scheduler: SchedulerService;
}

const MARKDOWN = { parse_mode: 'Markdown' } as const

/** Admin commands to preview and send the training messages before the scheduler does. */
export const trainingCommands = ({ api, seasonManager, messageGenerator, scheduler }: TrainingCommandsDeps): Command[] => {
  const nextTraining = () => {
    const training = seasonManager.getNextTrainingInfo()
    return { training, season: seasonManager.getCurrentSeasonConfig(training.date) }
  }
  const teamMessage = (useLLM = messageGenerator.isLLMAvailable()) => {
    const { training, season } = nextTraining()
    return messageGenerator.generateMessage(season, { useLLM }, training.practiceDay)
  }
  const trainerMessage = (useLLM = messageGenerator.isLLMAvailable()) => {
    const { training, season } = nextTraining()
    return messageGenerator.generateTrainerMessage(season, { useLLM }, training.practiceDay)
  }

  return [
    {
      name: 'test_template',
      description: 'Preview template message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.MEMO} Template Message:\n\n${await teamMessage(false)}`, MARKDOWN)
      }
    },
    {
      name: 'test_llm',
      description: 'Preview LLM team message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)
        await reply(`${EMOJIS.ROBOT} LLM Generated Message:\n\n${await teamMessage(true)}`, MARKDOWN)
      }
    },
    {
      name: 'test_trainer',
      description: 'Preview LLM trainer message',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`)
        await reply(`${EMOJIS.ROBOT} Trainer LLM Generated Message:\n\n${await trainerMessage(true)}`, MARKDOWN)
      }
    },
    {
      name: 'test_key',
      description: 'Preview key-holder message',
      adminOnly: true,
      run: async ({ reply }) => {
        const { season } = nextTraining()
        const status = season.keyMessageEnabled ? '' : `\n\n${EMOJIS.WARNING} Disabled for ${season.season}: it will not be sent.`
        await reply(`${EMOJIS.KEY} Key Message:\n\n${messageGenerator.generateKeyMessage()}${status}`, MARKDOWN)
      }
    },
    {
      name: 'preview_team',
      description: 'Preview team message (template or LLM)',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${await teamMessage()}`, MARKDOWN)
      }
    },
    {
      name: 'preview_all',
      description: 'Preview both team and trainer messages',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Generating preview messages...`)
        await reply(`${EMOJIS.FRISBEE} *Team Message Preview:*\n\n${await teamMessage()}`, MARKDOWN)

        const { season } = nextTraining()
        if (season.keyMessageEnabled) {
          await reply(`${EMOJIS.KEY} *Key Message Preview:*\n\n${messageGenerator.generateKeyMessage()}`, MARKDOWN)
        } else {
          await reply(`${EMOJIS.KEY} Key message disabled for ${season.season}`)
        }

        await reply(`${EMOJIS.RUNNER} *Trainer Message Preview:*\n\n${await trainerMessage()}`, MARKDOWN)
        await reply(`${EMOJIS.CHECK_MARK} Preview complete! Use \`/send_to_all\` to send to actual chats.`, MARKDOWN)
      }
    },
    {
      name: 'send_to_team',
      description: 'Send message to team chat',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Sending message to team chat...`)
        await api.sendMessage(config.telegram.chatId, await teamMessage(), { ...MARKDOWN, ...threadOptions(config.telegram.chatThreadId) })
        await reply(`${EMOJIS.CHECK_MARK} Message sent to team chat!`)
      }
    },
    {
      name: 'send_to_all',
      description: 'Send messages to team and trainer chats',
      adminOnly: true,
      run: async ({ reply }) => {
        await reply(`${EMOJIS.ROBOT} Sending messages to team and trainer chats...`)
        const report = await scheduler.sendScheduledMessage()
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

        const { count, threshold, pollMessageId, training } = attendance
        const status = count >= threshold ? `${EMOJIS.CHECK_MARK} Enough players` : `${EMOJIS.WARNING} Below threshold`
        const { reminderHoursBefore, cancelHoursBefore } = config.attendance

        await reply(`${EMOJIS.THUMBS_UP} *Attendance*

${status}: *${count}* / *${threshold}*

${EMOJIS.CALENDAR} Training: ${formatDate(training.date)} at ${training.time}
${EMOJIS.MEMO} Poll message id: \`${pollMessageId}\`
${EMOJIS.CLOCK} Reminder ${reminderHoursBefore}h before, cancellation ${cancelHoursBefore}h before`, MARKDOWN)
      }
    }
  ]
}
