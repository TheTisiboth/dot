import TelegramBot from 'node-telegram-bot-api';
import { SeasonManager } from '../services/SeasonManager.js';
import { MessageGenerator } from '../services/MessageGenerator.js';
import { SchedulerService } from '../services/SchedulerService.js';
import { config } from '../config/index.js';
import { TestResult } from '../types/index.js';
import { BOT_COMMANDS, EMOJIS, MESSAGES } from '../utils/constants.js';
import { DateHelpers } from '../utils/dateHelpers.js';

export class BotController {
  private readonly bot: TelegramBot;
  private readonly seasonManager: SeasonManager;
  private readonly messageGenerator: MessageGenerator;
  private readonly schedulerService: SchedulerService;
  private readonly chatId?: string | undefined;

  constructor(
    bot: TelegramBot,
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    schedulerService: SchedulerService
  ) {
    this.bot = bot;
    this.seasonManager = seasonManager;
    this.messageGenerator = messageGenerator;
    this.schedulerService = schedulerService;
    this.chatId = config.telegram.chatId || undefined;

    this.setupCommands();
  }

  private setupCommands(): void {
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/info/, (msg) => this.handleInfo(msg));
    this.bot.onText(/\/test_template/, (msg) => this.handleTestTemplate(msg));
    this.bot.onText(/\/test_llm/, (msg) => this.handleTestLLM(msg));
    this.bot.onText(/\/test_season (.+)/, (msg, match) => this.handleTestSeason(msg, match));
    this.bot.onText(/\/schedule/, (msg) => this.handleSchedule(msg));
    this.bot.onText(/\/send_now/, (msg) => this.handleSendNow(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const helpText = `${EMOJIS.FRISBEE} Ultimate Frisbee Training Bot is running!

Available commands:
${BOT_COMMANDS.INFO} - Show current season and schedule
${BOT_COMMANDS.TEST_TEMPLATE} - Send test message with template
${BOT_COMMANDS.TEST_LLM} - Send test message with LLM
${BOT_COMMANDS.TEST_SEASON} [date] - Test with specific date (YYYY-MM-DD)
${BOT_COMMANDS.SCHEDULE} - Show next training date
${BOT_COMMANDS.HELP} - Show this help message`;

    await this.bot.sendMessage(msg.chat.id, helpText);
  }

  private async handleInfo(msg: TelegramBot.Message): Promise<void> {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const trainingDays = this.seasonManager.getTrainingDaysString();

    const infoText = `${EMOJIS.CALENDAR} Current Season: ${this.capitalize(seasonConfig.season)}
${EMOJIS.LOCATION} Location: ${seasonConfig.location}
${EMOJIS.SCHEDULE} Training Days: ${trainingDays}
${EMOJIS.ANNOUNCEMENT} Messages sent at: ${seasonConfig.scheduleTime}`;

    await this.bot.sendMessage(msg.chat.id, infoText);
  }

  private async handleTestTemplate(msg: TelegramBot.Message): Promise<void> {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const practiceDay = this.seasonManager.getPracticeForDay();
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: false }, practiceDay);

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.MEMO} Template Message:\n\n${message}`);
  }

  private async handleTestLLM(msg: TelegramBot.Message): Promise<void> {
    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`);

    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const practiceDay = this.seasonManager.getPracticeForDay();
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: true }, practiceDay);

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} LLM Generated Message:\n\n${message}`);
  }

  private async handleTestSeason(msg: TelegramBot.Message, match: RegExpExecArray | null): Promise<void> {
    if (!match || !match[1]) {
      await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Please provide a date in YYYY-MM-DD format`);
      return;
    }

    const testDate = match[1];

    try {
      const date = DateHelpers.parseTestDate(testDate);
      const testResult = this.createTestResult(testDate, date);

      const resultText = this.formatTestResult(testResult);
      await this.bot.sendMessage(msg.chat.id, resultText);

      if (testResult.shouldSendMessage && testResult.message) {
        await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ANNOUNCEMENT} Message that would be sent:\n\n${testResult.message}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : MESSAGES.INVALID_DATE_FORMAT;
      await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} Error: ${errorMessage}\n${MESSAGES.DATE_FORMAT_HELP}`);
    }
  }

  private async handleSchedule(msg: TelegramBot.Message): Promise<void> {
    const nextTraining = this.seasonManager.getNextTrainingInfo();

    const scheduleText = `${EMOJIS.RUNNER} Next Training:

${EMOJIS.CALENDAR} Date: ${nextTraining.dayName}, ${DateHelpers.formatDate(nextTraining.date)}
${EMOJIS.LOCATION} Location: ${nextTraining.location}
${EMOJIS.CLOCK} Time: ${nextTraining.time}`;

    await this.bot.sendMessage(msg.chat.id, scheduleText);
  }

  private async handleSendNow(msg: TelegramBot.Message): Promise<void> {
    if (msg.chat.id.toString() !== this.chatId) {
      await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} ${MESSAGES.ADMIN_ONLY_COMMAND}`);
      return;
    }

    await this.schedulerService.sendScheduledMessage();
    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CHECK_MARK} Message sent!`);
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const helpText = `${EMOJIS.FRISBEE} Ultimate Frisbee Training Bot Help

${EMOJIS.ROBOT} This bot sends training reminders twice a week based on seasons:

${EMOJIS.WINTER} Winter (Sept 15 - May 19):
   • Tuesdays & Saturdays at 8 PM

${EMOJIS.SUMMER} Summer (May 20 - Sept 14):
   • Sundays & Wednesdays at 8 PM

${EMOJIS.MEMO} Commands:
${BOT_COMMANDS.INFO} - Show current season info
${BOT_COMMANDS.TEST_TEMPLATE} - Test template message
${BOT_COMMANDS.TEST_LLM} - Test AI-generated message
${BOT_COMMANDS.TEST_SEASON} [date] - Test with specific date
${BOT_COMMANDS.SCHEDULE} - Show next training
${BOT_COMMANDS.HELP} - Show this help`;

    await this.bot.sendMessage(msg.chat.id, helpText);
  }

  private createTestResult(testDate: string, date: Date): TestResult {
    // Temporarily override the date
    const originalOverride = config.testing.overrideDate;
    config.testing.enabled = true;
    config.testing.overrideDate = testDate;

    const seasonConfig = this.seasonManager.getCurrentSeasonConfig(date);
    const shouldSend = this.seasonManager.shouldSendMessage(date);
    const nextTraining = this.seasonManager.getNextTrainingInfo(date);

    // Restore original config
    if (originalOverride) {
      config.testing.overrideDate = originalOverride;
    } else {
      delete config.testing.overrideDate;
    }
    if (!originalOverride) {
      config.testing.enabled = false;
    }

    const practiceDay = this.seasonManager.getPracticeForDay(date);

    const result: TestResult = {
      date: testDate,
      season: seasonConfig.season,
      location: seasonConfig.location,
      time: practiceDay?.time || seasonConfig.practices[0]?.time || '20:00',
      shouldSendMessage: shouldSend,
      nextTraining
    };

    if (shouldSend) {
      result.message = this.messageGenerator.generateTemplateMessage(seasonConfig, practiceDay);
    }

    return result;
  }

  private formatTestResult(result: TestResult): string {
    return `${EMOJIS.TEST_TUBE} Test Results for ${result.date}:

${EMOJIS.CALENDAR} Season: ${this.capitalize(result.season)}
${EMOJIS.LOCATION} Location: ${result.location}
${EMOJIS.CLOCK} Time: ${result.time}
${EMOJIS.MEMO} Should send message today: ${result.shouldSendMessage ? `${EMOJIS.CHECK_MARK} Yes` : `${EMOJIS.CROSS_MARK} No`}
${EMOJIS.RUNNER} Next training: ${result.nextTraining.dayName}, ${DateHelpers.formatDate(result.nextTraining.date)}`;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}