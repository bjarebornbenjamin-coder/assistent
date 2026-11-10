import { addDays, toHHmm, toISODate } from './dates'
import { lessonsOn } from './schedule'
import { eventsOn } from './calendar'
import type { CalendarEvent, ISODate, Lesson, PackItem, Settings, Subject } from './types'

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

export interface EventPack {
  event: CalendarEvent
  items: string[]
}

/** Händelsernas packlistor för en dag. Sådant som redan står i ämnenas packlistor (`skip`) visas inte igen. */
export function eventPackingFor(date: ISODate, events: CalendarEvent[], skip: PackGroup[] = []): EventPack[] {
  const seen = new Set(skip.flatMap((g) => g.items.map((i) => itemKey(i.text))))
  const out: EventPack[] = []
  for (const event of eventsOn(date, events)) {
    const items = (event.packItems ?? []).filter((t) => {
      const key = itemKey(t)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (items.length > 0) out.push({ event, items })
  }
  return out
}

/** Allt att ta med en dag, i ordning: ämnen först, sedan händelser. Små bokstäver först i varje sak är upp till anroparen. */
export function allPackItems(date: ISODate, dayLessons: Lesson[], subjects: Subject[], events: CalendarEvent[]): string[] {
  const groups = packingFor(dayLessons, subjects)
  return [...groups.flatMap((g) => g.items.map((i) => i.text)), ...eventPackingFor(date, events, groups).flatMap((e) => e.items)]
}

export interface PackingTarget {
  date: ISODate
  groups: PackGroup[]
  events: EventPack[]
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
  events: CalendarEvent[] = [],
): PackingTarget | null {
  const today = toISODate(now)
  const time = toHHmm(now)
  const target = (date: ISODate, day: Lesson[]) => {
    const groups = packingFor(day, subjects)
    return { date, groups, events: eventPackingFor(date, events, groups) }
  }
  const todays = lessonsOn(today, lessons, s)
  const last = todays[todays.length - 1]
  // Idag gäller så länge skolan pågår eller en händelse med packlista inte har börjat (heldag räknas hela dagen).
  const eventLeft = eventsOn(today, events).some((e) => e.packItems?.length && (!e.start || e.start > time))
  if ((last && time < last.end) || eventLeft) {
    const t = target(today, last && time < last.end ? todays : [])
    return { ...t, events: t.events.filter((e) => !e.event.start || e.event.start > time) }
  }
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i)
    const day = lessonsOn(date, lessons, s)
    if (day.length > 0 || eventsOn(date, events).some((e) => e.packItems?.length)) return target(date, day)
  }
  return null
}
