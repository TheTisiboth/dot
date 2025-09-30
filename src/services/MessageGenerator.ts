import { Ollama } from 'ollama';
import { config } from '../config/index.js';
import { SeasonConfig, MessageGenerationOptions, PracticeDay } from '../types/index.js';
import { EMOJIS } from '../utils/constants.js';

export class MessageGenerator {
  private readonly ollama: Ollama | null;

  constructor() {
    this.ollama = config.ollama.enabled ? new Ollama({
      host: config.ollama.host
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
    const model = config.ollama.model;
    console.log(`🔄 Generating message with Ollama (${model}) for ${season} training at ${location}, ${time}`);
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

      // Only trim leading/trailing whitespace, preserve internal blank lines
      const generatedMessage = response.message.content?.replace(/^\s+|\s+$/g, '');

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
    return `Generate an Ultimate Frisbee training invitation message. Output ONLY the message content with NO quotes, NO explanations, NO "Here's a message".

Use this EXACT format with ONE blank line between each section:

[emoji] [greeting sentence]
(blank line)
[sentence about tomorrow's ${season} training at ${location} starting at ${time}]
(blank line)
[emoji] [sentence asking to react with 👍 to confirm attendance]
(blank line)
[unique catch phrase]! [emoji]

Rules:
- Use EXACTLY ONE blank line between sections
- If using sports emojis, they must be Ultimate Frisbee related (e.g. 🥏 is good, ⚽ would not make sense)
- When asking for confirmation, ONLY mention the 👍 emoji (do NOT mention other emojis like 👊, 👉, etc.)
- The confirmation line should clearly ask users to "react with 👍" or "drop a 👍"
- Do NOT use pointing or fist emojis in the confirmation sentence
- Maximum 4 emojis total in the entire message
- Vary the catch phrase each time
- NO quotation marks in output
- NO multiple consecutive blank lines

Generate the message now:`;
  }

  isLLMAvailable(): boolean {
    return this.ollama !== null;
  }

  getLLMProvider(): string {
    if (this.ollama) return `Ollama (${config.ollama.model})`;
    return 'Template-only';
  }
}