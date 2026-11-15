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

const LOCATION_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/

/** `[Name](url)` links the name; any other text is the name alone. */
export function parseLocation(raw: string): { name: string; url?: string } {
  const [, name, url] = LOCATION_LINK.exec(raw) ?? []
  return name ? { name, url } : { name: raw }
}
