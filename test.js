#!/usr/bin/env node

const SeasonManager = require('./seasonManager');
const { config } = require('./config');

console.log('🧪 Testing Telegram Bot Configuration and Logic\n');

// Test season manager
const seasonManager = new SeasonManager();

console.log('📅 Season Detection Tests:');
// Test winter season (December)
const winterDate = new Date('2024-12-15');
console.log(`  Winter test (Dec 15): ${seasonManager.getCurrentSeason(winterDate)}`);

// Test summer season (July)
const summerDate = new Date('2024-07-15');
console.log(`  Summer test (Jul 15): ${seasonManager.getCurrentSeason(summerDate)}`);

// Test current season
console.log(`  Current season: ${seasonManager.getCurrentSeason()}`);

console.log('\n⚙️ Configuration Tests:');
console.log(`  Bot Token: ${config.botToken ? '✅ Set' : '❌ Missing'}`);
console.log(`  Chat ID: ${config.chatId ? '✅ Set' : '❌ Missing'}`);

console.log('\n📋 Current Season Configuration:');
const currentConfig = seasonManager.getCurrentSeasonConfig();
console.log(`  Season: ${currentConfig.name}`);
console.log(`  Message: ${currentConfig.messageTemplate}`);
console.log('  Schedule:');
currentConfig.schedule.forEach((item, index) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(`    ${index + 1}. ${days[item.dayOfWeek]} at ${item.time}`);
});

console.log('\n🕐 Cron Expressions:');
const cronExpressions = seasonManager.getCurrentCronExpressions();
cronExpressions.forEach((cron, index) => {
  console.log(`  ${index + 1}. ${cron}`);
});

console.log('\n✅ Test completed!');

// Show usage instructions if configuration is missing
if (!config.botToken || !config.chatId) {
  console.log('\n📝 Setup Instructions:');
  console.log('1. Copy .env.example to .env');
  console.log('2. Set your BOT_TOKEN (get from @BotFather on Telegram)');
  console.log('3. Set your CHAT_ID (the channel/group where messages will be sent)');
  console.log('4. Run: npm start');
}