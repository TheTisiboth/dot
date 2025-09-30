import { config } from '../config'
import { type SeasonConfig, type SeasonType, type TrainingInfo } from '../types'
import { DateHelpers } from '../utils/dateHelpers'
import { Formatters } from '../utils/formatters'

export class SeasonManager {
  private readonly seasons = config.seasons

  getCurrentSeason(date: Date = new Date()): SeasonType {
    date = DateHelpers.getEffectiveDate(date)

    const winterStart = this.seasons.winter.startDate
    const summerStart = this.seasons.summer.startDate

    const currentYear = date.getFullYear()
    const winterStartDate = DateHelpers.createDateFromMonthDay(
      winterStart.month,
      winterStart.day,
      currentYear
    )
    const summerStartDate = DateHelpers.createDateFromMonthDay(
      summerStart.month,
      summerStart.day,
      currentYear
    )

    if (date >= winterStartDate) {
      return 'winter'
    }

    if (date < summerStartDate) {
      return 'winter'
    }

    return 'summer'
  }

  getCurrentSeasonConfig(date: Date = new Date()): SeasonConfig {
    const season = this.getCurrentSeason(date)
    return {
      season,
      ...this.seasons[season]
    }
  }

  shouldSendMessage(date: Date = new Date()): boolean {
    date = DateHelpers.getEffectiveDate(date)

    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.getCurrentSeasonConfig(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    return seasonConfig.practices.some(practice => practice.day === tomorrowDayOfWeek)
  }

  getPracticeForDay(date: Date = new Date()) {
    date = DateHelpers.getEffectiveDate(date)

    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.getCurrentSeasonConfig(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    return seasonConfig.practices.find(practice => practice.day === tomorrowDayOfWeek)
  }

  getNextTrainingDate(date: Date = new Date()): Date {
    const seasonConfig = this.getCurrentSeasonConfig(date)
    const currentDay = date.getDay()

    let daysUntilNext: number | null = null

    for (const practice of seasonConfig.practices) {
      const daysToAdd = (practice.day - currentDay + 7) % 7
      if (daysToAdd === 0) {
        daysUntilNext = 1
        break
      }
      if (daysUntilNext === null || daysToAdd < daysUntilNext) {
        daysUntilNext = daysToAdd
      }
    }

    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + (daysUntilNext || 0))

    return nextDate
  }

  getNextTrainingInfo(date: Date = new Date()): TrainingInfo {
    const nextDate = this.getNextTrainingDate(date)
    const seasonConfig = this.getCurrentSeasonConfig(nextDate)

    const nextPractice = seasonConfig.practices.find(practice => practice.day === nextDate.getDay())
    const location = nextPractice?.location || seasonConfig.location
    const time = nextPractice?.time || seasonConfig.practices[0]?.time || '20:00'

    const trainingInfo = DateHelpers.createTrainingInfo(nextDate, location, time, seasonConfig.season)

    if (nextPractice) {
      trainingInfo.practiceDay = nextPractice
    }

    return trainingInfo
  }

  getTrainingDaysString(season?: SeasonType): string {
    const seasonConfig = season ?
      { season, ...this.seasons[season] } :
      this.getCurrentSeasonConfig()

    return seasonConfig.practices
      .map(practice => `${Formatters.getDayName(practice.day)} at ${practice.time}`)
      .join(', ')
  }
}