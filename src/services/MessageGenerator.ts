import OpenAI from 'openai';
import { config } from '../config/index.js';
import { SeasonConfig, MessageGenerationOptions, PracticeDay } from '../types/index.js';
import { EMOJIS, MESSAGES } from '../utils/constants.js';

export class MessageGenerator {
  private readonly openai: OpenAI | null;

  constructor() {
    this.openai = config.openai.apiKey ? new OpenAI({
      apiKey: config.openai.apiKey
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
    if (!this.openai) {
      console.log(MESSAGES.OPENAI_NOT_CONFIGURED);
      return this.generateTemplateMessage(seasonConfig, practiceDay);
    }

    const location = practiceDay?.location || seasonConfig.location;
    const time = practiceDay?.time || seasonConfig.practices[0]?.time || '20:00';
    const { season } = seasonConfig;
    const { temperature = 0.7, maxTokens = 200 } = options;

    const prompt = this.createLLMPrompt(location, time, season);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: maxTokens,
        temperature
      });

      const generatedMessage = response.choices[0]?.message?.content?.trim();

      if (!generatedMessage) {
        throw new Error('Empty response from OpenAI');
      }

      return generatedMessage;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error generating LLM message:', errorMessage);
      console.log(MESSAGES.FALLBACK_TO_TEMPLATE);
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
    return `You are helping generate a message for an Ultimate Frisbee group to invite people to tomorrow's training session.

Context:
- Sport: Ultimate Frisbee
- Season: ${season}
- Location: ${location}
- Starting time: ${time}
- Target: Team members who might want to join tomorrow's training

Instructions:
- Generate a friendly, engaging message inviting people to tomorrow's training
- Ask people to react with ${EMOJIS.THUMBS_UP} if they want to join
- Include the location (${location}) and time (${time}) clearly
- Use some emojis but not too many (2-4 total)
- Keep it casual and motivating but not cringe or overly cheesy
- Goal is to get as many participants as possible
- Add a fun, encouraging closing line (like "The more the merrier!")
- Keep the message concise (2-4 lines)

Generate the message now:`;
  }

  isLLMAvailable(): boolean {
    return this.openai !== null;
  }
}