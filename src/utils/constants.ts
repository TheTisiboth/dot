export const EMOJIS = {
  FRISBEE: '🥏',
  ROCKET: '🚀',
  BULB: '💡',
  CALENDAR: '📅',
  LOCATION: '📍',
  CLOCK: '⏰',
  FIRE: '🔥',
  MEMO: '📝',
  ROBOT: '🤖',
  CROSS_MARK: '❌',
  WARNING: '⚠️',
  WINTER: '🏔️',
  SUMMER: '🏖️',
  RUNNER: '🏃',
  THUMBS_UP: '👍',
  CHECK_MARK: '✅',
  COACH: '👨‍🏫',
  MEGAPHONE: '📣',
  KEY: '🔑',
  CRYING: '😢'
} as const

// Prepended in code (never by the LLM). Cosmetic only - the LLM does not reliably respect the
// prompt's emoji allowlist, so a marker emoji is not safe to identify a message by.
export const MARKERS = {
  REMINDER: EMOJIS.MEGAPHONE,
  CANCELLATION: EMOJIS.CROSS_MARK,
  KEY: EMOJIS.KEY
} as const

// The key message also carries a 👍, so the poll finder must skip it. Both parts are enforced in
// code, which makes the pair safe to match on even though the marker alone is not.
export const isKeyMessage = (text: string): boolean =>
  text.startsWith(MARKERS.KEY) && text.includes(EMOJIS.CRYING)

// The cancellation is template-only, so this sentence is deterministic and safe to match on.
// Reminders are found structurally instead (they are the only bot reply to the training post).
export const CANCELLATION_SIGNATURE = 'Training should be cancelled'

export const MESSAGES = {
  BOT_STARTED: 'Ultimate Frisbee Training Bot started!',
  GENERATING_LLM_MESSAGE: 'Generating LLM message...'
} as const
