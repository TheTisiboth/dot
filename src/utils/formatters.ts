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
