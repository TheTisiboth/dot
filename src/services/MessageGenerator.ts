import { Ollama } from 'ollama'
import { config } from '../config'
import { type SeasonConfig, type MessageGenerationOptions, type PracticeDay, type Attendance } from '../types'
import { EMOJIS, MARKERS, CANCELLATION_SIGNATURE } from '../utils/constants'
import { log } from '../utils/logger'
import { extractLocationName } from '../utils/formatters'

export class MessageGenerator {
  private readonly ollama: Ollama | null

  constructor() {
    this.ollama = config.ollama.enabled ? new Ollama({
      host: config.ollama.host
    }) : null
  }

  private getLocationAndTime(seasonConfig: SeasonConfig, practiceDay: PracticeDay): { location: string; time: string } {
    return {
      location: seasonConfig.location,
      time: practiceDay.time
    }
  }

  generateTemplateMessage(seasonConfig: SeasonConfig, practiceDay: PracticeDay): string {
    const { location, time } = this.getLocationAndTime(seasonConfig, practiceDay)
    const locationName = extractLocationName(location)

    log.messageGen(`Template message generated for ${seasonConfig.season} at ${locationName} (${time})`)
    return `${EMOJIS.ROCKET} Hey team!

Tomorrow we're planning an Ultimate Frisbee training at ${location} starting at ${time}.

${EMOJIS.BULB} If you're in, just drop a ${EMOJIS.THUMBS_UP} on this message so we know how many are coming.

The more the merrier! ${EMOJIS.FRISBEE}`
  }

  generateTrainerTemplateMessage(seasonConfig: SeasonConfig, practiceDay: PracticeDay): string {
    const { location, time } = this.getLocationAndTime(seasonConfig, practiceDay)
    const locationName = extractLocationName(location)

    log.messageGen(`Trainer template message generated for ${seasonConfig.season} at ${locationName} (${time})`)
    return `${EMOJIS.COACH} Trainers needed! We have training tomorrow starting at ${time}.

${EMOJIS.BULB} Can you lead the session? React with ${EMOJIS.THUMBS_UP} if you're available to coach.

Thanks for helping out! ${EMOJIS.FRISBEE}`
  }

  async generateLLMMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay
  ): Promise<string> {
    if (this.ollama) {
      return await this.generateOllamaMessage(seasonConfig, options, practiceDay, false)
    } else {
      log.messageGen('No LLM configured, using template')
      return this.generateTemplateMessage(seasonConfig, practiceDay)
    }
  }

  private normalizeWhitespace(message: string): string {
    // Normalize whitespace: remove empty lines and ensure exactly one empty line between sections
    const lines = message
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)

    return lines.join('\n\n')
  }

  private injectLocationLink(message: string, location: string): string {
    // If location contains a markdown link, inject it into the message
    const markdownLinkMatch = location.match(/\[([^\]]+)]\(([^)]+)\)/)
    if (markdownLinkMatch) {
      const locationName = markdownLinkMatch[1]

      // Replace plain text location name with markdown link
      return message.replace(
        new RegExp(`\\b${locationName}\\b`, 'g'),
        location
      )
    }
    return message
  }

  private async runOllama(
    prompt: string,
    fallback: () => string,
    label: string,
    location: string,
    options: MessageGenerationOptions = {}
  ): Promise<string> {
    const { temperature = 0.6, maxTokens = 150 } = options
    const model = config.ollama.model

    try {
      const response = await this.ollama!.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature, // Randomness (0=deterministic, 1=creative)
          num_predict: maxTokens, // Max tokens to generate
          num_thread: 4, // CPU threads for generation
          frequency_penalty: 0.8, // Reduce repetition based on token frequency
          presence_penalty: 0.2 // Encourage topic diversity
        }
      })

      let generatedMessage = response.message.content?.replace(/^\s+|\s+$/g, '')

      if (!generatedMessage) {
        throw new Error('Empty response from Ollama')
      }

      generatedMessage = this.normalizeWhitespace(generatedMessage)
      generatedMessage = this.injectLocationLink(generatedMessage, location)

      log.messageGen(`${label} message generated (${generatedMessage.length} chars) using ${model}`)
      return generatedMessage
    } catch (error) {
      log.error(`Generating ${label} message`, error)
      log.messageGen(`Falling back to ${label} template message`)
      return fallback()
    }
  }

  private async generateOllamaMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay,
    isTrainerMessage = false
  ): Promise<string> {
    const { location, time } = this.getLocationAndTime(seasonConfig, practiceDay)
    const { season } = seasonConfig
    const locationForPrompt = extractLocationName(location)

    const prompt = isTrainerMessage
      ? this.createTrainerLLMPrompt(time, season)
      : this.createLLMPrompt(locationForPrompt, time, season)

    const fallback = isTrainerMessage
      ? () => this.generateTrainerTemplateMessage(seasonConfig, practiceDay)
      : () => this.generateTemplateMessage(seasonConfig, practiceDay)

    return await this.runOllama(prompt, fallback, isTrainerMessage ? 'Trainer LLM' : 'LLM', location, options)
  }

  async generateMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay
  ): Promise<string> {
    const { useLLM = false } = options

    if (useLLM) {
      return await this.generateLLMMessage(seasonConfig, options, practiceDay)
    } else {
      return this.generateTemplateMessage(seasonConfig, practiceDay)
    }
  }

  async generateTrainerMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay
  ): Promise<string> {
    const { useLLM = false } = options

    if (useLLM && this.ollama) {
      return await this.generateOllamaMessage(seasonConfig, options, practiceDay, true)
    } else {
      return this.generateTrainerTemplateMessage(seasonConfig, practiceDay)
    }
  }

  generateReminderTemplateMessage(attendance: Attendance, practiceDay: PracticeDay): string {
    const { count, threshold } = attendance

    log.messageGen(`Reminder template message generated (${count}/${threshold})`)
    return `${MARKERS.REMINDER} So far ${count} of the ${threshold} players we need have confirmed for the ${practiceDay.time} training.

${EMOJIS.BULB} If you're coming, please react with ${EMOJIS.THUMBS_UP} on the original training post above (the one this message replies to).

${EMOJIS.WARNING} If we don't reach ${threshold}, the training might have to be cancelled.`
  }

  async generateReminderMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay,
    attendance: Attendance
  ): Promise<string> {
    const { useLLM = false } = options
    const fallback = () => this.generateReminderTemplateMessage(attendance, practiceDay)

    if (!useLLM || !this.ollama) return fallback()

    const prompt = this.createReminderLLMPrompt(attendance, practiceDay.time)
    const message = await this.runOllama(prompt, fallback, 'Reminder LLM', seasonConfig.location, options)

    // The marker must never depend on the LLM: it is how we recognise our own reminder in chat history
    return message.startsWith(MARKERS.REMINDER) ? message : `${MARKERS.REMINDER} ${message}`
  }

  /** Deliberately template-only: a cancellation must never be garbled by the LLM. */
  generateCancellationMessage(
    seasonConfig: SeasonConfig,
    practiceDay: PracticeDay,
    attendance: Attendance
  ): string {
    const { count, threshold } = attendance
    const { cancelHoursBefore } = config.attendance
    const locationName = extractLocationName(seasonConfig.location)

    log.messageGen(`Cancellation message generated (${count}/${threshold})`)
    return `${MARKERS.CANCELLATION} *${CANCELLATION_SIGNATURE} - not enough attendance.*

${EMOJIS.RUNNER} Training: ${practiceDay.time} at ${locationName}
${EMOJIS.THUMBS_UP} Confirmed: *${count}* ${EMOJIS.THUMBS_UP} out of the *${threshold}* required

Only ${count} player${count === 1 ? '' : 's'} confirmed ${cancelHoursBefore}h before the start, below the minimum of ${threshold}.`
  }

  private createReminderLLMPrompt(attendance: Attendance, time: string): string {
    const { count, threshold } = attendance

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

  private createTrainerLLMPrompt(time: string, season: string): string {
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

  private createLLMPrompt(location: string, time: string, season: string): string {
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

Tomorrow's ${season} training is at ${location} starting at ${time}.

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

  isLLMAvailable(): boolean {
    return this.ollama !== null
  }

  async testOllamaConnection(): Promise<void> {
    if (!this.ollama) {
      throw new Error('Ollama not configured')
    }
    // Test connectivity by listing models
    await this.ollama.list()
  }

  getLLMProvider(): string {
    if (this.ollama) return `Ollama (${config.ollama.model})`
    return 'Template-only'
  }
}