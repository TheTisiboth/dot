import './helpers/testEnv'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { config } from '../src/config'
import { SeasonManager } from '../src/services/SeasonManager'
import { SEASON_DATES, SUMMER_TRAINING, at } from './fixtures/dates'
import { HOUR_MS } from './helpers/clock'
import { restoreConfigAfterEach } from './helpers/config'

const seasons = new SeasonManager()

restoreConfigAfterEach()

test('the season switches exactly on each start date', () => {
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.lastWinterDay), 'winter')
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.summerStart), 'summer')
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.lastSummerDay), 'summer')
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.winterStart), 'winter')
})

test('winter spans the new year', () => {
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.newYearsEve), 'winter')
  assert.equal(seasons.getCurrentSeason(SEASON_DATES.newYearsDay), 'winter')
  assert.equal(seasons.getCurrentSeasonConfig(SEASON_DATES.newYearsDay).location, config.seasons.winter.location)
})

test('the next training is the next practice of the current season', () => {
  const morning = new Date(SUMMER_TRAINING.at.getTime() - 9 * HOUR_MS)
  assert.deepEqual(seasons.getNextTrainingDate(morning), SUMMER_TRAINING.at)
  // Strictly after: at its start time, a training is no longer the next one
  assert.deepEqual(seasons.getNextTrainingDate(SUMMER_TRAINING.at), at(2027, 6, 13, 19, 0))
})

test('the next training crosses the new year', () => {
  assert.deepEqual(seasons.getNextTrainingDate(at(2026, 12, 31, 22)), at(2027, 1, 2, 21, 0))
})

test('the next training across a season switch uses the new season weekdays', () => {
  // Tue 2027-05-18 after practice: winter would give Sat 22nd, but summer starts on the 20th
  const next = seasons.getNextTrainingInfo(at(2027, 5, 18, 21))

  assert.deepEqual(next.date, at(2027, 5, 23, 19, 0))
  assert.equal(next.season, 'summer')
  assert.equal(next.location, config.seasons.summer.location)
  assert.equal(next.time, '19:00')
})

test('the post is due only the day before a practice, at its time', () => {
  assert.equal(seasons.shouldSendMessage(SUMMER_TRAINING.time, at(2027, 6, 8, 19, 30)), true)
  assert.equal(seasons.shouldSendMessage('19:00', at(2027, 6, 8, 19, 0)), false)
  assert.equal(seasons.shouldSendMessage('19:30', at(2027, 6, 7, 19, 30)), false)
  assert.equal(seasons.shouldSendMessage('19:30', at(2027, 6, 9, 19, 30)), false)
})

test('the post follows the season of tomorrow, not of today', () => {
  // Winter starts Tue 2026-09-15: today is summer, tomorrow a winter Tuesday
  assert.equal(seasons.shouldSendMessage('20:30', at(2026, 9, 14, 20, 30)), true)
  // Winter starts Wed 2027-09-15: a summer Wednesday, but winter has no Wednesday practice
  assert.equal(seasons.shouldSendMessage('19:30', at(2027, 9, 14, 19, 30)), false)
})

test('every practice time of both seasons gets a check', () => {
  assert.deepEqual(new Set(seasons.getAllPracticeTimes()), new Set(['20:30', '21:00', '19:00', '19:30']))
})

test('an exceptional training overrides location and time but keeps the date', () => {
  config.exceptionalTraining = { location: 'Beach', time: '18:00', isCancelled: true }
  const next = seasons.getNextTrainingInfo(at(2027, 6, 9, 10))

  assert.deepEqual(next.date, SUMMER_TRAINING.at)
  assert.equal(next.location, 'Beach')
  assert.equal(next.time, '18:00')
  assert.equal(next.isCancelled, true)
})

test('the training days of a season list each of its practice times', () => {
  const days = seasons.getTrainingDaysString('winter')
  for (const { time } of config.seasons.winter.practices) assert.ok(days.includes(time))
})
