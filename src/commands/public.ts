import { type SeasonManager } from '../services/SeasonManager'
import { EMOJIS } from '../utils/constants'
import { formatClock, formatDate, locationLink } from '../utils/formatters'
import { type Command } from './registry'

const START_TEXT = `${EMOJIS.FRISBEE} Welcome to Ultimate Frisbee Training Bot!

I send training reminders to the team group 24h before each practice.

Type /help to see available commands.`

const HELP_TEXT = `${EMOJIS.FRISBEE} Available Commands

/info - Show training schedule for all seasons
/training - Show next training session`

export const publicCommands = (seasonManager: SeasonManager): Command[] => [
  {
    name: 'start',
    description: 'Start the bot',
    run: ({ reply }) => reply(START_TEXT)
  },
  {
    name: 'help',
    description: 'Show available commands',
    run: ({ reply }) => reply(HELP_TEXT)
  },
  {
    name: 'info',
    description: 'Show training schedule',
    run: ({ reply }) => reply(seasonManager.scheduleText(), { parse_mode: 'HTML' })
  },
  {
    name: 'training',
    description: 'Show next training',
    run: ({ reply }) => reply(nextTrainingText(seasonManager), { parse_mode: 'HTML' })
  }
]

const nextTrainingText = (seasonManager: SeasonManager): string => {
  const training = seasonManager.nextTraining()
  const cancelled = training.cancelled ? `\n\n${EMOJIS.CROSS_MARK} <b>Cancelled</b>` : ''
  const timeLines = training.throwingAt
    ? `${EMOJIS.FIRE} Throwing: ${formatClock(training.throwingAt)}\n${EMOJIS.CLOCK} Training: ${formatClock(training.startsAt)}`
    : `${EMOJIS.CLOCK} ${formatClock(training.startsAt)}`

  return `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} ${formatDate(training.startsAt)}
${timeLines}
${EMOJIS.LOCATION} ${locationLink(training.location)}${cancelled}`
}
