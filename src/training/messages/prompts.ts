import { type Training } from '../season'
import { formatClock } from '../../shared/formatters'
import { type Attendance, startTimeText } from './templates'

export const attendanceReminder = (training: Training, attendance: Attendance): string => {
  const { count, threshold } = attendance
  const time = formatClock(training.startsAt)

  return `Generate a short Ultimate Frisbee message reminding the team to confirm attendance for today's training.

Output ONLY the final message text.
Do NOT include explanations, comments, labels, quotation marks, or markdown.
Do NOT add anything before or after the message.

The message must follow this EXACT structure:

------------------------------------------------------------
FIRST LINE
------------------------------------------------------------

- Write ONE short, warm and friendly Ultimate Frisbee sentence (maximum 12 words) gently encouraging the team to reply.
- Keep it kind, positive and playful.
- Do NOT be rude, aggressive, passive-aggressive or guilt-tripping. NEVER use insults or commands such as "shut up".
- Do NOT mention any numbers in this creative sentence.

Then write EXACTLY one empty line.

------------------------------------------------------------
MIDDLE LINE (STRICT - FACTS, DO NOT ALTER THE NUMBERS)
------------------------------------------------------------

- Write exactly two sentences, in this order:
  1. State that so far ${count} out of ${threshold} needed players have confirmed for the ${time} training, and kindly ask people to react with 👍 on the original training post above (the message this one replies to) to confirm.
  2. State that if we do not reach ${threshold} players, the training might have to be cancelled. Do NOT mention any specific time or number of hours for the cancellation.
- The numbers ${count} and ${threshold} MUST appear exactly as given.
- Do NOT invent or change any number, and do NOT add any other number.
- The only emoji allowed in these two sentences is 👍.

Then write EXACTLY one empty line.

------------------------------------------------------------
FINAL LINE
------------------------------------------------------------

- Write a short Ultimate Frisbee call to action (maximum 8 words).
- You may add 0-2 emojis at the end, only from the allowed list.

------------------------------------------------------------
EMOJI RULES (STRICT)
------------------------------------------------------------

You may ONLY use emojis from this list:
🥏 🔥 ⚡ 💨 🚀 🌟 ✨ 💪 😎 🤙 🙌 😄 😆 ⏰

Rules:
- Maximum 3 emojis in the entire message.
- 👍 is allowed ONLY in the middle section.
- Do NOT use any emoji outside this list.

------------------------------------------------------------
TONE
------------------------------------------------------------

- Warm, friendly, welcoming and encouraging
- Chill and social, lightly playful
- Never rude, aggressive or guilt-tripping
- Not dramatic, not corporate

Generate the message now:`
}

export const trainerRequest = (training: Training): string => {
  const { season } = training
  const time = formatClock(training.startsAt)

  return `Generate a message to ask trainers if they can lead tomorrow's Ultimate Frisbee training session. Output ONLY the actual message that will be sent - NO meta text, NO quotes, NO explanations, NO instructions.

CRITICAL: The message MUST be formatted on 3 SEPARATE LINES with blank lines between them. DO NOT put everything on one line.

Example format (do NOT copy this text, generate your own):
👨‍🏫 Can someone lead tomorrow's training?

Please react with 👍 if you can help.

Thanks! 🥏

Your message structure:
Line 1: [emoji] [Direct question asking if a trainer is available for tomorrow's ${season} training starting at ${time}]
BLANK LINE (press Enter twice)
Line 2: [sentence asking to react with 👍 if they can lead the session]
BLANK LINE (press Enter twice)
Line 3: [brief thank you message]! [emoji]

Rules:
- You MUST output 3 separate lines with blank lines between them
- DO NOT put everything on a single line
- Output ONLY the actual message text - no meta-commentary
- Keep it professional and to the point
- Use coach/trainer related emojis (👨‍🏫 🥏 📋 etc.)
- The confirmation line MUST only ask to react with 👍 (not 👎)
- Each section MUST be a single sentence only
- Start the confirmation line with text only, no emoji at the beginning
- Maximum 3 emojis total in the entire message
- NO quotation marks in output
- Start sentences with a capital letter

Generate the message now:`
}

export const announcement = (training: Training): string => {
  const { season } = training
  const location = training.location.name
  const time = formatClock(training.startsAt)
  const startTime = startTimeText(training)

  return `Generate an Ultimate Frisbee training invitation message.

Output ONLY the final message text.
Do NOT include explanations, comments, labels, quotation marks, or markdown.
Do NOT add anything before or after the message.

The message must follow this EXACT structure:

------------------------------------------------------------
FIRST LINE
------------------------------------------------------------

- Optional: start with ONE emoji from the allowed list below (or no emoji).
- Then write ONE short creative, funny, chill Ultimate Frisbee greeting sentence (maximum 12 words).
- This creative sentence MUST NOT contain:
  ${location}
  ${time}
  ${season}
  Any reference to the training location
  Any reference to the time

- After that creative sentence, add ONE space and then write EXACTLY this sentence (do not modify wording except variable replacement):

Tomorrow's ${season} training is at ${location} ${startTime}.

- Do NOT change this sentence.
- Do NOT add anything after ${time}.
- Do NOT mention what will be trained or practiced.

Then write EXACTLY one empty line.

------------------------------------------------------------
MIDDLE LINE (STRICT PATTERN)
------------------------------------------------------------

- This line must contain BOTH 👍 and 👎.
- 👍 must appear before 👎.
- It must end EXACTLY with the word: attendance.
- No words are allowed after the word "attendance."
- Only ONE sentence.
- No jokes.
- No extra clauses.
- No @ mentions.
- No slang after the confirmation request.
- No emojis except 👍 and 👎.

Allowed examples of correct middle lines:
React with 👍 or 👎 to confirm your attendance.
Please react with 👍 or 👎 to confirm your attendance.
Drop a 👍 or 👎 to confirm your attendance.

Then write EXACTLY one empty line.

------------------------------------------------------------
FINAL LINE
------------------------------------------------------------

- Write a short creative Ultimate Frisbee catch phrase (maximum 8 words).
- You may add 0–2 emojis at the end of this line (only from the allowed list).
- Do NOT use quotation marks.

------------------------------------------------------------
EMOJI RULES (STRICT)
------------------------------------------------------------

You may ONLY use emojis from this list:
🥏 🔥 ⚡ 💨 🌪️ 🌀 🚀 🌟 ✨ 🎉 🎊 💪 😎 🤙 🙌 🌈 ☀️ 🌤️ 🌥️ 🌙 ⭐ 🎶 🔊 😄 😆 😁 🧠 🌱 

Rules:
- Minimum 1 emoji in the entire message.
- Maximum 4 emojis total in the entire message.
- Do NOT use any emoji outside this list.
- 👍 and 👎 are allowed ONLY in the middle line.

------------------------------------------------------------
TONE
------------------------------------------------------------

- Chill
- Social
- Slightly meme-y
- Not competitive
- Not corporate
- Not dramatic poetry

------------------------------------------------------------
FORMAT RULES
------------------------------------------------------------

- Exactly one blank line between sections.
- No extra blank lines.
- No markdown.
- No quotation marks.
- No additional text.

------------------------------------------------------------
EXAMPLE OF A CORRECT OUTPUT STRUCTURE
------------------------------------------------------------

🥏 Ready to send some sky plastic? Tomorrow's winter training is at OSZ KIM starting at 19:00.

React with 👍 or 👎 to confirm your attendance.

Floaty throws, happy souls 🌟

Generate the message now:`
}
