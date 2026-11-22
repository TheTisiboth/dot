import { type Training } from '../season'
import { EMOJIS } from '../../shared/emojis'
import { MARKERS, CANCELLATION_SIGNATURE } from '../markers'
import { escapeHtml, formatClock, locationLink } from '../../shared/formatters'

export interface Attendance {
  count: number;
  threshold: number;
}

export const startTimeText = ({ startsAt, throwingAt }: Training): string =>
  throwingAt
    ? `throwing at ${formatClock(throwingAt)}, starting at ${formatClock(startsAt)}`
    : `starting at ${formatClock(startsAt)}`

export const announcement = (training: Training): string => `${EMOJIS.FRISBEE} Training tomorrow at ${locationLink(training.location)}, ${startTimeText(training)}.

React ${EMOJIS.THUMBS_UP} if you're coming, ${EMOJIS.THUMBS_DOWN} if you're not.

The more the merrier! ${EMOJIS.ROCKET}`

export const trainerRequest = (training: Training): string => `${EMOJIS.COACH} Who can coach tomorrow's training, starting at ${formatClock(training.startsAt)}?

React ${EMOJIS.THUMBS_UP} if you can lead it.

Thanks! ${EMOJIS.FRISBEE}`

/** Deliberately template-only: a key holder reacting with the wrong emoji is worse than a boring message. */
export const keyRequest = (): string =>
  `${MARKERS.KEY} Key holders: react ${EMOJIS.THUMBS_UP} if you're bringing the hall key tomorrow, ${EMOJIS.CRYING} if you have it but can't come.`

export const attendanceReminder = (training: Training, { count, threshold }: Attendance): string =>
  `${MARKERS.ATTENDANCE_REMINDER} ${count} of the ${threshold} players we need are in for the ${formatClock(training.startsAt)} training.

Coming? React ${EMOJIS.THUMBS_UP} on the announcement above.

${EMOJIS.WARNING} Below ${threshold}, we may have to cancel.`

/** Deliberately template-only: a cancellation must never be garbled by the LLM. */
export const cancellationNotice = (training: Training, { count, threshold }: Attendance, cancelHoursBefore: number): string =>
  `${MARKERS.CANCELLATION} <b>${CANCELLATION_SIGNATURE}: not enough players.</b>

${EMOJIS.RUNNER} ${formatClock(training.startsAt)} at ${escapeHtml(training.location.name)}
${EMOJIS.THUMBS_UP} <b>${count}</b> of the <b>${threshold}</b> needed, ${cancelHoursBefore}h before the start`
