import { type PracticeDay, type DateConfig, type TrainingLocation } from '../types'

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatDate(date: Date): string {
  return `${MONTH_NAMES_SHORT[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

export function formatDateShort(dateConfig: DateConfig): string {
  return `${MONTH_NAMES_SHORT[dateConfig.month - 1]} ${dateConfig.day}`
}

export function getDayName(dayIndex: number): string {
  return DAY_NAMES[dayIndex]
}

export function formatPracticeDays(practices: PracticeDay[]): string {
  return practices
    .map(p => `   • ${DAY_NAMES[p.day]}s at ${p.time}`)
    .join('\n')
}

export function formatStartTime(time: string, throwingTime?: string): string {
  return throwingTime
    ? `with throwing at ${throwingTime} and training starting at ${time}`
    : `starting at ${time}`
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

const pad = (n: number): string => String(n).padStart(2, '0')

export const formatLogDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const formatLogDateTime = (date: Date): string => `${formatLogDate(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}`

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, char => HTML_ESCAPES[char])
}

export const link = (url: string, text: string): string => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`

/** The location as HTML: linked when it has a URL. */
export const locationLink = ({ name, url }: TrainingLocation): string => url ? link(url, name) : escapeHtml(name)
