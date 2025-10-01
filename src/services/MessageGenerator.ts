import { Ollama } from 'ollama'
import { config } from '../config'
import { type SeasonConfig, type MessageGenerationOptions, type PracticeDay } from '../types'
import { EMOJIS } from '../utils/constants'

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
      console.log('No LLM configured, using template')
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
    console.log(`🔄 Generating message with Ollama (${model}) for ${season} training at ${location}, ${time}`)
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

      let generatedMessage = response.message.content?.replace(/^\s+|\s+$/g, '')

      if (!generatedMessage) {
        throw new Error('Empty response from Ollama')
      }

      const markdownLinkMatch = location.match(/\[([^\]]+)]\(([^)]+)\)/)
      if (markdownLinkMatch) {
        const locationName = markdownLinkMatch[1]
        generatedMessage = generatedMessage.replace(
          new RegExp(`\\b${locationName}\\b`, 'g'),
          location
        )
      }

      return generatedMessage
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error generating Ollama message:', errorMessage)
      console.log('Fallback to template message')
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
    return `Generate an Ultimate Frisbee training invitation message. Output ONLY the message content with NO quotes, NO explanations, NO "Here's a message".

Use this EXACT format with ONE empty line between each section:

[emoji] [greeting sentence about tomorrow's ${season} training at ${location} starting at ${time}]
(empty line)
[sentence asking to react with 👍 or 👎 to confirm attendance]
(empty line)
[motivational catch phrase]! [emoji]

Rules:
- Use EXACTLY ONE empty line between sections (this means pressing Enter twice, creating one empty line)
- NEVER use more than one consecutive empty line anywhere in the message
- ALL emojis must be Ultimate Frisbee related or generic (🥏 ⚡ 🌟 🔥 etc.)
- NEVER use emojis from other sports (❌ NO: ⚽ 🏀 🏈 ⚾ 🎾 🏐 ⛷️ 🏊)
- The confirmation line MUST be a simple request to react with 👍 or 👎 to confirm participation (e.g., "react with 👍 or 👎 to confirm your attendance")
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