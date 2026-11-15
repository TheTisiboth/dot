import { test, mock, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { log } from '../src/utils/logger'

afterEach(() => { mock.restoreAll() })

const captured = (method: 'log' | 'error', run: () => void): string[] => {
  const spy = mock.method(console, method, () => {})
  run()
  return spy.mock.calls.map(call => call.arguments.join(' '))
}

test('an error that is a plain object is logged with its fields', () => {
  const [line] = captured('error', () => { log.error('ctx', { code: 400, description: 'x' }) })
  assert.match(line, /code: 400/)
  assert.match(line, /description: 'x'/)
})

test('an error that is a string is logged as is', () => {
  const [line] = captured('error', () => { log.error('ctx', 'flood wait') })
  assert.match(line, /flood wait/)
})

test('the cause of an error is logged with it', () => {
  const [line] = captured('error', () => { log.error('ctx', new Error('send failed', { cause: { code: 403 } })) })
  assert.match(line, /send failed/)
  assert.match(line, /code: 403/)
})

test('an error whose cause chain loops back is still logged', () => {
  const error = new Error('send failed')
  error.cause = new Error('socket closed', { cause: error })
  const [line] = captured('error', () => { log.error('ctx', error) })
  assert.match(line, /send failed/)
  assert.match(line, /socket closed/)
})

test('a log line never starts with two emojis', () => {
  const lines = captured('log', () => {
    log.scheduler('⏰ Registered daily reminder check at 18:00')
    log.bot('🤖 LLM: ollama')
    log.messageGen('Key message generated')
    log.command('/next', 1)
    log.auth('Non-admin attempted /x')
  })
  for (const line of lines) assert.doesNotMatch(line, /^\p{Extended_Pictographic}\S*\s+\[\w+\]\s+\p{Extended_Pictographic}/u)
})
