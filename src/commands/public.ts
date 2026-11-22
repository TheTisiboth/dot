import { type SeasonManager, type Training } from '../training/season'
import { type AttendanceMonitor, type LiveCount } from '../training/attendance'
import { EMOJIS } from '../shared/emojis'
import { countdown, formatClock, formatDate, getDayName, locationLink } from '../shared/formatters'
import { type ChatTarget, messageLink } from '../telegram/sender'
import { type Command, commandList } from './registry'

// No 👍 here: the announcement is found in chat history as the bot's standalone message with one
const START_TEXT = `${EMOJIS.FRISBEE} Hi, I'm dot, the team's training bot.

The day before each training I post an announcement: react to it to say if you're coming. If too few players are in, I remind the team, then tell the trainers.

I also ask who brings the hall key, and post rules quiz questions.

Type /help to see the commands.`

// Public, so it can be sent again and again in a busy chat: one history read per minute at most
const COUNT_CACHE_MS = 60_000

interface PublicCommandsDeps {
  teamChat: ChatTarget;
  seasonManager: SeasonManager;
  attendance: Pick<AttendanceMonitor, 'liveCount' | 'announcementOf'>;
  /** Whether MTProto is connected: the count is not read when it is not. */
  mtprotoUp: () => boolean;
}

export const publicCommands = ({ teamChat, seasonManager, attendance, mtprotoUp }: PublicCommandsDeps): Command[] => {
  let cached: { startsAt: number; readAt: number; count: Promise<LiveCount> } | undefined

  /** The count once the announcement exists, read at most once per COUNT_CACHE_MS. */
  const countOf = async (training: Training, now: Date): Promise<LiveCount> => {
    const notAnnouncedYet = attendance.announcementOf(training) === undefined
      && seasonManager.nextAnnouncement(now).training.startsAt.getTime() === training.startsAt.getTime()
    if (training.cancelled || notAnnouncedYet) return 'no announcement'

    const startsAt = training.startsAt.getTime()
    if (cached?.startsAt !== startsAt || now.getTime() - cached.readAt >= COUNT_CACHE_MS) {
      cached = { startsAt, readAt: now.getTime(), count: attendance.liveCount(mtprotoUp()) }
    }
    return await cached.count
  }

  return [
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
      run: async ({ reply }) => {
        const now = new Date()
        const training = seasonManager.nextTraining(now)
        await reply.text(nextTrainingText(training, await countOf(training, now), teamChat, now))
      }
    }
  ]
}

// No 👍 here either: the reply can be sent in the team chat
const countLine = (count: LiveCount, teamChat: ChatTarget): string => typeof count === 'object'
  ? `\n\n<b>${count.count}</b> of ${count.threshold} players in · ${messageLink(teamChat, count.announcementId, 'react to the announcement')}`
  : ''

const nextTrainingText = (training: Training, count: LiveCount, teamChat: ChatTarget, now: Date): string => {
  const cancelled = training.cancelled ? `\n\n${EMOJIS.CROSS_MARK} <b>Cancelled</b>` : ''
  const timeLines = training.throwingAt
    ? `${EMOJIS.FIRE} Throwing: ${formatClock(training.throwingAt)}\n${EMOJIS.CLOCK} Training: ${formatClock(training.startsAt)}`
    : `${EMOJIS.CLOCK} ${formatClock(training.startsAt)}`

  return `${EMOJIS.RUNNER} Next training, ${countdown(training.startsAt, now)}

${EMOJIS.CALENDAR} ${getDayName(training.startsAt.getDay())}, ${formatDate(training.startsAt)}
${timeLines}
${EMOJIS.LOCATION} ${locationLink(training.location)}${cancelled}${countLine(count, teamChat)}`
}
