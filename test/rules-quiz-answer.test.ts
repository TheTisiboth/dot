import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerStats, answerTimeFor, buildAnswer, ruleLink } from '../src/services/quizAnswer'
import { type QuizQuestion } from '../src/types'

const source = { title: 'WFDF Rules of Ultimate 2025-2028 (CC BY 4.0)', url: 'https://rules.wfdf.sport/rules.pdf' }

const question = (fields: Partial<QuizQuestion> = {}): QuizQuestion => ({
  id: 'r9_01',
  difficulty: 'medium',
  modes: ['outdoor', 'indoor'],
  question: 'Q?',
  answer: 'Turnover',
  wrong: ['Foul', 'Pick'],
  explanation: 'The disc touched the ground.',
  ...fields
})

const poll = (votes: Record<string, number>) => ({
  options: Object.entries(votes).map(([text, voter_count]) => ({ text, voter_count })),
  total_voter_count: Object.values(votes).reduce((sum, n) => sum + n, 0)
})

test('answer time: the day after the poll, at the answer time', () => {
  const answerAt = answerTimeFor(new Date(2026, 10, 3, 20, 30), '22:00')
  assert.deepEqual(answerAt, new Date(2026, 10, 4, 22, 0))
})

test('answer time: across a month end', () => {
  assert.deepEqual(answerTimeFor(new Date(2026, 10, 30, 19, 0), '22:00'), new Date(2026, 11, 1, 22, 0))
})

test('stats: share of right answers, whatever the option order', () => {
  assert.equal(answerStats('Turnover', poll({ Foul: 2, Turnover: 3, Pick: 2 })), '📊 3/7 got it right (43%)')
})

test('stats: no votes, and no poll result', () => {
  assert.equal(answerStats('Turnover', poll({ Foul: 0, Turnover: 0 })), '📊 No votes')
  assert.equal(answerStats('Turnover'), undefined)
})

test('link: the rule on urules.org, plus the source', () => {
  const text = ruleLink(question({ ref: '9.5.1' }), source)
  assert.ok(text.includes('<a href="https://www.urules.org/ch9.html#9.5.1">Rule 9.5.1</a>'), text)
  assert.ok(text.includes(`<a href="${source.url}">${source.title}</a>`), text)
})

test('link: the source document when there is no rule ref', () => {
  assert.equal(ruleLink(question(), source), `📖 <a href="${source.url}">${source.title}</a>`)
})

test('answer: answer, explanation, stats and link, with HTML escaped', () => {
  const text = buildAnswer(question({ answer: 'In <bounds>', explanation: 'A & B' }), source, poll({ 'In <bounds>': 1 }))
  assert.ok(text.startsWith('<b>Answer</b>\n✅ In &lt;bounds&gt;\n\nA &amp; B\n\n📊 1/1 got it right (100%)\n📖 '), text)
})

test('answer: without poll result, no stats line', () => {
  assert.ok(!buildAnswer(question(), source).includes('📊'))
})

test('answer: no explanation, no empty paragraph', () => {
  assert.ok(buildAnswer(question({ explanation: undefined }), source).startsWith('<b>Answer</b>\n✅ Turnover\n\n📖 '))
})
