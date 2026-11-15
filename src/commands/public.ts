import { type SeasonManager } from '../services/SeasonManager'
import { type SeasonConfigBase, type DateConfig } from '../types'
import { config } from '../config'
import { EMOJIS } from '../utils/constants'
import { getDateBefore } from '../utils/dateHelpers'
import { capitalize, formatDateShort, formatDate, formatPracticeDays } from '../utils/formatters'
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
    run: ({ reply }) => reply(scheduleText(), { parse_mode: 'Markdown' })
  },
  {
    name: 'training',
    description: 'Show next training',
    run: ({ reply }) => reply(nextTrainingText(seasonManager), { parse_mode: 'Markdown' })
  }
]

const scheduleText = (): string => {
  const { winter, summer } = config.seasons
  return `${EMOJIS.CALENDAR} Training Schedule

${seasonText('winter', winter, summer.startDate)}

${seasonText('summer', summer, winter.startDate)}`
}

const seasonText = (season: 'winter' | 'summer', seasonConfig: SeasonConfigBase, nextSeasonStart: DateConfig): string => {
  const emoji = season === 'winter' ? EMOJIS.WINTER : EMOJIS.SUMMER
  const start = formatDateShort(seasonConfig.startDate)
  const end = formatDateShort(getDateBefore(nextSeasonStart))

  return `${emoji} ${capitalize(season)} (${start} - ${end}):
${formatPracticeDays(seasonConfig.practices)}
   ${EMOJIS.LOCATION} ${seasonConfig.location}`
}

const nextTrainingText = (seasonManager: SeasonManager): string => {
  const training = seasonManager.getNextTrainingInfo()
  const timeLines = training.throwingTime
    ? `${EMOJIS.FIRE} Throwing: ${training.throwingTime}\n${EMOJIS.CLOCK} Training: ${training.time}`
    : `${EMOJIS.CLOCK} ${training.time}`

  return `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} ${formatDate(training.date)}
${timeLines}
${EMOJIS.LOCATION} ${training.location}`
}
