import { type QuizBatch, type QuizQuestion } from '../types'
import { atTime } from '../utils/dateHelpers'
import { escapeHtml } from '../utils/formatters'

export interface PollResult {
  options: Array<{ text: string; voter_count: number }>;
  total_voter_count: number;
}

const link = (url: string, text: string): string => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`

/** The poll goes out the day before training; the answer follows on training day. */
export function answerTimeFor(postedAt: Date, answerTime: string): Date {
  const trainingDay = new Date(postedAt)
  trainingDay.setDate(trainingDay.getDate() + 1)
  return atTime(trainingDay, answerTime)
}

/** Without a poll result (it was already closed), the stats line is left out. */
export function answerStats(answer: string, poll?: PollResult): string | undefined {
  if (!poll) return undefined
  if (poll.total_voter_count === 0) return '📊 No votes'

  const right = poll.options.find(option => option.text === answer)?.voter_count ?? 0
  const share = Math.round((right / poll.total_voter_count) * 100)
  return `📊 ${right}/${poll.total_voter_count} got it right (${share}%)`
}

/** The rule's page on urules.org, opened on the rule itself. */
export function ruleUrl(ref: string): string {
  return `https://urules.org/ch${ref.split('.')[0]}.html#${ref}`
}

/** The rule on urules.org when the question has one, else the source document. */
export function ruleLink(question: QuizQuestion, source: QuizBatch['source']): string {
  if (!question.ref) return `📖 ${link(source.url, source.title)}`
  return `📖 ${link(ruleUrl(question.ref), `Rule ${question.ref}`)} · ${link(source.url, source.title)}`
}

/** HTML: explanations contain characters that Markdown would read as formatting. */
export function buildAnswer(question: QuizQuestion, source: QuizBatch['source'], poll?: PollResult): string {
  return [
    `<b>Answer</b>\n✅ ${escapeHtml(question.answer)}`,
    question.explanation && escapeHtml(question.explanation),
    [answerStats(question.answer, poll), ruleLink(question, source)].filter(Boolean).join('\n')
  ].filter(Boolean).join('\n\n')
}
