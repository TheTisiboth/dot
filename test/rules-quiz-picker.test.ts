import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuizPost, pickQuestion } from '../src/services/quizPicker'
import { parseQuizTag, quizTag } from '../src/utils/quizTag'
import { QUIZ_QUESTIONS } from '../src/data/rules-quiz'
import { type QuizDifficulty, type QuizMode, type QuizQuestion } from '../src/types'

const q = (id: string, difficulty: QuizDifficulty, modes: QuizMode[] = ['outdoor', 'indoor'], question = 'Q?'): QuizQuestion =>
  ({ id, difficulty, modes, question, answer: 'yes', wrong: ['no', 'maybe'], explanation: 'because' })

const bank = [q('e1', 'easy'), q('e2', 'easy'), q('m1', 'medium'), q('h1', 'hard'), q('out', 'hard', ['outdoor'])]

const pickAll = (mode: QuizMode, count: number, random = Math.random): string[] => {
  const asked: string[] = []
  for (let i = 0; i < count; i++) asked.unshift(pickQuestion(bank, mode, asked, random).id)
  return asked.reverse()
}

test('no repeats within a round, then a new round', () => {
  const picks = pickAll('indoor', 8)
  assert.equal(new Set(picks.slice(0, 4)).size, 4)
  assert.equal(new Set(picks.slice(4, 8)).size, 4)
})

test('mode filter', () => {
  assert.ok(!pickAll('indoor', 12).includes('out'))
  assert.ok(pickAll('outdoor', 5).includes('out'))
})

test('alternates levels while it can', () => {
  for (let run = 0; run < 50; run++) {
    const levels = pickAll('indoor', 2).map(id => bank.find(b => b.id === id)?.difficulty)
    assert.notEqual(levels[0], levels[1])
  }
})

test('falls back to the same level when it is the only one left', () => {
  // Only e2 is unasked; the previous one was easy too
  assert.equal(pickQuestion(bank, 'indoor', ['e1', 'h1', 'm1']).id, 'e2')
})

test('ignores ids no longer in the bank', () => {
  const picked = pickQuestion(bank, 'indoor', ['removed', 'e1'])
  assert.ok(['e2', 'm1', 'h1'].includes(picked.id), picked.id)
})

test('hidden tag round-trips every id and stays invisible', () => {
  QUIZ_QUESTIONS.forEach(({ id }) => {
    assert.equal(parseQuizTag(`text${quizTag(id)}\n\nmore`), id)
    assert.match(quizTag(id), /^[\u2063\u200B\u200C\u200D\u2060]+$/u)
  })
  assert.equal(parseQuizTag('no tag here'), undefined)
})

test('post: hidden-tagged header, answer once among shuffled options', () => {
  const post = buildQuizPost(q('sig_01', 'medium'))
  assert.equal(post.poll, `🟡 Medium${quizTag('sig_01')}\n\nQ?`)
  assert.equal(parseQuizTag(post.poll), 'sig_01')
  assert.equal(post.intro, undefined)
  assert.deepEqual([...post.options].sort(), ['maybe', 'no', 'yes'])
})

test('post: mode shown only for mode-specific questions', () => {
  assert.ok(buildQuizPost(q('o', 'hard', ['outdoor'])).poll.startsWith('🔴 Hard · 🌳 Outdoor'))
  assert.ok(buildQuizPost(q('i', 'easy', ['indoor'])).poll.startsWith('🟢 Easy · 🏢 Indoor'))
  assert.ok(!buildQuizPost(q('a', 'easy')).poll.includes('·'))
})

test('post: long question goes in an intro message', () => {
  const post = buildQuizPost(q('long', 'hard', ['outdoor'], 'x'.repeat(290)))
  assert.ok(post.intro?.endsWith('x'.repeat(290)))
  assert.equal(parseQuizTag(post.poll), 'long')
  assert.ok(post.poll.length <= 300)
})
