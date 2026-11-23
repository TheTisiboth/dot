import './helpers/testEnv'
import { test, after, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { type AddressInfo } from 'node:net'
import { Ollama } from 'ollama'
import { CANCELLATION_SIGNATURE, MARKERS, isKeyRequest } from '../src/training/markers'
import { EMOJIS } from '../src/shared/emojis'
import { parseLocation } from '../src/config/env'
import { formatClock } from '../src/shared/formatters'
import { LLM_TIMEOUT_MS, llmWriter } from '../src/training/messages/llmWriter'
import { trainingMessages } from '../src/training/messages/messages'
import * as prompts from '../src/training/messages/prompts'
import * as templates from '../src/training/messages/templates'
import { SeasonManager } from '../src/training/season'
import { at } from './fixtures/dates'
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
const generator = trainingMessages(llmWriter(config.ollama, new Ollama({ host: `http://127.0.0.1:${(ollama.address() as AddressInfo).port}` })))
// Tue 2027-01-05 20:30, a winter practice
const training = new SeasonManager(config).nextTraining(at(2027, 1, 4))
const attendance = { count: 3, threshold: 8 }

beforeEach(() => { reply = { status: 200, content: 'Come play!\n\nSo far 3 of 8, react 👍.' } })

test('the announcement asks for a 👍 and names location and time', () => {
  const message = templates.announcement(training)

  assert.ok(message.includes(EMOJIS.THUMBS_UP))
  assert.ok(message.includes(training.location.name))
  assert.ok(message.includes(formatClock(training.startsAt)))
})

test('the announcement names the throwing time when there is one', () => {
  const message = templates.announcement({ ...training, startsAt: at(2027, 1, 5, 20, 30), throwingAt: at(2027, 1, 5, 20, 0) })

  assert.ok(message.includes('20:00'))
  assert.ok(message.includes('20:30'))
})

test('the trainer request asks for a 👍', () => {
  const message = templates.trainerRequest(training)
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

test('the key request is recognised as the key message', () => {
  const message = templates.keyRequest()

  assert.ok(message.startsWith(EMOJIS.KEY))
  assert.ok(message.includes(EMOJIS.CRYING))
  assert.ok(isKeyRequest(message))
})

test('the announcement is never mistaken for the key message', () => {
  assert.equal(isKeyRequest(templates.announcement(training)), false)
})

test('the cancellation carries the signature, count and threshold', () => {
  const message = templates.cancellationNotice(training, attendance, config.attendance.cancelHoursBefore)

  assert.ok(message.includes(CANCELLATION_SIGNATURE))
  assert.ok(message.includes(`<b>${attendance.count}</b>`))
  assert.ok(message.includes(`<b>${attendance.threshold}</b>`))
})

test('the template reminder carries the marker, count and threshold', () => {
  const message = templates.attendanceReminder(training, attendance)

  assert.ok(message.startsWith(MARKERS.ATTENDANCE_REMINDER))
  assert.ok(message.includes(String(attendance.count)))
  assert.ok(message.includes(String(attendance.threshold)))
})

test('the LLM reminder gets the marker when the LLM leaves it out', async () => {
  const message = await generator.attendanceReminder(training, attendance)

  assert.ok(message.startsWith(MARKERS.ATTENDANCE_REMINDER))
  assert.ok(message.includes('Come play!'))
})

test('the LLM reminder keeps a single marker when the LLM already wrote it', async () => {
  reply.content = `${MARKERS.ATTENDANCE_REMINDER} Come play!`
  const message = await generator.attendanceReminder(training, attendance)

  assert.ok(message.startsWith(MARKERS.ATTENDANCE_REMINDER))
  assert.equal(message.split(MARKERS.ATTENDANCE_REMINDER).length, 2)
})

test('a failing LLM falls back to the templates', async () => {
  reply = { status: 500, content: '' }

  const reminder = await generator.attendanceReminder(training, attendance)
  const announcement = await generator.announcement(training)

  assert.ok(reminder.startsWith(MARKERS.ATTENDANCE_REMINDER))
  assert.ok(reminder.includes(String(attendance.threshold)))
  assert.ok(announcement.includes(EMOJIS.THUMBS_UP))
})

test('an empty LLM reply falls back to the template', async () => {
  reply.content = '  '
  const message = await generator.trainerRequest(training)
  assert.ok(message.includes(EMOJIS.THUMBS_UP))
})

test('the prompts carry the facts the LLM must state', () => {
  const time = formatClock(training.startsAt)

  for (const prompt of [prompts.announcement(training), prompts.trainerRequest(training)]) {
    assert.ok(prompt.includes(time))
    assert.ok(prompt.includes(training.season))
  }
  assert.ok(prompts.announcement(training).includes(training.location.name))

  const reminder = prompts.attendanceReminder(training, attendance)
  assert.ok(reminder.includes(time))
  assert.ok(reminder.includes(String(attendance.count)))
  assert.ok(reminder.includes(String(attendance.threshold)))
})

test('an LLM-less writer always falls back to the template', async () => {
  const templateOnly = trainingMessages(llmWriter(config.ollama, null))

  assert.equal(await templateOnly.announcement(training), templates.announcement(training))
  assert.equal(await templateOnly.trainerRequest(training), templates.trainerRequest(training))
  assert.equal(await templateOnly.attendanceReminder(training, attendance), templates.attendanceReminder(training, attendance))
})

test('a hanging LLM falls back to the template once the timeout passes', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const never = () => new Promise<never>(() => {})
    const hanging = trainingMessages(llmWriter(config.ollama, { chat: never, list: never }))

    const message = hanging.announcement(training)
    mock.timers.tick(LLM_TIMEOUT_MS)

    assert.equal(await message, templates.announcement(training))
  } finally {
    mock.timers.reset()
  }
})

const stPauli = { ...training, location: parseLocation('[St. Pauli (Halle 2)](https://maps.example/st-pauli?a=1&b=2)') }
const stPauliLink = '<a href="https://maps.example/st-pauli?a=1&amp;b=2">St. Pauli (Halle 2)</a>'

test('a location link with pattern characters is linked in the template announcement', () => {
  const message = templates.announcement(stPauli)
  assert.ok(message.includes(stPauliLink))
})

test('a location link with pattern characters is linked in the LLM announcement', async () => {
  reply.content = 'Training at St. Pauli (Halle 2) tomorrow, react 👍'
  const message = await generator.announcement(stPauli)
  assert.ok(message.includes(stPauliLink))
})

test('LLM text with markup characters reaches the announcement escaped and intact', async () => {
  reply.content = 'Sky_plastic time * <3 & [go'
  const message = await generator.announcement(training)
  assert.ok(message.includes('Sky_plastic time * &lt;3 &amp; [go'))
})

test('a location without a link is the plain name', () => {
  assert.deepEqual(parseLocation('Hall'), { name: 'Hall' })
})
