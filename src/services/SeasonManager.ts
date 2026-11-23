import type { BotConfig } from '../config/env'
import { type SeasonConfig, type SeasonType, type TimeOfDay, type TrainingInfo } from '../types'
import { createDateFromMonthDay, atTime, getThrowingTime } from '../utils/dateHelpers'
import { formatTime, getDayName } from '../utils/formatters'

export class SeasonManager {
  readonly seasons: BotConfig['seasons']
  private readonly exceptionalTraining: BotConfig['exceptionalTraining']

  constructor({ seasons, exceptionalTraining }: Pick<BotConfig, 'seasons' | 'exceptionalTraining'>) {
    this.seasons = seasons
    this.exceptionalTraining = exceptionalTraining
  }

  seasonOn(date: Date = new Date()): SeasonType {
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

    const winterStarted = date >= winterStartDate
    const summerStarted = date >= summerStartDate
    // Both or neither started this year: the later start in the year is the current one (it wraps over new year)
    if (winterStarted === summerStarted) return winterStartDate > summerStartDate ? 'winter' : 'summer'
    return winterStarted ? 'winter' : 'summer'
  }

  seasonConfigOn(date: Date = new Date()): SeasonConfig {
    const season = this.seasonOn(date)
    return {
      season,
      ...this.seasons[season]
    }
  }

  /** Whether a training starts tomorrow at `time`: the post goes out exactly 24h before it. */
  isAnnouncementDue(time: TimeOfDay, date: Date = new Date()): boolean {
    const tomorrow = new Date(date)
    tomorrow.setDate(date.getDate() + 1)

    const seasonConfig = this.seasonConfigOn(tomorrow)
    const tomorrowDayOfWeek = tomorrow.getDay()

    return seasonConfig.practices.some(practice => practice.day === tomorrowDayOfWeek && formatTime(practice.time) === formatTime(time))
  }

  /** Practice times of every season, so a season switch never lands on a time with no check registered. */
  getAllPracticeTimes(): TimeOfDay[] {
    const practices = [...this.seasons.winter.practices, ...this.seasons.summer.practices]
    return [...new Map(practices.map(({ time }) => [formatTime(time), time])).values()]
  }

  /** Walks day by day so each candidate uses its own season's practices (season switches change the weekdays). */
  getNextTrainingDate(date: Date = new Date()): Date {
    for (let offset = 0; offset < 14; offset++) {
      const day = new Date(date)
      day.setDate(date.getDate() + offset)

      const candidates = this.seasonConfigOn(day).practices
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
    const seasonConfig = this.seasonConfigOn(nextDate)

    const nextPractice = seasonConfig.practices.find(practice => practice.day === nextDate.getDay())

    if (!nextPractice) {
      throw new Error(`No practice day found for day ${nextDate.getDay()}`)
    }

    const { exceptionalTraining } = this
    const time = exceptionalTraining.time ?? nextPractice.time

    return {
      date: nextDate,
      location: exceptionalTraining.location ?? seasonConfig.location,
      time,
      throwingTime: getThrowingTime(time, seasonConfig.throwingMinutesBefore),
      season: seasonConfig.season,
      practiceDay: nextPractice,
      isCancelled: exceptionalTraining.isCancelled
    }
  }

  getTrainingDaysString(season?: SeasonType): string {
    const seasonConfig = season
      ? { season, ...this.seasons[season] }
      : this.seasonConfigOn()

    return seasonConfig.practices
      .map(practice => `${getDayName(practice.day)} at ${formatTime(practice.time)}`)
      .join(', ')
  }
}
