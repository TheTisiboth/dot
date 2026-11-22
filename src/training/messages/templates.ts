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
    ? `with throwing at ${formatClock(throwingAt)} and training starting at ${formatClock(startsAt)}`
    : `starting at ${formatClock(startsAt)}`

export const announcement = (training: Training): string => `${EMOJIS.ROCKET} Hey team!

Tomorrow we're planning an Ultimate Frisbee training at ${locationLink(training.location)} ${startTimeText(training)}.

${EMOJIS.BULB} If you're in, just drop a ${EMOJIS.THUMBS_UP} on this message so we know how many are coming.

The more the merrier! ${EMOJIS.FRISBEE}`

export const trainerRequest = (training: Training): string => `${EMOJIS.COACH} Trainers needed! We have training tomorrow starting at ${formatClock(training.startsAt)}.

${EMOJIS.BULB} Can you lead the session? React with ${EMOJIS.THUMBS_UP} if you're available to coach.

Thanks for helping out! ${EMOJIS.FRISBEE}`

/** Deliberately template-only: a key holder reacting with the wrong emoji is worse than a boring message. */
export const keyRequest = (): string =>
  `${MARKERS.KEY} Key holders: react ${EMOJIS.THUMBS_UP} if you're bringing the sports hall key tomorrow, or ${EMOJIS.CRYING} if you have it but can't come.`

export const attendanceReminder = (training: Training, { count, threshold }: Attendance): string =>
  `${MARKERS.ATTENDANCE_REMINDER} So far ${count} of the ${threshold} players we need have confirmed for the ${formatClock(training.startsAt)} training.

${EMOJIS.BULB} If you're coming, please react with ${EMOJIS.THUMBS_UP} on the original training post above (the one this message replies to).

${EMOJIS.WARNING} If we don't reach ${threshold}, the training might have to be cancelled.`

/** Deliberately template-only: a cancellation must never be garbled by the LLM. */
export const cancellationNotice = (training: Training, { count, threshold }: Attendance, cancelHoursBefore: number): string =>
  `${MARKERS.CANCELLATION} <b>${CANCELLATION_SIGNATURE} - not enough attendance.</b>

${EMOJIS.RUNNER} Training: ${formatClock(training.startsAt)} at ${escapeHtml(training.location.name)}
${EMOJIS.THUMBS_UP} Confirmed: <b>${count}</b> ${EMOJIS.THUMBS_UP} out of the <b>${threshold}</b> required

Only ${count} player${count === 1 ? '' : 's'} confirmed ${cancelHoursBefore}h before the start, below the minimum of ${threshold}.`
