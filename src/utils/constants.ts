export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
] as const;

export const BOT_COMMANDS = {
  START: '/start',
  INFO: '/info',
  HELP: '/help',
  SCHEDULE: '/schedule',
  TEST_TEMPLATE: '/test_template',
  TEST_LLM: '/test_llm',
  TEST_SEASON: '/test_season',
  SEND_NOW: '/send_now'
} as const;

export const EMOJIS = {
  FRISBEE: '🥏',
  ROCKET: '🚀',
  BULB: '💡',
  CALENDAR: '📅',
  LOCATION: '📍',
  CLOCK: '⏰',
  SCHEDULE: '🗓️',
  ANNOUNCEMENT: '📢',
  MEMO: '📝',
  ROBOT: '🤖',
  TEST_TUBE: '🧪',
  CHECK_MARK: '✅',
  CROSS_MARK: '❌',
  WARNING: '⚠️',
  WINTER: '🏔️',
  SUMMER: '🏖️',
  RUNNER: '🏃',
  THUMBS_UP: '👍'
} as const;

export const MESSAGES = {
  BOT_STARTED: 'Ultimate Frisbee Training Bot started!',
  SCHEDULER_INITIALIZED: 'Scheduler initialized - messages will be sent at 8:00 PM on training days',
  MESSAGE_SENT_SUCCESS: 'Message sent successfully',
  CHECKING_MESSAGE_SEND: 'Checking if should send message...',
  SENDING_SCHEDULED_MESSAGE: 'Sending scheduled message...',
  NOT_TRAINING_DAY: 'Not a training day, skipping message.',
  CHAT_ID_NOT_CONFIGURED: 'CHAT_ID not configured. Message would be:',
  GENERATING_LLM_MESSAGE: 'Generating LLM message...',
  ADMIN_ONLY_COMMAND: 'This command can only be used by the configured admin.',
  OPENAI_NOT_CONFIGURED: 'OpenAI not configured, falling back to template message',
  FALLBACK_TO_TEMPLATE: 'Falling back to template message',
  INVALID_DATE_FORMAT: 'Invalid date format',
  DATE_FORMAT_HELP: 'Use format: YYYY-MM-DD (e.g., 2024-01-15)'
} as const;