import TelegramBot from 'node-telegram-bot-api';
import { SeasonManager } from '../services/SeasonManager.js';
import { MessageGenerator } from '../services/MessageGenerator.js';
import { SchedulerService } from '../services/SchedulerService.js';
import { config } from '../config/index.js';
import { TestResult, PracticeDay } from '../types/index.js';
import { BOT_COMMANDS, EMOJIS, MESSAGES } from '../utils/constants.js';
import { DateHelpers } from '../utils/dateHelpers.js';

export class BotController {
  private readonly bot: TelegramBot;
  private readonly seasonManager: SeasonManager;
  private readonly messageGenerator: MessageGenerator;
  private readonly adminChatId?: string;

  constructor(
    bot: TelegramBot,
    seasonManager: SeasonManager,
    messageGenerator: MessageGenerator,
    _schedulerService: SchedulerService
  ) {
    this.bot = bot;
    this.seasonManager = seasonManager;
    this.messageGenerator = messageGenerator;
    this.adminChatId = config.telegram.adminChatId;

    this.setupCommands();
  }

  private setupCommands(): void {
    // Public commands
    this.bot.onText(/\/start/, (msg) => this.handleStart(msg));
    this.bot.onText(/\/info/, (msg) => this.handleInfo(msg));
    this.bot.onText(/\/schedule/, (msg) => this.handleSchedule(msg));
    this.bot.onText(/\/help/, (msg) => this.handleHelp(msg));

    // Admin-only commands
    this.bot.onText(/\/test_template/, (msg) => this.requireAdmin(msg, () => this.handleTestTemplate(msg)));
    this.bot.onText(/\/test_llm/, (msg) => this.requireAdmin(msg, () => this.handleTestLLM(msg)));
    this.bot.onText(/\/test_season (.+)/, (msg, match) => this.requireAdmin(msg, () => this.handleTestSeason(msg, match)));
    this.bot.onText(/\/send_now/, (msg) => this.requireAdmin(msg, () => this.handleSendNow(msg)));
  }

  private isAdmin(chatId: number): boolean {
    return this.adminChatId !== undefined && chatId.toString() === this.adminChatId;
  }

  private async requireAdmin(msg: TelegramBot.Message, handler: () => Promise<void>): Promise<void> {
    if (!this.isAdmin(msg.chat.id)) {
      await this.bot.sendMessage(msg.chat.id, `${EMOJIS.CROSS_MARK} ${MESSAGES.ADMIN_ONLY_COMMAND}`);
      return;
    }
    await handler();
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const helpText = `${EMOJIS.FRISBEE} Ultimate Frisbee Training Bot is running!

I send training reminders to the team group 24h before each practice.

${EMOJIS.MEMO} Available commands:
${BOT_COMMANDS.INFO} - Show current season and schedule
${BOT_COMMANDS.SCHEDULE} - Show next training date
${BOT_COMMANDS.HELP} - Show detailed help

Type /help for more information!`;

    await this.bot.sendMessage(msg.chat.id, helpText);
  }

  private async handleInfo(msg: TelegramBot.Message): Promise<void> {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const trainingDays = this.seasonManager.getTrainingDaysString();

    const infoText = `${EMOJIS.CALENDAR} Current Season: ${this.capitalize(seasonConfig.season)}
${EMOJIS.LOCATION} Location: ${seasonConfig.location}
${EMOJIS.SCHEDULE} Training Days: ${trainingDays}
${EMOJIS.ANNOUNCEMENT} Reminders sent 24h before practice`;

    await this.bot.sendMessage(msg.chat.id, infoText, { parse_mode: 'Markdown' });
  }

  private async handleTestTemplate(msg: TelegramBot.Message): Promise<void> {
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const practiceDay = this.seasonManager.getPracticeForDay();
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: false }, practiceDay);

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.MEMO} Template Message:\n\n${message}`, { parse_mode: 'Markdown' });
  }

  private async handleTestLLM(msg: TelegramBot.Message): Promise<void> {
    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} ${MESSAGES.GENERATING_LLM_MESSAGE}`);

    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const practiceDay = this.seasonManager.getPracticeForDay();
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM: true }, practiceDay);

    await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ROBOT} LLM Generated Message:\n\n${message}`, { parse_mode: 'Markdown' });
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
      await this.bot.sendMessage(msg.chat.id, resultText, { parse_mode: 'Markdown' });

      if (testResult.shouldSendMessage && testResult.message) {
        await this.bot.sendMessage(msg.chat.id, `${EMOJIS.ANNOUNCEMENT} Message that would be sent:\n\n${testResult.message}`, { parse_mode: 'Markdown' });
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
    const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
    const practiceDay = this.seasonManager.getPracticeForDay();
    const useLLM = this.messageGenerator.isLLMAvailable();
    const message = await this.messageGenerator.generateMessage(seasonConfig, { useLLM }, practiceDay);

    await this.bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const winterInfo = this.formatSeasonInfo('winter', config.seasons.winter, config.seasons.summer.startDate);
    const summerInfo = this.formatSeasonInfo('summer', config.seasons.summer, config.seasons.winter.startDate);

    const helpText = `${EMOJIS.FRISBEE} Ultimate Frisbee Training Dog boT Help

${EMOJIS.ROBOT} This bot sends training reminders 24h before each practice:

${winterInfo}

${summerInfo}

${EMOJIS.MEMO} Commands:
${BOT_COMMANDS.INFO} - Show current season info
${BOT_COMMANDS.SCHEDULE} - Show next training
${BOT_COMMANDS.HELP} - Show this help`;

    await this.bot.sendMessage(msg.chat.id, helpText);
  }

  private formatSeasonInfo(
    season: 'winter' | 'summer',
    seasonConfig: { startDate: { month: number; day: number }; practices: PracticeDay[] },
    nextSeasonStart: { month: number; day: number }
  ): string {
    const emoji = season === 'winter' ? EMOJIS.WINTER : EMOJIS.SUMMER;
    const name = season.charAt(0).toUpperCase() + season.slice(1);
    const start = this.formatDateShort(seasonConfig.startDate);
    const end = this.formatDateShort(this.getDateBefore(nextSeasonStart));
    const practices = this.formatPracticeDays(seasonConfig.practices);

    return `${emoji} ${name} (${start} - ${end}):\n${practices}`;
  }

  private formatDateShort(dateConfig: { month: number; day: number }): string {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[dateConfig.month - 1]} ${dateConfig.day}`;
  }

  private getDateBefore(dateConfig: { month: number; day: number }): { month: number; day: number } {
    const date = new Date(2024, dateConfig.month - 1, dateConfig.day);
    date.setDate(date.getDate() - 1);
    return { month: date.getMonth() + 1, day: date.getDate() };
  }

  private formatPracticeDays(practices: PracticeDay[]): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return practices
      .map(p => `   • ${dayNames[p.day]}s at ${p.time}`)
      .join('\n');
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