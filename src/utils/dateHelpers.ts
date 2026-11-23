import { type DateConfig, type TimeOfDay } from '../types'

export function createDateFromMonthDay(month: number, day: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()
  return new Date(currentYear, month - 1, day)
}

export function atTime(date: Date, { hour, minute }: TimeOfDay): Date {
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

/** Wall-clock minutes, like the configured times. */
export function minutesBefore(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(date.getMinutes() - minutes)
  return result
}

export function hoursBefore(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

export function getDateBefore(dateConfig: DateConfig): DateConfig {
  const date = new Date(2024, dateConfig.month - 1, dateConfig.day)
  date.setDate(date.getDate() - 1)
  return { month: date.getMonth() + 1, day: date.getDate() }
}
