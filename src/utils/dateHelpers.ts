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

const MINUTES_PER_DAY = 24 * 60

export function getThrowingTime({ hour, minute }: TimeOfDay, minutesBefore: number): TimeOfDay | undefined {
  if (minutesBefore === 0) return undefined
  const minutes = (((hour * 60 + minute - minutesBefore) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return { hour: Math.floor(minutes / 60), minute: minutes % 60 }
}

export function hoursBefore(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

export function getDateBefore(dateConfig: DateConfig): DateConfig {
  const date = new Date(2024, dateConfig.month - 1, dateConfig.day)
  date.setDate(date.getDate() - 1)
  return { month: date.getMonth() + 1, day: date.getDate() }
}
