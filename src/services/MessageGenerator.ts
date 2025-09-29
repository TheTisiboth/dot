import { Ollama } from 'ollama';
import { config } from '../config/index.js';
import { SeasonConfig, MessageGenerationOptions, PracticeDay } from '../types/index.js';
import { EMOJIS } from '../utils/constants.js';

export class MessageGenerator {
  private readonly ollama: Ollama | null;

  constructor() {
    this.ollama = config.ollama.enabled ? new Ollama({
      host: config.ollama.host || 'http://localhost:11434'
    }) : null;
  }

  generateTemplateMessage(seasonConfig: SeasonConfig, practiceDay?: PracticeDay): string {
    // Use specific practice day info if provided, otherwise use default
    const location = practiceDay?.location || seasonConfig.location;
    const time = practiceDay?.time || seasonConfig.practices[0]?.time || '20:00';

    return `${EMOJIS.ROCKET} Hey team!

Tomorrow we're planning an Ultimate Frisbee training at ${location} starting at ${time}.

${EMOJIS.BULB} If you're in, just drop a ${EMOJIS.THUMBS_UP} on this message so we know how many are coming.
The more the merrier! ${EMOJIS.FRISBEE}`;
  }

  async generateLLMMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    if (this.ollama) {
      return await this.generateOllamaMessage(seasonConfig, options, practiceDay);
    } else {
      console.log('No LLM configured, using template');
      return this.generateTemplateMessage(seasonConfig, practiceDay);
    }
  }

  private async generateOllamaMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    const location = practiceDay?.location || seasonConfig.location;
    const time = practiceDay?.time || seasonConfig.practices[0]?.time || '20:00';
    const { season } = seasonConfig;
    const { temperature = 0.7, maxTokens = 200 } = options;

    const prompt = this.createLLMPrompt(location, time, season);
    const model = config.ollama.model || 'mistral:7b';

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
      });

      const generatedMessage = response.message.content?.trim();

      if (!generatedMessage) {
        throw new Error('Empty response from Ollama');
      }

      return generatedMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating Ollama message:', errorMessage);
      console.log('Fallback to template message');
      return this.generateTemplateMessage(seasonConfig, practiceDay);
    }
  }

  async generateMessage(
    seasonConfig: SeasonConfig,
    options: MessageGenerationOptions = {},
    practiceDay?: PracticeDay
  ): Promise<string> {
    const { useLLM = false } = options;

    if (useLLM) {
      return await this.generateLLMMessage(seasonConfig, options, practiceDay);
    } else {
      return this.generateTemplateMessage(seasonConfig, practiceDay);
    }
  }

  private createLLMPrompt(location: string, time: string, season: string): string {
    return `Write ONLY the message content for an Ultimate Frisbee training invitation. No explanations, no meta-text, no "Here's a message" - just the direct message.

Requirements:
- Invite people to tomorrow's ${season} training at ${location} starting at ${time}
- Ask for ${EMOJIS.THUMBS_UP} reaction to confirm attendance
- Use 2-4 emojis maximum
- Keep it friendly and motivating
- End with a unique encouraging phrase (vary it each time - could be "The more the merrier!", "Let's make it epic!", "See you on the field!", "Bring your A-game!", etc.)
- 2-4 lines total

Message:`;
  }

  isLLMAvailable(): boolean {
    return this.ollama !== null;
  }

  getLLMProvider(): string {
    if (this.ollama) return `Ollama (${config.ollama.model || 'mistral:7b'})`;
    return 'Template-only';
  }
}