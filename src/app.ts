import TelegramBot from 'node-telegram-bot-api';
import { config, validateConfig } from './config/index.js';
import { SeasonManager } from './services/SeasonManager.js';
import { MessageGenerator } from './services/MessageGenerator.js';
import { SchedulerService } from './services/SchedulerService.js';
import { BotController } from './controllers/BotController.js';
import { MESSAGES, EMOJIS } from './utils/constants.js';

class UltimateFrisbeeBot {
  private readonly bot: TelegramBot;
  private readonly seasonManager: SeasonManager;
  private readonly messageGenerator: MessageGenerator;
  private readonly schedulerService: SchedulerService;

  constructor() {
    validateConfig();

    this.bot = new TelegramBot(config.telegram.token, { polling: true });
    this.seasonManager = new SeasonManager();
    this.messageGenerator = new MessageGenerator();
    this.schedulerService = new SchedulerService(
      this.seasonManager,
      this.messageGenerator,
      this.bot
    );
    new BotController(
      this.bot,
      this.seasonManager,
      this.messageGenerator,
      this.schedulerService
    );

    this.setupErrorHandlers();
    this.schedulerService.setupScheduler();
  }

  private setupErrorHandlers(): void {
    // Handle unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle bot errors
    this.bot.on('error', (error) => {
      console.error('Bot error:', error);
    });

    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });
  }

  start(): void {
    const currentSeason = this.seasonManager.getCurrentSeason();
    const trainingDays = this.seasonManager.getTrainingDaysString();
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();

    console.log(`${EMOJIS.FRISBEE} ${MESSAGES.BOT_STARTED}`);
    console.log(`${EMOJIS.CALENDAR} Current season: ${currentSeason}`);
    console.log(`${EMOJIS.RUNNER} Training days: ${trainingDays}`);
    console.log(`${EMOJIS.LOCATION} Location: ${seasonConfig.location}`);
    console.log(`${EMOJIS.ROBOT} LLM enabled: ${this.messageGenerator.isLLMAvailable() ? 'Yes' : 'No (using templates)'}`);

    if (!this.schedulerService.isConfigured()) {
      console.log(`${EMOJIS.WARNING} CHAT_ID not set - use ${/\/start/} command to get your chat ID for testing`);
    }
  }
}

// Start the bot if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new UltimateFrisbeeBot();
  bot.start();
}

export default UltimateFrisbeeBot;