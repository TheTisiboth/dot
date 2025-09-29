import * as cron from 'node-cron';
import { SeasonManager } from './SeasonManager.js';
import { MessageGenerator } from './MessageGenerator.js';
import { config } from '../config/index.js';
import { MESSAGES } from '../utils/constants.js';
import TelegramBot from 'node-telegram-bot-api';

export class SchedulerService {
  private readonly seasonManager: SeasonManager;
  private readonly messageGenerator: MessageGenerator;
  private readonly bot: TelegramBot;
  private readonly chatId?: string | undefined;

  constructor(
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    bot: TelegramBot
  ) {
    this.seasonManager = seasonManager;
    this.messageGenerator = messageGenerator;
    this.bot = bot;
    this.chatId = config.telegram.chatId || undefined;
  }

  setupScheduler(): void {
    // Schedule for both winter and summer times at 20:00 (8 PM)
    cron.schedule('0 20 * * *', async () => {
      console.log(MESSAGES.CHECKING_MESSAGE_SEND);

      if (this.seasonManager.shouldSendMessage()) {
        console.log(MESSAGES.SENDING_SCHEDULED_MESSAGE);
        await this.sendScheduledMessage();
      } else {
        console.log(MESSAGES.NOT_TRAINING_DAY);
      }
    });

    console.log(`✅ ${MESSAGES.SCHEDULER_INITIALIZED}`);
  }

  async sendScheduledMessage(): Promise<void> {
    try {
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
      const practiceDay = this.seasonManager.getPracticeForDay();

      // Use LLM if OpenAI is configured, otherwise use template
      const useLLM = this.messageGenerator.isLLMAvailable();
      const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay);

      if (!this.chatId) {
        console.error(`❌ ${MESSAGES.CHAT_ID_NOT_CONFIGURED}`, message);
        return;
      }

      await this.bot.sendMessage(this.chatId, message);
      console.log(`✅ ${MESSAGES.MESSAGE_SENT_SUCCESS}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error sending message:', errorMessage);
    }
  }

  isConfigured(): boolean {
    return !!this.chatId;
  }
}