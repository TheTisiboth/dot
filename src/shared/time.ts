export interface TimeOfDay {
  hour: number;
  minute: number;
}

export interface DateConfig {
  month: number;
  day: number;
}

export function createDateFromMonthDay(month: number, day: number, year?: number): Date {
  const currentYear = year || new Date().getFullYear()
  return new Date(currentYear, month - 1, day)
}

export function atTime(date: Date, { hour, minute }: TimeOfDay): Date {
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

/** Wall-clock minutes, like the configured times. */
export function minutesBefore(date: Date, minutes: number): Date {
  const result = new Date(date)
  result.setMinutes(date.getMinutes() - minutes)
  return result
}

export function hoursBefore(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

/** The day before the next occurrence of `dateConfig` after `now`. */
export function getDateBefore({ month, day }: DateConfig, now: Date): DateConfig {
  const thisYear = new Date(now.getFullYear(), month - 1, day)
  const next = thisYear > now ? thisYear : new Date(now.getFullYear() + 1, month - 1, day)
  const before = new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1)
  return { month: before.getMonth() + 1, day: before.getDate() }
}

/** Runs `fn` at `at`, or at once when `at` already passed (catch-up after a restart). */
export const armAt = (at: Date, fn: () => void): NodeJS.Timeout => setTimeout(fn, Math.max(0, at.getTime() - Date.now()))
