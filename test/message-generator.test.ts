import './helpers/testEnv'
import { test, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { type AddressInfo } from 'node:net'
import { Ollama } from 'ollama'
import { CANCELLATION_SIGNATURE, EMOJIS, MARKERS, isKeyMessage } from '../src/utils/constants'
import { parseLocation } from '../src/config/env'
import { formatTime } from '../src/utils/formatters'
import { MessageGenerator } from '../src/services/MessageGenerator'
import { testConfig } from './fixtures/config'

// Fake Ollama over HTTP, the real client's boundary
let reply: { status: number; content: string }
const ollama = createServer((_req, res) => {
  res.writeHead(reply.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: { role: 'assistant', content: reply.content }, done: true }))
})
await new Promise<void>(resolve => ollama.listen(0, '127.0.0.1', resolve))
after(() => { ollama.close() })

const config = testConfig()
const generator = new MessageGenerator(config, new Ollama({ host: `http://127.0.0.1:${(ollama.address() as AddressInfo).port}` }))
const practiceDay = config.seasons.winter.practices[0]
const training = { date: new Date(), location: config.seasons.winter.location, time: practiceDay.time, season: 'winter' as const, practiceDay }
const attendance = { count: 3, threshold: 8 }

beforeEach(() => { reply = { status: 200, content: 'Come play!\n\nSo far 3 of 8, react 👍.' } })

test('the announcement asks for a 👍 and names location and time', async () => {
  const message = await generator.generateMessage(training, { useLLM: false })

  assert.ok(message.includes(EMOJIS.THUMBS_UP))
  assert.ok(message.includes(training.location.name))
  assert.ok(message.includes(formatTime(training.time)))
})

test('the announcement names the throwing time when there is one', async () => {
  const message = await generator.generateMessage({ ...training, time: { hour: 20, minute: 30 }, throwingTime: { hour: 20, minute: 0 } })

  assert.ok(message.includes('20:00'))
  assert.ok(message.includes('20:30'))
})

test('the trainer request asks for a 👍', async () => {
  const message = await generator.generateTrainerMessage(training, { useLLM: false })
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

test('the key request is recognised as the key message', () => {
  const message = generator.generateKeyMessage()

  assert.ok(message.startsWith(EMOJIS.KEY))
  assert.ok(message.includes(EMOJIS.CRYING))
  assert.ok(isKeyMessage(message))
})

test('the announcement is never mistaken for the key message', async () => {
  assert.equal(isKeyMessage(await generator.generateMessage(training, {})), false)
})

test('the cancellation carries the signature, count and threshold', () => {
  const message = generator.generateCancellationMessage(training, attendance)

  assert.ok(message.includes(CANCELLATION_SIGNATURE))
  assert.ok(message.includes(`<b>${attendance.count}</b>`))
  assert.ok(message.includes(`<b>${attendance.threshold}</b>`))
})

test('the template reminder carries the marker, count and threshold', async () => {
  const message = await generator.generateReminderMessage(training, { useLLM: false }, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.ok(message.includes(String(attendance.count)))
  assert.ok(message.includes(String(attendance.threshold)))
})

test('the LLM reminder gets the marker when the LLM leaves it out', async () => {
  const message = await generator.generateReminderMessage(training, { useLLM: true }, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.ok(message.includes('Come play!'))
})

test('the LLM reminder keeps a single marker when the LLM already wrote it', async () => {
  reply.content = `${MARKERS.REMINDER} Come play!`
  const message = await generator.generateReminderMessage(training, { useLLM: true }, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.equal(message.split(MARKERS.REMINDER).length, 2)
})

test('a failing LLM falls back to the templates', async () => {
  reply = { status: 500, content: '' }

  const reminder = await generator.generateReminderMessage(training, { useLLM: true }, attendance)
  const announcement = await generator.generateMessage(training, { useLLM: true })

  assert.ok(reminder.startsWith(MARKERS.REMINDER))
  assert.ok(reminder.includes(String(attendance.threshold)))
  assert.ok(announcement.includes(EMOJIS.THUMBS_UP))
})

test('an empty LLM reply falls back to the template', async () => {
  reply.content = '  '
  const message = await generator.generateTrainerMessage(training, { useLLM: true })
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

const stPauli = { ...training, location: parseLocation('[St. Pauli (Halle 2)](https://maps.example/st-pauli?a=1&b=2)') }
const stPauliLink = '<a href="https://maps.example/st-pauli?a=1&amp;b=2">St. Pauli (Halle 2)</a>'

test('a location link with pattern characters is linked in the template announcement', async () => {
  const message = await generator.generateMessage(stPauli, { useLLM: false })
  assert.ok(message.includes(stPauliLink))
})

test('a location link with pattern characters is linked in the LLM announcement', async () => {
  reply.content = 'Training at St. Pauli (Halle 2) tomorrow, react 👍'
  const message = await generator.generateMessage(stPauli, { useLLM: true })
  assert.ok(message.includes(stPauliLink))
})

test('LLM text with markup characters reaches the announcement escaped and intact', async () => {
  reply.content = 'Sky_plastic time * <3 & [go'
  const message = await generator.generateMessage(training, { useLLM: true })
  assert.ok(message.includes('Sky_plastic time * &lt;3 &amp; [go'))
})

test('a location without a link is the plain name', () => {
  assert.deepEqual(parseLocation('Hall'), { name: 'Hall' })
})
