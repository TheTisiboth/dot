import { config } from '../config'
import { type DateConfig } from '../types'

export function getEffectiveDate(date: Date): Date {
  if (config.testing.enabled && config.testing.overrideDate) {
    return new Date(config.testing.overrideDate)
  }
  return date
}

export function isValidDate(date: Date): boolean {
  return !isNaN(date.getTime())
}

export function parseTestDate(dateStr: string): Date {
  const date = new Date(dateStr)
  if (!isValidDate(date)) {
    throw new Error('Invalid date format')
  }
  return date
}

export function createDateFromMonthDay(month: number, day: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()
  return new Date(currentYear, month - 1, day)
}

export function getDateBefore(dateConfig: DateConfig): DateConfig {
  const date = new Date(2024, dateConfig.month - 1, dateConfig.day)
  date.setDate(date.getDate() - 1)
  return { month: date.getMonth() + 1, day: date.getDate() }
}
