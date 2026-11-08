import { addDays, toHHmm, toISODate } from './dates'
import { lessonsOn } from './schedule'
import type { ISODate, Lesson, PackItem, Settings, Subject } from './types'

/** Nyckel för att jämföra packsaker: skiftlägesokänsligt och trimmat. */
export const itemKey = (text: string) => text.trim().toLowerCase()

export interface PackGroup {
  subject: Subject
  items: PackItem[]
}

/**
 * Packlista för en dag: ett ämne en gång även om det har flera lektioner, i lektionsordning.
 * Samma sak i flera ämnen visas bara under det första ämnet.
 */
export function packingFor(dayLessons: Lesson[], subjects: Subject[]): PackGroup[] {
  const byId = new Map(subjects.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const seenItems = new Set<string>()
  const groups: PackGroup[] = []
  for (const l of dayLessons) {
    if (seen.has(l.subjectId)) continue
    seen.add(l.subjectId)
    const subject = byId.get(l.subjectId)
    if (!subject) continue
    const items = subject.packItems.filter((i) => {
      const key = itemKey(i.text)
      if (seenItems.has(key)) return false
      seenItems.add(key)
      return true
    })
    if (items.length > 0) groups.push({ subject, items })
  }
  return groups
}

export interface PackingTarget {
  date: ISODate
  groups: PackGroup[]
}

/**
 * Vilken dag packlistan gäller: idag så länge dagens sista lektion inte är slut,
 * annars nästa dag med lektioner (inom två veckor).
 */
export function packingTarget(
  now: Date,
  lessons: Lesson[],
  subjects: Subject[],
  s: Pick<Settings, 'cycleLength' | 'cycleAnchor'>,
): PackingTarget | null {
  const today = toISODate(now)
  const todays = lessonsOn(today, lessons, s)
  const last = todays[todays.length - 1]
  if (last && toHHmm(now) < last.end) return { date: today, groups: packingFor(todays, subjects) }
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i)
    const day = lessonsOn(date, lessons, s)
    if (day.length > 0) return { date, groups: packingFor(day, subjects) }
  }
  return null
}
