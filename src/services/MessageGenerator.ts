import { Ollama } from 'ollama'
import { config } from '../config'
import { type SeasonConfig, type MessageGenerationOptions, type PracticeDay } from '../types'
import { EMOJIS } from '../utils/constants'
import { log } from '../utils/logger'

export class MessageGenerator {
  private readonly ollama: Ollama | null

  constructor() {
    this.ollama = config.ollama.enabled ? new Ollama({
      host: config.ollama.host
    }) : null
  }

  generateTemplateMessage(seasonConfig: SeasonConfig, practiceDay?: PracticeDay): string {
    const location = practiceDay?.location || seasonConfig.location
    const time = practiceDay?.time || seasonConfig.practices[0]?.time || '20:00'

    log.messageGen('Template message generated', { season: seasonConfig.season, time, location })
    return `${EMOJIS.ROCKET} Hey team!

Tomorrow we're planning an Ultimate Frisbee training at ${location} starting at ${time}.

${EMOJIS.BULB} If you're in, just drop a ${EMOJIS.THUMBS_UP} on this message so we know how many are coming.

The more the merrier! ${EMOJIS.FRISBEE}`
  }

  async generateLLMMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    if (this.ollama) {
      return await this.generateOllamaMessage(seasonConfig, options, practiceDay)
    } else {
      log.messageGen('No LLM configured, using template')
      return this.generateTemplateMessage(seasonConfig, practiceDay)
    }
  }

  private async generateOllamaMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    const location = practiceDay?.location || seasonConfig.location
    const time = practiceDay?.time || seasonConfig.practices[0]?.time || '20:00'
    const { season } = seasonConfig
    const { temperature = 0.7, maxTokens = 200 } = options

    const prompt = this.createLLMPrompt(location, time, season)
    const model = config.ollama.model
    try {
      const response = await this.ollama!.chat({
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
      // trim whitespace from the start and end
      let generatedMessage = response.message.content?.replace(/^\s+|\s+$/g, '')

      if (!generatedMessage) {
        throw new Error('Empty response from Ollama')
      }

      // Normalize whitespace: don't trust LLM formatting at all
      // Remove all empty lines and trailing/leading whitespace from each line
      const lines = generatedMessage
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      // Rejoin with exactly one empty line between each line (which is 2 newlines)
      generatedMessage = lines.join('\n\n')

      const markdownLinkMatch = location.match(/\[([^\]]+)]\(([^)]+)\)/)
      if (markdownLinkMatch) {
        const locationName = markdownLinkMatch[1]
        generatedMessage = generatedMessage.replace(
          new RegExp(`\\b${locationName}\\b`, 'g'),
          location
        )
      }

      log.messageGen('LLM message generated', { model, season, time, location, length: generatedMessage.length })
      return generatedMessage
    } catch (error) {
      log.error('Generating Ollama message', error)
      log.messageGen('Falling back to template message')
      return this.generateTemplateMessage(seasonConfig, practiceDay)
    }
  }

  async generateMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    const { useLLM = false } = options

    if (useLLM) {
      return await this.generateLLMMessage(seasonConfig, options, practiceDay)
    } else {
      return this.generateTemplateMessage(seasonConfig, practiceDay)
    }
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