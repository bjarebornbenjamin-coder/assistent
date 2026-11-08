import { addDays, toHHmm, toISODate } from './dates'
import { lessonsOn } from './schedule'
import type { ISODate, Lesson, PackItem, Settings, Subject } from './types'

export interface PackGroup {
  subject: Subject
  items: PackItem[]
}

/** Packlista för en dag: ett ämne en gång även om det har flera lektioner, i lektionsordning. */
export function packingFor(dayLessons: Lesson[], subjects: Subject[]): PackGroup[] {
  const byId = new Map(subjects.map((s) => [s.id, s]))
  const seen = new Set<string>()
  const groups: PackGroup[] = []
  for (const l of dayLessons) {
    if (seen.has(l.subjectId)) continue
    seen.add(l.subjectId)
    const subject = byId.get(l.subjectId)
    if (subject && subject.packItems.length > 0) groups.push({ subject, items: subject.packItems })
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
