const { Bot } = require('grammy');
const cron = require('node-cron');
const { config, validateConfig } = require('./config');
const SeasonManager = require('./seasonManager');

class TelegramBot {
  constructor() {
    // Validate configuration before initializing
    validateConfig();
    
    this.bot = new Bot(config.botToken);
    this.seasonManager = new SeasonManager();
    this.scheduledJobs = [];
    
    this.setupBot();
  }

  /**
   * Set up bot commands and handlers
   */
  setupBot() {
    // Basic command handlers
    this.bot.command('start', (ctx) => {
      ctx.reply('🐕 Hello! I\'m your seasonal dog care reminder bot. I\'ll send reminders based on the current season.');
    });

    this.bot.command('status', (ctx) => {
      const seasonConfig = this.seasonManager.getCurrentSeasonConfig();
      const scheduleText = seasonConfig.schedule.map(s => 
        `Day ${s.dayOfWeek} at ${s.time}`
      ).join(', ');
      
      ctx.reply(
        `📅 Current season: ${seasonConfig.name.charAt(0).toUpperCase() + seasonConfig.name.slice(1)}\n` +
        `🕐 Schedule: ${scheduleText}\n` +
        `💬 Message: ${seasonConfig.messageTemplate}`
      );
    });

    this.bot.command('test', (ctx) => {
      const message = this.seasonManager.getCurrentMessageTemplate();
      this.sendMessage(message);
      ctx.reply('Test message sent to configured channel!');
    });

    this.bot.command('help', (ctx) => {
      ctx.reply(
        '🤖 Available commands:\n' +
        '/start - Start the bot\n' +
        '/status - Show current season and schedule\n' +
        '/test - Send a test message to the channel\n' +
        '/help - Show this help message'
      );
    });

    // Error handling
    this.bot.catch((err) => {
      console.error('Bot error:', err);
    });
  }

  /**
   * Send a message to the configured chat
   * @param {string} message - Message to send
   */
  async sendMessage(message) {
    try {
      await this.bot.api.sendMessage(config.chatId, message);
      console.log(`Message sent: ${message}`);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }

  /**
   * Send the seasonal reminder message
   */
  async sendSeasonalReminder() {
    const message = this.seasonManager.getCurrentMessageTemplate();
    await this.sendMessage(message);
  }

  /**
   * Schedule jobs based on current season
   */
  scheduleJobs() {
    // Clear existing scheduled jobs
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    const cronExpressions = this.seasonManager.getCurrentCronExpressions();
    const seasonName = this.seasonManager.getCurrentSeason();

    console.log(`Setting up ${seasonName} season schedule...`);

    cronExpressions.forEach((cronExpression, index) => {
      console.log(`Scheduling job ${index + 1}: ${cronExpression}`);
      
      const job = cron.schedule(cronExpression, () => {
        console.log(`Executing scheduled job ${index + 1} for ${seasonName} season`);
        this.sendSeasonalReminder();
      }, {
        scheduled: true,
        timezone: 'UTC'
      });

      this.scheduledJobs.push(job);
    });

    console.log(`Scheduled ${cronExpressions.length} jobs for ${seasonName} season`);
  }

  /**
   * Check if season has changed and reschedule if needed
   */
  checkSeasonChange() {
    const currentSeason = this.seasonManager.getCurrentSeason();
    if (this.lastSeason !== currentSeason) {
      console.log(`Season changed from ${this.lastSeason} to ${currentSeason}`);
      this.lastSeason = currentSeason;
      this.scheduleJobs();
    }
  }

  /**
   * Start the bot
   */
  async start() {
    try {
      console.log('Starting Telegram bot...');
      
      // Initialize current season
      this.lastSeason = this.seasonManager.getCurrentSeason();
      console.log(`Initial season: ${this.lastSeason}`);
      
      // Schedule initial jobs
      this.scheduleJobs();
      
      // Check for season changes daily at midnight
      cron.schedule('0 0 * * *', () => {
        console.log('Checking for season changes...');
        this.checkSeasonChange();
      });

      // Start the bot
      await this.bot.start();
      console.log('Bot started successfully!');
      
    } catch (error) {
      console.error('Error starting bot:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the bot
   */
  async stop() {
    console.log('Stopping bot...');
    
    // Stop all scheduled jobs
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];
    
    // Stop the bot
    await this.bot.stop();
    console.log('Bot stopped.');
  }
}

module.exports = TelegramBot;