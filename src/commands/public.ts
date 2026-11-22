import { type SeasonManager } from '../training/season'
import { EMOJIS } from '../shared/emojis'
import { formatClock, formatDate, locationLink } from '../shared/formatters'
import { type Command, commandList } from './registry'

// No 👍 here: the announcement is found in chat history as the bot's standalone message with one
const START_TEXT = `${EMOJIS.FRISBEE} Hi, I'm dot, the team's training bot.

The day before each training I post an announcement: react to it to say if you're coming. If too few players are in, I remind the team, then tell the trainers.

I also ask who brings the hall key, and post rules quiz questions.

Type /help to see the commands.`

export const publicCommands = (seasonManager: SeasonManager): Command[] => [
  {
    name: 'start',
    description: 'Meet dot',
    run: ({ reply }) => reply.plain(START_TEXT)
  },
  {
    name: 'help',
    description: 'List the commands',
    run: ({ reply, commands }) => reply.plain(`${EMOJIS.FRISBEE} Available Commands\n\n${commandList(commands)}`)
  },
  {
    name: 'info',
    description: 'Show the season schedules',
    run: ({ reply }) => reply.text(seasonManager.scheduleText())
  },
  {
    name: 'training',
    description: 'Show the next training',
    run: ({ reply }) => reply.text(nextTrainingText(seasonManager))
  }
]

const nextTrainingText = (seasonManager: SeasonManager): string => {
  const training = seasonManager.nextTraining()
  const cancelled = training.cancelled ? `\n\n${EMOJIS.CROSS_MARK} <b>Cancelled</b>` : ''
  const timeLines = training.throwingAt
    ? `${EMOJIS.FIRE} Throwing: ${formatClock(training.throwingAt)}\n${EMOJIS.CLOCK} Training: ${formatClock(training.startsAt)}`
    : `${EMOJIS.CLOCK} ${formatClock(training.startsAt)}`

  return `${EMOJIS.RUNNER} Next training

${EMOJIS.CALENDAR} ${formatDate(training.startsAt)}
${timeLines}
${EMOJIS.LOCATION} ${locationLink(training.location)}${cancelled}`
}
