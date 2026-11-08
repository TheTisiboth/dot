import { type QuizBatch, type QuizQuestion } from '../types'
import { escapeHtml } from '../utils/formatters'

const link = (url: string, text: string): string => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`

/** The answer follows the poll after a delay, so early voters get to think before it shows up. */
export function answerTimeFor(postedAt: Date, delayMinutes: number): Date {
  return new Date(postedAt.getTime() + delayMinutes * 60_000)
}

/** The rule's page on urules.org, opened on the rule itself. */
const ruleUrl = (ref: string): string => `https://urules.org/ch${ref.split('.')[0]}.html#${ref}`

/** The rule on urules.org when the question has one, else the source document. */
export function ruleLink(question: QuizQuestion, source: QuizBatch['source']): string {
  if (!question.ref) return `📖 ${link(source.url, source.title)}`
  return `📖 ${link(ruleUrl(question.ref), `Rule ${question.ref}`)} · ${link(source.url, source.title)}`
}

/**
 * HTML: explanations contain characters that Markdown would read as formatting.
 * Everything but the title is a spoiler, so whoever has not voted yet is not shown the answer.
 */
export function buildAnswer(question: QuizQuestion, source: QuizBatch['source']): string {
  const body = [
    `✅ ${escapeHtml(question.answer)}`,
    question.explanation && escapeHtml(question.explanation),
    ruleLink(question, source)
  ].filter(Boolean).join('\n\n')

  return `<b>Answer</b>\n<tg-spoiler>${body}</tg-spoiler>`
}
