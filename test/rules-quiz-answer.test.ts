import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { answerTimeFor, buildAnswer, ruleLink } from '../src/services/quizAnswer'
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

test('answer time: the delay after the poll', () => {
  assert.deepEqual(answerTimeFor(new Date(2026, 10, 3, 20, 30), 60), new Date(2026, 10, 3, 21, 30))
})

test('answer time: across midnight', () => {
  assert.deepEqual(answerTimeFor(new Date(2026, 10, 30, 23, 30), 60), new Date(2026, 11, 1, 0, 30))
})

test('link: the rule on urules.org, plus the source', () => {
  const text = ruleLink(question({ ref: '9.5.1' }), source)
  assert.ok(text.includes('<a href="https://urules.org/ch9.html#9.5.1">Rule 9.5.1</a>'), text)
  assert.ok(text.includes(`<a href="${source.url}">${source.title}</a>`), text)
})

test('link: the source document when there is no rule ref', () => {
  assert.equal(ruleLink(question(), source), `📖 <a href="${source.url}">${source.title}</a>`)
})

test('answer: title, then answer, explanation and link behind a spoiler, with HTML escaped', () => {
  const text = buildAnswer(question({ answer: 'In <bounds>', explanation: 'A & B' }), source)
  assert.ok(text.startsWith('<b>Answer</b>\n<tg-spoiler>✅ In &lt;bounds&gt;\n\nA &amp; B\n\n📖 '), text)
  assert.ok(text.endsWith('</a></tg-spoiler>'), text)
})

test('answer: no explanation, no empty paragraph', () => {
  assert.ok(buildAnswer(question({ explanation: undefined }), source).startsWith('<b>Answer</b>\n<tg-spoiler>✅ Turnover\n\n📖 '))
})
