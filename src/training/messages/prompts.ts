import { type Training } from '../season'
import { formatClock } from '../../shared/formatters'
import { type Attendance, startTimeText } from './templates'

const FORMAT = 'Output only the message: three lines separated by one blank line. No quotes, markdown, labels or explanations.'

export const announcement = (training: Training): string => {
  const { season } = training
  const facts = `Tomorrow's ${season} training is at ${training.location.name}, ${startTimeText(training)}.`

  return `Write a short Ultimate Frisbee training announcement for a team chat.

${FORMAT}

Line 1: one fun, chill greeting (max 12 words, no place or time), then this sentence unchanged:
${facts}
Line 2: one sentence asking to react with 👍 or 👎 to confirm attendance.
Line 3: a short Ultimate Frisbee catch phrase (max 8 words).

Emojis: 1 to 4 in total, only from 🥏 🔥 ⚡ 💨 🚀 🌟 ✨ 🎉 💪 😎 🤙 🙌 ☀️ 🌙 😄; 👍 and 👎 only in line 2.
Tone: a friendly teammate, slightly meme-y; not corporate, competitive or poetic.

Example of the shape (write your own words):
🥏 Ready to send some sky plastic? <the sentence above>

React with 👍 or 👎 to confirm your attendance.

Floaty throws, happy souls 🌟`
}

export const trainerRequest = (training: Training): string => `Write a short message asking trainers who can lead tomorrow's Ultimate Frisbee training.

${FORMAT}

Line 1: one emoji, then one question asking who can coach tomorrow's ${training.season} training, starting at ${formatClock(training.startsAt)}.
Line 2: one sentence asking to react with 👍 if they can lead it; no other reaction.
Line 3: a short thank you, ending with one emoji.

Emojis: at most 3 in total, coach-related (👨‍🏫 🥏 📋).
Tone: a friendly teammate, to the point; not corporate.

Example of the shape (write your own words):
👨‍🏫 Can someone lead tomorrow's training?

React with 👍 if you can help.

Thanks! 🥏`

export const attendanceReminder = (training: Training, { count, threshold }: Attendance): string => `Write a short reminder for an Ultimate Frisbee team chat: players should confirm today's training.

${FORMAT}

Line 1: one warm, playful sentence encouraging people to reply (max 12 words, no numbers).
Line 2: these facts in two sentences, with these numbers and no other: so far ${count} of the ${threshold} players needed have confirmed for the ${formatClock(training.startsAt)} training, so react with 👍 on the announcement this message replies to; below ${threshold} players the training may be cancelled (say no time for that).
Line 3: a short call to action (max 8 words), optionally ending with 1 or 2 emojis.

Emojis: at most 3 in total, only from 🥏 🔥 ⚡ 💨 🚀 🌟 ✨ 💪 😎 🤙 🙌 😄 😆 ⏰; 👍 only in line 2.
Tone: a kind teammate; never rude, pushy or guilt-tripping, not corporate.`
