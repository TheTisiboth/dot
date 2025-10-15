import { Ollama } from 'ollama'
import { config } from '../config'
import { type SeasonConfig, type MessageGenerationOptions, type PracticeDay } from '../types'
import { EMOJIS } from '../utils/constants'
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

  private async generateOllamaMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay: PracticeDay,
    isTrainerMessage = false
  ): Promise<string> {
    const { location, time } = this.getLocationAndTime(seasonConfig, practiceDay)
    const { season } = seasonConfig
    const { temperature = 0.7, maxTokens = 200 } = options

    // Extract location name for LLM prompt (without markdown formatting)
    const locationForPrompt = extractLocationName(location)

    const prompt = isTrainerMessage
      ? this.createTrainerLLMPrompt(time, season)
      : this.createLLMPrompt(locationForPrompt, time, season)
    const model = config.ollama.model
    const messageType = isTrainerMessage ? 'Trainer LLM' : 'LLM'
    const fallbackTemplate = isTrainerMessage
      ? () => this.generateTrainerTemplateMessage(seasonConfig, practiceDay)
      : () => this.generateTemplateMessage(seasonConfig, practiceDay)

    try {
      const response = await this.ollama!.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        options: { temperature, num_predict: maxTokens }
      })

      let generatedMessage = response.message.content?.replace(/^\s+|\s+$/g, '')

      if (!generatedMessage) {
        throw new Error('Empty response from Ollama')
      }

      generatedMessage = this.normalizeWhitespace(generatedMessage)
      generatedMessage = this.injectLocationLink(generatedMessage, location)

      const locationName = extractLocationName(location)
      log.messageGen(`${messageType} message generated (${generatedMessage.length} chars) for ${season} at ${locationName} (${time}) using ${model}`)
      return generatedMessage
    } catch (error) {
      log.error(`Generating ${messageType} message`, error)
      log.messageGen(`Falling back to ${isTrainerMessage ? 'trainer ' : ''}template message`)
      return fallbackTemplate()
    }
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
    return `Generate an Ultimate Frisbee training invitation message. Output ONLY the actual message that will be sent - NO meta text, NO quotes, NO explanations, NO "Here's a message", NO instructions like "Empty line between sections".

The message must have this structure:
- First line: [emoji] [greeting about tomorrow's ${season} training at ${location} starting at ${time}]
- Blank line
- Middle line: [sentence asking to react with 👍 or 👎 to confirm attendance]
- Blank line
- Last line: [motivational catch phrase]! [emoji]

Rules:
- Output ONLY the actual message text - do NOT include any instructions or meta-commentary
- Do NOT write things like "Empty line between sections:" or "(empty line)" or any other instructions
- Use EXACTLY ONE empty line between sections
- ALL emojis must be Ultimate Frisbee related or generic (🥏 ⚡ 🌟 🔥 etc.)
- NEVER use emojis from other sports (❌ NO: ⚽ 🏀 🏈 ⚾ 🎾 🏐 ⛷️ 🏊)
- The confirmation line MUST be a simple request to react with 👍 or 👎 to confirm participation (e.g., "React with 👍 or 👎 to confirm your attendance")
- The confirmation line is ONLY about confirming attendance/participation - nothing else
- The confirmation line MUST NOT have any emoji except 👍 and 👎
- The confirmation line MUST be a single sentence only - no additional explanations or follow-up sentences
- Start the confirmation line with text only, no emoji at the beginning
- Maximum 4 emojis total in the entire message
- Write a creative and motivational catch phrase (DO NOT write the word "Catchphrase:" - just write the actual catch phrase)
- NO quotation marks in output
- IMPORTANT: Use the location "${location}" EXACTLY as provided without any modifications (it may contain special formatting)
- Start sentences with a capital letter
- Only ask once for voting (with thumbs up/down) in the middle line. You shouldn't ask for votes in the first or the last line
- CRITICAL: DO NOT mention what will be trained or practiced (no "fundamental skills", "drills", "tactics", etc.) - just announce the training time and location
- Keep the first line simple: just mention it's a training session at the location and time - nothing more

Generate the message now:`
  }

  isLLMAvailable(): boolean {
    return this.ollama !== null
  }

  getLLMProvider(): string {
    if (this.ollama) return `Ollama (${config.ollama.model})`
    return 'Template-only'
  }
}