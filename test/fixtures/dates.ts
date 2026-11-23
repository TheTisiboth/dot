// Seasons are the testConfig ones: winter from Sep 15 (Tue 20:30, Sat 21:00), summer from May 20 (Sun 19:00, Wed 19:30)

/** A local date, months counted from 1. */
export const at = (year: number, month: number, day: number, hours = 12, minutes = 0) =>
  new Date(year, month - 1, day, hours, minutes)

export const SEASON_DATES = {
  lastWinterDay: at(2027, 5, 19),
  summerStart: at(2027, 5, 20, 0, 0),
  lastSummerDay: at(2027, 9, 14, 23, 59),
  winterStart: at(2027, 9, 15, 0, 0),
  newYearsEve: at(2026, 12, 31),
  newYearsDay: at(2027, 1, 1)
}

/** Wed 2027-06-09, a summer practice. */
export const SUMMER_TRAINING = { at: at(2027, 6, 9, 19, 30), time: { hour: 19, minute: 30 } }

export const beforeTraining = (ms: number) => new Date(SUMMER_TRAINING.at.getTime() - ms)
