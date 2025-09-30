import dotenv from 'dotenv';
import { BotConfig, PracticeDay } from '../types/index.js';

dotenv.config();

// Helper function to parse practice days from environment variable
// Format: "day:time,day:time" e.g., "2:20:30,6:21:00" for Tuesday 20:30 and Saturday 21:00
function parsePracticeDays(envVar: string, defaultDays: PracticeDay[]): PracticeDay[] {
  if (!envVar) return defaultDays;

  try {
    return envVar.split(',').map(dayTime => {
      const [day] = dayTime.trim().split(':');
      const timeStr = dayTime.trim().substring(dayTime.indexOf(':') + 1); // Get everything after first ':'
      return {
        day: parseInt(day),
        time: timeStr
      };
    });
  } catch (error) {
    console.warn(`Invalid practice days format: ${envVar}. Using defaults.`);
    return defaultDays;
  }
}

// Helper function to parse date from environment variable "month:day"
function parseDate(envVar: string, defaultMonth: number, defaultDay: number) {
  if (!envVar) return { month: defaultMonth, day: defaultDay };

  try {
    const [month, day] = envVar.split(':').map(num => parseInt(num));
    return { month, day };
  } catch (error) {
    console.warn(`Invalid date format: ${envVar}. Using defaults.`);
    return { month: defaultMonth, day: defaultDay };
  }
}

export const config: BotConfig = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    ...(process.env.CHAT_ID && { chatId: process.env.CHAT_ID }),
  },

  ollama: {
    enabled: process.env.OLLAMA_ENABLED === 'true',
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3.2:3b',
  },

  seasons: {
    winter: {
      startDate: parseDate(process.env.WINTER_START_DATE || '', 9, 15), // Default: September 15
      location: process.env.WINTER_LOCATION || 'Park Arena',
      practices: parsePracticeDays(
        process.env.WINTER_PRACTICE_DAYS || '',
        [
          { day: 2, time: '20:30' }, // Tuesday 20:30
          { day: 6, time: '20:30' }  // Saturday 20:30
        ]
      ),
      scheduleTime: process.env.WINTER_SCHEDULE_TIME || '20:00'
    },
    summer: {
      startDate: parseDate(process.env.SUMMER_START_DATE || '', 5, 20), // Default: May 20
      location: process.env.SUMMER_LOCATION || 'Beach Courts',
      practices: parsePracticeDays(
        process.env.SUMMER_PRACTICE_DAYS || '',
        [
          { day: 0, time: '19:00' }, // Sunday 19:00
          { day: 3, time: '19:00' }  // Wednesday 19:00
        ]
      ),
      scheduleTime: process.env.SUMMER_SCHEDULE_TIME || '20:00'
    }
  },

  testing: {
    enabled: process.env.TEST_MODE === 'true',
    ...(process.env.OVERRIDE_DATE && { overrideDate: process.env.OVERRIDE_DATE }),
  }
};

export const validateConfig = (): void => {
  if (!config.telegram.token) {
    throw new Error('TELEGRAM_BOT_TOKEN is required');
  }

  if (!config.telegram.chatId && !config.testing.enabled) {
    console.warn('⚠️  CHAT_ID not set - bot will work for testing but won\'t send scheduled messages');
  }
};