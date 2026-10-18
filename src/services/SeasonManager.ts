import { config } from '../config'
import { type SeasonConfig, type SeasonType, type TrainingInfo, type PracticeDay } from '../types'
import { getEffectiveDate, createDateFromMonthDay, atTime, getThrowingTime } from '../utils/dateHelpers'
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

  /** Whether a training starts tomorrow at `time`: the post goes out exactly 24h before it. */
  shouldSendMessage(time: string, date: Date = new Date()): boolean {
    date = getEffectiveDate(date)

    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.getCurrentSeasonConfig(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    return seasonConfig.practices.some(practice => practice.day === tomorrowDayOfWeek && practice.time === time)
  }

  /** Practice times of every season, so a season switch never lands on a time with no check registered. */
  getAllPracticeTimes(): string[] {
    const practices = [...this.seasons.winter.practices, ...this.seasons.summer.practices]
    return [...new Set(practices.map(practice => practice.time))]
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

  /** Walks day by day so each candidate uses its own season's practices (season switches change the weekdays). */
  getNextTrainingDate(date: Date = new Date()): Date {
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(date)
      day.setDate(date.getDate() + offset)

      const candidates = this.getCurrentSeasonConfig(day).practices
        .filter(practice => practice.day === day.getDay())
        .map(practice => atTime(day, practice.time))
        .filter(candidate => candidate > date)
        .sort((a, b) => a.getTime() - b.getTime())

      if (candidates.length > 0) {
        return candidates[0]
      }
    }

    return new Date(date)
  }

  getNextTrainingInfo(date: Date = new Date()): TrainingInfo {
    const nextDate = this.getNextTrainingDate(date)
    const seasonConfig = this.getCurrentSeasonConfig(nextDate)

    const nextPractice = seasonConfig.practices.find(practice => practice.day === nextDate.getDay())

    if (!nextPractice) {
      throw new Error(`No practice day found for day ${nextDate.getDay()}`)
    }

    const exceptionalTraining = config.exceptionalTraining
    const time = exceptionalTraining.time || nextPractice.time

    return {
      date: nextDate,
      dayName: getDayName(nextDate.getDay()),
      location: exceptionalTraining.location || seasonConfig.location,
      time,
      throwingTime: getThrowingTime(time, seasonConfig.throwingMinutesBefore),
      season: seasonConfig.season,
      practiceDay: nextPractice,
      isCancelled: exceptionalTraining.isCancelled
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