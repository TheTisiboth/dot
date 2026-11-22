import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatTime } from '../src/shared/formatters'
import { SeasonManager } from '../src/training/season'
import { SEASON_DATES, SUMMER_TRAINING, at } from './fixtures/dates'
import { HOUR_MS } from './helpers/clock'
import { testConfig } from './fixtures/config'

const config = testConfig()
const seasons = new SeasonManager(config)

test('the season switches exactly on each start date', () => {
  assert.equal(seasons.seasonOn(SEASON_DATES.lastWinterDay), 'winter')
  assert.equal(seasons.seasonOn(SEASON_DATES.summerStart), 'summer')
  assert.equal(seasons.seasonOn(SEASON_DATES.lastSummerDay), 'summer')
  assert.equal(seasons.seasonOn(SEASON_DATES.winterStart), 'winter')
})

test('winter spans the new year', () => {
  assert.equal(seasons.seasonOn(SEASON_DATES.newYearsEve), 'winter')
  assert.equal(seasons.seasonOn(SEASON_DATES.newYearsDay), 'winter')
  assert.deepEqual(seasons.seasonConfigOn(SEASON_DATES.newYearsDay).location, config.seasons.winter.location)
})

test('the seasons follow their start dates when winter starts in January', () => {
  const januaryWinter = new SeasonManager(testConfig({ WINTER_START_DATE: '1:10' }))

  assert.equal(seasons.seasonOn(at(2027, 1, 9)), 'winter')

  assert.equal(januaryWinter.seasonOn(at(2027, 1, 9)), 'summer')
  assert.equal(januaryWinter.seasonOn(at(2027, 1, 10)), 'winter')
  assert.equal(januaryWinter.seasonOn(at(2027, 5, 19)), 'winter')
  assert.equal(januaryWinter.seasonOn(at(2027, 5, 20)), 'summer')
  assert.equal(januaryWinter.seasonOn(at(2027, 12, 31)), 'summer')
})

test('the next training is the next practice of the current season', () => {
  const morning = new Date(SUMMER_TRAINING.at.getTime() - 9 * HOUR_MS)
  assert.deepEqual(seasons.nextTraining(morning).startsAt, SUMMER_TRAINING.at)
  // Strictly after: at its start time, a training is no longer the next one
  assert.deepEqual(seasons.nextTraining(SUMMER_TRAINING.at).startsAt, at(2027, 6, 13, 19, 0))
})

test('the next training crosses the new year', () => {
  assert.deepEqual(seasons.nextTraining(at(2026, 12, 31, 22)).startsAt, at(2027, 1, 2, 21, 0))
})

test('the next training across a season switch uses the new season weekdays', () => {
  // Tue 2027-05-18 after practice: winter would give Sat 22nd, but summer starts on the 20th
  const next = seasons.nextTraining(at(2027, 5, 18, 21))

  assert.deepEqual(next.startsAt, at(2027, 5, 23, 19, 0))
  assert.equal(next.season, 'summer')
  assert.deepEqual(next.location, config.seasons.summer.location)
})

test('the post is due only the day before a practice, at its time', () => {
  assert.equal(seasons.isAnnouncementDue(SUMMER_TRAINING.time, at(2027, 6, 8, 19, 30)), true)
  assert.equal(seasons.isAnnouncementDue({ hour: 19, minute: 0 }, at(2027, 6, 8, 19, 0)), false)
  assert.equal(seasons.isAnnouncementDue(SUMMER_TRAINING.time, at(2027, 6, 7, 19, 30)), false)
  assert.equal(seasons.isAnnouncementDue(SUMMER_TRAINING.time, at(2027, 6, 9, 19, 30)), false)
})

test('the post follows the season of tomorrow, not of today', () => {
  // Winter starts Tue 2026-09-15: today is summer, tomorrow a winter Tuesday
  assert.equal(seasons.isAnnouncementDue({ hour: 20, minute: 30 }, at(2026, 9, 14, 20, 30)), true)
  // Winter starts Wed 2027-09-15: a summer Wednesday, but winter has no Wednesday practice
  assert.equal(seasons.isAnnouncementDue(SUMMER_TRAINING.time, at(2027, 9, 14, 19, 30)), false)
})

test('every practice time of both seasons gets a check', () => {
  assert.deepEqual(new Set(seasons.getAllPracticeTimes().map(formatTime)), new Set(['20:30', '21:00', '19:00', '19:30']))
})

test('an exceptional training overrides location and time but keeps the date', () => {
  const exceptional = new SeasonManager(testConfig({ EXCEPTIONAL_LOCATION: 'Beach', EXCEPTIONAL_TIME: '18:00', EXCEPTIONAL_CANCELLED: 'true' }))
  const next = exceptional.nextTraining(at(2027, 6, 9, 10))

  assert.deepEqual(next.startsAt, at(2027, 6, 9, 18, 0))
  assert.equal(next.location.name, 'Beach')
  assert.equal(next.cancelled, true)
})

test('the training days of a season list each of its practice times', () => {
  const days = seasons.getTrainingDaysString('winter')
  for (const { time } of config.seasons.winter.practices) assert.ok(days.includes(formatTime(time)))
})

test('the next announcement is the one still ahead, at the configured time even when the training is moved', () => {
  const moved = new SeasonManager(testConfig({ EXCEPTIONAL_TIME: '18:00' }))

  const ahead = moved.nextAnnouncement(at(2027, 6, 8, 10))
  assert.deepEqual(ahead.announcesAt, at(2027, 6, 8, 19, 30))
  assert.deepEqual(ahead.training.startsAt, at(2027, 6, 9, 18, 0))

  const passed = moved.nextAnnouncement(at(2027, 6, 8, 20))
  assert.deepEqual(passed.announcesAt, at(2027, 6, 12, 19, 0))
  assert.deepEqual(passed.training.startsAt, at(2027, 6, 13, 18, 0))
})
