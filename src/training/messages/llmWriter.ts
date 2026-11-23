import type { Ollama } from 'ollama'
import { type BotConfig } from '../../config/env'
import { log } from '../../shared/logger'

export type LlmClient = Pick<Ollama, 'chat' | 'list'>

export type LlmWriter = ReturnType<typeof llmWriter>

/** One line per paragraph, exactly one empty line between them. */
const normalizeWhitespace = (message: string): string =>
  message
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n\n')

/** `client` is null when the LLM is disabled: `write` then always answers null. */
export const llmWriter = ({ model }: Pick<BotConfig['ollama'], 'model'>, client: LlmClient | null) => ({
  enabled: client !== null,

  /** Health probe: lists the models. */
  async ping(): Promise<void> {
    if (!client) throw new Error('Ollama not configured')
    await client.list()
  },

  /** The generated plain text, or null on any failure (the caller falls back to its template). */
  async write(label: string, prompt: string): Promise<string | null> {
    if (!client) return null

    try {
      const response = await client.chat({
        model,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: 0.6, // Randomness (0=deterministic, 1=creative)
          num_predict: 150, // Max tokens to generate
          num_thread: 4, // CPU threads for generation
          frequency_penalty: 0.8, // Reduce repetition based on token frequency
          presence_penalty: 0.2 // Encourage topic diversity
        }
      })

      const text = response.message.content?.replace(/^\s+|\s+$/g, '')
      if (!text) throw new Error('Empty response from Ollama')

      const message = normalizeWhitespace(text)
      log.messageGen(`${label} generated (${message.length} chars) using ${model}`)
      return message
    } catch (error) {
      log.error(`Generating ${label}`, error)
      log.messageGen(`Falling back to ${label} template`)
      return null
    }
  }
})
