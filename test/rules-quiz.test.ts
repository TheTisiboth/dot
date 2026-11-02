import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { QUIZ_BATCHES } from '../src/data/rules-quiz'
import { type QuizDifficulty } from '../src/types'
import { ALL_MODES } from '../src/data/rules-quiz/modes'

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
    const options = [q.answer, ...q.wrong]
    assert.ok(q.question.length <= MAX_QUESTION, q.id)
    assert.ok(options.length >= 3 && options.length <= 4, q.id)
    assert.equal(new Set(options).size, options.length, `${q.id} has duplicate options`)
    options.forEach(option => assert.ok(option.length > 0 && option.length <= MAX_OPTION, `${q.id}: ${option}`))
    assert.ok(q.modes.length > 0, q.id)
    assert.ok(q.explanation.length > 0, q.id)
  })
})

test('rule refs are WFDF rule numbers', () => {
  questions.filter(q => q.ref).forEach(q => assert.match(q.ref as string, /^\d{1,2}(\.\d+)*$/, q.id))
  QUIZ_BATCHES.forEach(batch => assert.match(batch.source.url, /^https:\/\//))
})

test('images exist', () => {
  questions.filter(q => q.image).forEach(q => assert.ok(existsSync(q.image as string), `${q.id}: ${q.image}`))
})

test('every mode has questions at every difficulty', () => {
  const levels: QuizDifficulty[] = ['easy', 'medium', 'hard']
  ALL_MODES.forEach(mode => levels.forEach(level =>
    assert.ok(questions.some(q => q.modes.includes(mode) && q.difficulty === level), `${mode}/${level}`)
  ))
})
