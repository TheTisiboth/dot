export const EMOJIS = {
  FRISBEE: '🥏',
  ROCKET: '🚀',
  BULB: '💡',
  CALENDAR: '📅',
  LOCATION: '📍',
  CLOCK: '⏰',
  SCHEDULE: '🗓️',
  MEMO: '📝',
  ROBOT: '🤖',
  CROSS_MARK: '❌',
  WARNING: '⚠️',
  WINTER: '🏔️',
  SUMMER: '🏖️',
  RUNNER: '🏃',
  THUMBS_UP: '👍'
} as const

export const MESSAGES = {
  BOT_STARTED: 'Ultimate Frisbee Training Bot started!',
  SCHEDULER_INITIALIZED: 'Scheduler initialized - reminders will be sent 24h before practice',
  MESSAGE_SENT_SUCCESS: 'Message sent successfully',
  CHECKING_MESSAGE_SEND: 'Checking if should send message...',
  SENDING_SCHEDULED_MESSAGE: 'Sending scheduled message...',
  NOT_TRAINING_DAY: 'Not a training day tomorrow, skipping message.',
  CHAT_ID_NOT_CONFIGURED: 'CHAT_ID not configured. Message would be:',
  GENERATING_LLM_MESSAGE: 'Generating LLM message...',
  ADMIN_ONLY_COMMAND: 'This command can only be used by the configured admin.',
  FALLBACK_TO_TEMPLATE: 'Falling back to template message'
} as const