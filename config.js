const dotenv = require('dotenv');
dotenv.config();

// Configuration object for the Telegram bot
const config = {
  // Telegram Bot settings
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.CHAT_ID,
  
  // Seasonal configuration
  seasons: {
    winter: {
      startDate: process.env.WINTER_START_DATE || '2024-12-01',
      schedule: [
        {
          dayOfWeek: parseInt(process.env.WINTER_DAY_1?.split(' ')[0]) || 1, // Monday
          time: process.env.WINTER_DAY_1?.split(' ')[1] || '09:00'
        },
        {
          dayOfWeek: parseInt(process.env.WINTER_DAY_2?.split(' ')[0]) || 4, // Thursday
          time: process.env.WINTER_DAY_2?.split(' ')[1] || '14:30'
        }
      ],
      messageTemplate: process.env.WINTER_MESSAGE_TEMPLATE || 
        "🐕 Winter reminder: Don't forget to take care of your furry friend in cold weather! ❄️"
    },
    summer: {
      startDate: process.env.SUMMER_START_DATE || '2024-06-01',
      schedule: [
        {
          dayOfWeek: parseInt(process.env.SUMMER_DAY_1?.split(' ')[0]) || 2, // Tuesday
          time: process.env.SUMMER_DAY_1?.split(' ')[1] || '08:00'
        },
        {
          dayOfWeek: parseInt(process.env.SUMMER_DAY_2?.split(' ')[0]) || 5, // Friday
          time: process.env.SUMMER_DAY_2?.split(' ')[1] || '16:00'
        }
      ],
      messageTemplate: process.env.SUMMER_MESSAGE_TEMPLATE || 
        "🐕 Summer reminder: Keep your dog hydrated and cool in the hot weather! ☀️"
    }
  },
  
  // LLM settings (for future enhancement)
  llm: {
    enabled: process.env.ENABLE_LLM === 'true',
    prompt: process.env.LLM_PROMPT || 'Generate a friendly reminder message about dog care for the current season'
  }
};

// Validation function
function validateConfig() {
  const errors = [];
  
  if (!config.botToken) {
    errors.push('BOT_TOKEN is required');
  }
  
  if (!config.chatId) {
    errors.push('CHAT_ID is required');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}

module.exports = { config, validateConfig };