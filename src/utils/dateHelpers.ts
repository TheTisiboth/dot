import { config } from '../config'
import { Formatters } from './formatters'
import { type TrainingInfo, type SeasonType, type DateConfig } from '../types'

export class DateHelpers {
  static getEffectiveDate(date: Date): Date {
    if (config.testing.enabled && config.testing.overrideDate) {
      return new Date(config.testing.overrideDate)
    }
    return date
  }

  static isValidDate(date: Date): boolean {
    return !isNaN(date.getTime())
  }

  static parseTestDate(dateStr: string): Date {
    const date = new Date(dateStr)
    if (!this.isValidDate(date)) {
      throw new Error('Invalid date format')
    }
    return date
  }

  static createDateFromMonthDay(month: number, day: number, year?: number): Date {
    const currentYear = year || new Date().getFullYear()
    return new Date(currentYear, month - 1, day)
  }

  static getDateBefore(dateConfig: DateConfig): DateConfig {
    const date = new Date(2024, dateConfig.month - 1, dateConfig.day)
    date.setDate(date.getDate() - 1)
    return { month: date.getMonth() + 1, day: date.getDate() }
  }

  static Glo(
    date: Date,
    location: string,
    time: string,
    season: SeasonType
  ): TrainingInfo {
    return {
      date,
      dayName: Formatters.getDayName(date.getDay()),
      location,
      time,
      season
    }
  }
}