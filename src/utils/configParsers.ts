import { type PracticeDay, type DateConfig } from '../types'

export function parseDate(envVar: string | undefined): DateConfig | undefined {
  if (!envVar) return undefined
  const [month, day] = envVar.split(':').map(num => parseInt(num))
  return { month, day }
}

export function parsePracticeDays(envVar: string | undefined): PracticeDay[] | undefined {
  if (!envVar) return undefined
  return envVar.split(',').map(dayTime => {
    const trimmed = dayTime.trim()
    const colonIndex = trimmed.indexOf(':')
    const day = parseInt(trimmed.substring(0, colonIndex))
    const time = trimmed.substring(colonIndex + 1)
    return { day, time }
  })
}
