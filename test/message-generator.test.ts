import './helpers/testEnv'
import { test, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { type AddressInfo } from 'node:net'
import { CANCELLATION_SIGNATURE, EMOJIS, MARKERS, isKeyMessage } from '../src/utils/constants'

// Fake Ollama over HTTP, the real client's boundary; config is read on import, so it is loaded after
let reply: { status: number; content: string }
const ollama = createServer((_req, res) => {
  res.writeHead(reply.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: { role: 'assistant', content: reply.content }, done: true }))
})
await new Promise<void>(resolve => ollama.listen(0, '127.0.0.1', resolve))
after(() => { ollama.close() })

process.env.OLLAMA_ENABLED = 'true'
process.env.OLLAMA_HOST = `http://127.0.0.1:${(ollama.address() as AddressInfo).port}`
const { config } = await import('../src/config')
const { MessageGenerator } = await import('../src/services/MessageGenerator')

const generator = new MessageGenerator()
const season = { season: 'winter' as const, ...config.seasons.winter }
const practiceDay = season.practices[0]
const attendance = { count: 3, threshold: 8 }

beforeEach(() => { reply = { status: 200, content: 'Come play!\n\nSo far 3 of 8, react 👍.' } })

test('the announcement asks for a 👍 and names location and time', async () => {
  const message = await generator.generateMessage(season, { useLLM: false }, practiceDay)

  assert.ok(message.includes(EMOJIS.THUMBS_UP))
  assert.ok(message.includes(season.location))
  assert.ok(message.includes(practiceDay.time))
})

test('the announcement names the throwing time when there is one', async () => {
  const message = await generator.generateMessage({ ...season, throwingMinutesBefore: 30 }, {}, { day: 2, time: '20:30' })

  assert.ok(message.includes('20:00'))
  assert.ok(message.includes('20:30'))
})

test('the trainer request asks for a 👍', async () => {
  const message = await generator.generateTrainerMessage(season, { useLLM: false }, practiceDay)
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

test('the key request is recognised as the key message', () => {
  const message = generator.generateKeyMessage()

  assert.ok(message.startsWith(EMOJIS.KEY))
  assert.ok(message.includes(EMOJIS.CRYING))
  assert.ok(isKeyMessage(message))
})

test('the announcement is never mistaken for the key message', async () => {
  assert.equal(isKeyMessage(await generator.generateMessage(season, {}, practiceDay)), false)
})

test('the cancellation carries the signature, count and threshold', () => {
  const message = generator.generateCancellationMessage(season, practiceDay, attendance)

  assert.ok(message.includes(CANCELLATION_SIGNATURE))
  assert.ok(message.includes(`*${attendance.count}*`))
  assert.ok(message.includes(`*${attendance.threshold}*`))
})

test('the template reminder carries the marker, count and threshold', async () => {
  const message = await generator.generateReminderMessage(season, { useLLM: false }, practiceDay, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.ok(message.includes(String(attendance.count)))
  assert.ok(message.includes(String(attendance.threshold)))
})

test('the LLM reminder gets the marker when the LLM leaves it out', async () => {
  const message = await generator.generateReminderMessage(season, { useLLM: true }, practiceDay, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.ok(message.includes('Come play!'))
})

test('the LLM reminder keeps a single marker when the LLM already wrote it', async () => {
  reply.content = `${MARKERS.REMINDER} Come play!`
  const message = await generator.generateReminderMessage(season, { useLLM: true }, practiceDay, attendance)

  assert.ok(message.startsWith(MARKERS.REMINDER))
  assert.equal(message.split(MARKERS.REMINDER).length, 2)
})

test('a failing LLM falls back to the templates', async () => {
  reply = { status: 500, content: '' }

  const reminder = await generator.generateReminderMessage(season, { useLLM: true }, practiceDay, attendance)
  const announcement = await generator.generateMessage(season, { useLLM: true }, practiceDay)

  assert.ok(reminder.startsWith(MARKERS.REMINDER))
  assert.ok(reminder.includes(String(attendance.threshold)))
  assert.ok(announcement.includes(EMOJIS.THUMBS_UP))
})

test('an empty LLM reply falls back to the template', async () => {
  reply.content = '  '
  const message = await generator.generateTrainerMessage(season, { useLLM: true }, practiceDay)
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

test('a markdown location link survives the LLM announcement', async () => {
  reply.content = 'Training at Hall tomorrow, react 👍'
  const linked = { ...season, location: '[Hall](https://maps.example/hall)' }

  const message = await generator.generateMessage(linked, { useLLM: true }, practiceDay)

  assert.ok(message.includes(linked.location))
})
