import { type PracticeDay, type DateConfig } from '../types'

export function parsePracticeDays(envVar: string, defaultDays: PracticeDay[]): PracticeDay[] {
  if (!envVar) return defaultDays

  try {
    return envVar.split(',').map(dayTime => {
      const [day] = dayTime.trim().split(':')
      const timeStr = dayTime.trim().substring(dayTime.indexOf(':') + 1)
      return {
        day: parseInt(day),
        time: timeStr
      }
    })
  } catch (error) {
    console.warn(`Invalid practice days format: ${envVar}. Using defaults.`)
    return defaultDays
  }
}

export function parseDate(envVar: string, defaultMonth: number, defaultDay: number): DateConfig {
  if (!envVar) return { month: defaultMonth, day: defaultDay }

  try {
    const [month, day] = envVar.split(':').map(num => parseInt(num))
    return { month, day }
  } catch (error) {
    console.warn(`Invalid date format: ${envVar}. Using defaults.`)
    return { month: defaultMonth, day: defaultDay }
  }
}
