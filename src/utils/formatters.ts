import { type PracticeDay, type DateConfig } from '../types'

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

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function extractLocationName(location: string): string {
  // Extract name from markdown format [Name](url)
  const match = location.match(/^\[([^\]]+)\]/)
  return match ? match[1] : location
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
