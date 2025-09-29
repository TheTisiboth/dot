#!/usr/bin/env node

const TelegramBot = require('./bot');

// Handle graceful shutdown
const bot = new TelegramBot();

process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await bot.stop();
  process.exit(0);
});

// Start the bot
bot.start().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});