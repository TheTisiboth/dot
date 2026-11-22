import { type DateConfig, type TimeOfDay } from './time'

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

const twoDigits = (value: number) => String(value).padStart(2, '0')

/** HH:MM */
export const formatTime = ({ hour, minute }: TimeOfDay): string => `${twoDigits(hour)}:${twoDigits(minute)}`

/** HH:MM of a date */
export const formatClock = (date: Date): string => formatTime({ hour: date.getHours(), minute: date.getMinutes() })

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatDateLocale(date: Date): string {
  // Format as DD/MM/YYYY using French locale
  return date.toLocaleDateString('fr-FR')
}

export function formatDateTimeLocale(date: Date): string {
  // Format as DD/MM/YYYY HH:MM using French locale
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, char => HTML_ESCAPES[char])
}

export const link = (url: string, text: string): string => `<a href="${escapeHtml(url)}">${escapeHtml(text)}</a>`

/** The location as HTML: linked when it has a URL. */
export const locationLink = ({ name, url }: { name: string; url?: string }): string => url ? link(url, name) : escapeHtml(name)
