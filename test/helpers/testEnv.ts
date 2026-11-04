// Imported first by tests that load `config`: it validates on import and exits on missing vars.
// dotenv never overrides vars already set, so a local .env cannot leak into these values.
Object.assign(process.env, {
  TELEGRAM_BOT_TOKEN: '1000:test-token',
  CHAT_ID: '-100',
  CHAT_THREAD_ID: '',
  ADMIN_CHAT_ID: '-200',
  TRAINER_CHAT_ID: '-300',
  TRAINER_CHAT_THREAD_ID: '',
  TELEGRAM_API_ID: '1',
  TELEGRAM_API_HASH: 'hash',
  TELEGRAM_SESSION: `1${'A'.repeat(60)}`,
  WINTER_START_DATE: '9:15',
  WINTER_LOCATION: 'Hall',
  WINTER_PRACTICE_DAYS: '2:20:30,6:21:00',
  SUMMER_START_DATE: '5:20',
  SUMMER_LOCATION: 'Park',
  SUMMER_PRACTICE_DAYS: '0:19:00,3:19:30',
  OLLAMA_ENABLED: 'false',
  TEST_MODE: 'false',
  OVERRIDE_DATE: '',
  EXCEPTIONAL_LOCATION: '',
  EXCEPTIONAL_TIME: '',
  EXCEPTIONAL_CANCELLED: 'false',
  RULES_QUIZ_ENABLED: 'true',
  RULES_CHAT_ID: '-400',
  RULES_CHAT_THREAD_ID: '7',
  RULES_ANSWER_TIME: '22:00'
})

// Service logs written while the runner streams results can garble its messages ("Unable to deserialize cloned data")
console.log = () => undefined
console.warn = () => undefined
console.error = () => undefined
