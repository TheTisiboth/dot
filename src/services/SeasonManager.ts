import { config } from '../config'
import { type SeasonConfig, type SeasonType, type TrainingInfo, type PracticeDay } from '../types'
import { getEffectiveDate, createDateFromMonthDay } from '../utils/dateHelpers'
import { getDayName } from '../utils/formatters'

export class SeasonManager {
  private readonly seasons = config.seasons

  getCurrentSeason(date: Date = new Date()): SeasonType {
    date = getEffectiveDate(date)

    const winterStart = this.seasons.winter.startDate
    const summerStart = this.seasons.summer.startDate

    const currentYear = date.getFullYear()
    const winterStartDate = createDateFromMonthDay(
      winterStart.month,
      winterStart.day,
      currentYear
    )
    const summerStartDate = createDateFromMonthDay(
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
    date = getEffectiveDate(date)

    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.getCurrentSeasonConfig(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    return seasonConfig.practices.some(practice => practice.day === tomorrowDayOfWeek)
  }

  getPracticeForDay(date: Date = new Date()): PracticeDay {
    date = getEffectiveDate(date)

    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.getCurrentSeasonConfig(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    const practiceDay = seasonConfig.practices.find(practice => practice.day === tomorrowDayOfWeek)

      if (!practiceDay) {
          throw new Error(`No practice day found for day ${tomorrowDayOfWeek}`)
      }

    return practiceDay
  }

  getNextTrainingDate(date: Date = new Date()): Date {
    const seasonConfig = this.getCurrentSeasonConfig(date)
    const currentDay = date.getDay()

    let nextTrainingDate: Date | null = null

    for (const practice of seasonConfig.practices) {
      const [hours, minutes] = practice.time.split(':').map(Number)

      // Calculate days until this practice day
      const daysToAdd = (practice.day - currentDay + 7) % 7

      // Create the full datetime for this practice
      const candidateDate = new Date(date)
      candidateDate.setDate(date.getDate() + daysToAdd)
      candidateDate.setHours(hours, minutes, 0, 0)

      const hasPassed = candidateDate <= date

      // If this datetime has already passed, move to next week
      if (hasPassed) {
        candidateDate.setDate(candidateDate.getDate() + 7)
      }

      // Keep track of the earliest training
      if (nextTrainingDate === null || candidateDate < nextTrainingDate) {
        nextTrainingDate = candidateDate
      }
    }

    return nextTrainingDate || new Date(date)
  }

  getNextTrainingInfo(date: Date = new Date()): TrainingInfo {
    const nextDate = this.getNextTrainingDate(date)
    const seasonConfig = this.getCurrentSeasonConfig(nextDate)

    const nextPractice = seasonConfig.practices.find(practice => practice.day === nextDate.getDay())

    if (!nextPractice) {
      throw new Error(`No practice day found for day ${nextDate.getDay()}`)
    }

    return {
      date: nextDate,
      dayName: getDayName(nextDate.getDay()),
      location: seasonConfig.location,
      time: nextPractice.time,
      season: seasonConfig.season,
      practiceDay: nextPractice
    }
  }

  getTrainingDaysString(season?: SeasonType): string {
    const seasonConfig = season ?
      { season, ...this.seasons[season] } :
      this.getCurrentSeasonConfig()

    return seasonConfig.practices
      .map(practice => `${getDayName(practice.day)} at ${practice.time}`)
      .join(', ')
  }
}