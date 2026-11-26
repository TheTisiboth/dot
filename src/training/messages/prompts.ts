import { type Training } from '../season'
import { formatClock } from '../../shared/formatters'
import { type Attendance, startTimeText } from './templates'

const FORMAT = 'Output only the message: three lines separated by one blank line. No quotes, markdown, labels or explanations.'

export const announcement = (training: Training): string => `Write a short Ultimate Frisbee training announcement for a team chat.

${FORMAT}

Line 1: a fun, chill greeting of your own (max 8 words, no place, time or emoji), then on the same line, copied exactly: Tomorrow's ${training.season} training is at ${training.location.name}, ${startTimeText(training)}.
Line 2, copied exactly: React with 👍 or 👎 to confirm your attendance.
Line 3: a frisbee catch phrase of your own (max 8 words), ending with one emoji from 🥏 🔥 🚀 🌟 💪 🙌.`

export const trainerRequest = (training: Training): string => `Write a short message asking trainers who can lead tomorrow's Ultimate Frisbee training.

${FORMAT}

Line 1, copied exactly: 👨‍🏫 Who can coach tomorrow's ${training.season} training, starting at ${formatClock(training.startsAt)}?
Line 2, copied exactly: React with 👍 if you can lead it.
Line 3: a short, friendly thank you of your own (max 6 words), ending with 🥏`

export const attendanceReminder = (training: Training, { count, threshold }: Attendance): string => `Write a short, kind reminder for an Ultimate Frisbee team chat.

${FORMAT}

Line 1: a warm, playful greeting of your own (max 10 words, no numbers or emoji).
Line 2, copied exactly: So far ${count} of the ${threshold} players needed have confirmed for the ${formatClock(training.startsAt)} training. React with 👍 on the announcement above, as below ${threshold} players it may be cancelled.
Line 3: a team cheer of your own (max 6 words) that asks for no reply, ending with one emoji from 🥏 🔥 🚀 🌟 💪 🙌.`
