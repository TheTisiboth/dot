import { type BotConfig, type TrainingLocation } from '../config/env'
import { EMOJIS } from '../shared/emojis'
import { type DateConfig, type TimeOfDay, createDateFromMonthDay, atTime, getDateBefore, minutesBefore } from '../shared/time'
import { capitalize, formatClock, formatDateShort, formatTime, getDayName, locationLink } from '../shared/formatters'

export type SeasonType = 'winter' | 'summer'

type SeasonSettings = BotConfig['seasons'][SeasonType]
type SeasonConfig = SeasonSettings & { season: SeasonType }
type PracticeDay = SeasonSettings['practices'][number]

/** One practice as the team sees it: exceptional overrides applied, season rules resolved. */
export interface Training {
  startsAt: Date;
  throwingAt?: Date;
  location: TrainingLocation;
  season: SeasonType;
  minAttendance: number;
  keyRequestEnabled: boolean;
  cancelled: boolean;
}

/** A practice at its configured time, before any exceptional override. */
interface Practice {
  at: Date;
  seasonConfig: SeasonConfig;
}

const SEARCH_DAYS = 14

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date)
  result.setDate(date.getDate() + days)
  return result
}

export class SeasonManager {
  private readonly seasons: BotConfig['seasons']
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

  /** The training whose configured start is `at`, if any: what the cron tick 24h before announces. */
  trainingStartingAt(at: Date): Training | undefined {
    const seasonConfig = this.seasonConfigOn(at)
    const isPractice = seasonConfig.practices.some(({ day, time }) => day === at.getDay() && formatTime(time) === formatClock(at))
    return isPractice ? this.toTraining({ at, seasonConfig }) : undefined
  }

  /** Practice times of every season, so a season switch never lands on a time with no check registered. */
  getAllPracticeTimes(): TimeOfDay[] {
    const practices = [...this.seasons.winter.practices, ...this.seasons.summer.practices]
    return [...new Map(practices.map(({ time }) => [formatTime(time), time])).values()]
  }

  /** Walks day by day so each candidate uses its own season's practices (season switches change the weekdays). */
  private nextPractice(after: Date): Practice {
    for (let offset = 0; offset < SEARCH_DAYS; offset++) {
      const day = addDays(after, offset)
      const seasonConfig = this.seasonConfigOn(day)
      const practice = seasonConfig.practices.find(({ day: weekday }) => weekday === day.getDay())
      const at = practice && atTime(day, practice.time)
      if (at && at > after) return { at, seasonConfig }
    }
    throw new Error(`No practice within ${SEARCH_DAYS} days after ${after.toISOString()}`)
  }

  private toTraining({ at, seasonConfig }: Practice): Training {
    const { time, location, isCancelled } = this.exceptionalTraining
    const startsAt = time ? atTime(at, time) : at
    const { throwingMinutesBefore } = seasonConfig

    return {
      startsAt,
      throwingAt: throwingMinutesBefore === 0 ? undefined : minutesBefore(startsAt, throwingMinutesBefore),
      location: location ?? seasonConfig.location,
      season: seasonConfig.season,
      minAttendance: seasonConfig.minAttendance,
      keyRequestEnabled: seasonConfig.keyRequestEnabled,
      cancelled: isCancelled ?? false
    }
  }

  /** The next training after `after`: which one is picked by its configured time, which EXCEPTIONAL_TIME does not move. */
  nextTraining(after: Date = new Date()): Training {
    return this.toTraining(this.nextPractice(after))
  }

  /** The next training whose announcement is still ahead. The cron fires at the practice's configured time, which EXCEPTIONAL_TIME does not move. */
  nextAnnouncement(now: Date = new Date()): { announcesAt: Date; training: Training } {
    let practice = this.nextPractice(now)
    if (addDays(practice.at, -1) <= now) practice = this.nextPractice(addDays(practice.at, 1))
    return { announcesAt: addDays(practice.at, -1), training: this.toTraining(practice) }
  }

  getTrainingDaysString(season?: SeasonType): string {
    const seasonConfig = season
      ? { season, ...this.seasons[season] }
      : this.seasonConfigOn()

    return seasonConfig.practices
      .map(practice => `${getDayName(practice.day)} at ${formatTime(practice.time)}`)
      .join(', ')
  }

  /** The /info schedule: every season with its dates, practices and location. */
  scheduleText(): string {
    const { winter, summer } = this.seasons
    return `${EMOJIS.CALENDAR} Training Schedule

${seasonText('winter', winter, summer.startDate)}

${seasonText('summer', summer, winter.startDate)}`
  }
}

const formatPracticeDays = (practices: PracticeDay[]): string => practices
  .map(p => `   • ${getDayName(p.day)}s at ${formatTime(p.time)}`)
  .join('\n')

const seasonText = (season: SeasonType, seasonConfig: SeasonSettings, nextSeasonStart: DateConfig): string => {
  const emoji = season === 'winter' ? EMOJIS.WINTER : EMOJIS.SUMMER
  const start = formatDateShort(seasonConfig.startDate)
  const end = formatDateShort(getDateBefore(nextSeasonStart))

  return `${emoji} ${capitalize(season)} (${start} - ${end}):
${formatPracticeDays(seasonConfig.practices)}
   ${EMOJIS.LOCATION} ${locationLink(seasonConfig.location)}`
}
