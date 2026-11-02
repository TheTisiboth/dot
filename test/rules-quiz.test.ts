import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { QUIZ_BATCHES } from '../src/data/rules-quiz'
import { type QuizDifficulty, type QuizMode } from '../src/types'

// Telegram sendPoll limits
const MAX_QUESTION = 300
const MAX_OPTION = 100

const questions = QUIZ_BATCHES.flatMap(batch => batch.questions)

test('ids are unique and hashtag-safe', () => {
  const ids = questions.map(q => q.id)
  assert.equal(new Set(ids).size, ids.length)
  ids.forEach(id => assert.match(id, /^[a-z0-9_]+$/, id))
})

test('questions fit Telegram poll limits', () => {
  questions.forEach(q => {
    assert.ok(q.question.length <= MAX_QUESTION, q.id)
    assert.ok(q.options.length >= 3 && q.options.length <= 4, q.id)
    assert.equal(new Set(q.options).size, q.options.length, `${q.id} has duplicate options`)
    q.options.forEach(option => assert.ok(option.length <= MAX_OPTION, `${q.id}: ${option}`))
    assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length, q.id)
    assert.ok(q.modes.length > 0, q.id)
    assert.ok(q.explanation.length > 0, q.id)
  })
})

test('links point to their rule', () => {
  questions.filter(q => q.url).forEach(q => {
    assert.ok(q.ref, `${q.id} has a url but no ref`)
    assert.ok(q.url?.endsWith(`#${q.ref}`), q.id)
  })
  QUIZ_BATCHES.forEach(batch => assert.match(batch.source.url, /^https:\/\//))
})

test('images exist', () => {
  questions.filter(q => q.image).forEach(q => assert.ok(existsSync(q.image as string), `${q.id}: ${q.image}`))
})

test('every mode has questions at every difficulty', () => {
  const modes: QuizMode[] = ['outdoor', 'indoor']
  const levels: QuizDifficulty[] = ['easy', 'medium', 'hard']
  modes.forEach(mode => levels.forEach(level =>
    assert.ok(questions.some(q => q.modes.includes(mode) && q.difficulty === level), `${mode}/${level}`)
  ))
})
