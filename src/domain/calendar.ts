import { addDays, daysBetween, mondayOf, parseISODate, toHHmm, toISODate } from './dates'
import type { CalendarEvent, ISODate } from './types'

/** Månadens veckor, måndag först, med dagar från grannmånader som utfyllnad. */
export function monthGrid(year: number, month: number): ISODate[][] {
  const first = toISODate(new Date(year, month, 1))
  const last = toISODate(new Date(year, month + 1, 0))
  const start = mondayOf(first)
  const weeks = Math.ceil((daysBetween(start, last) + 1) / 7)
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
}

export function weekDays(date: ISODate): ISODate[] {
  const monday = mondayOf(date)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Heldagshändelser först, sedan på starttid. */
export function eventsOn(date: ISODate, events: CalendarEvent[]): CalendarEvent[] {
  return events
    .filter((e) => e.date === date)
    .sort((a, b) => (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title, 'sv'))
}

/** Händelser från nu och `days` dagar framåt (idag räknas bara om de inte redan är slut). */
export function upcomingEvents(now: Date, events: CalendarEvent[], days = 7): CalendarEvent[] {
  const today = toISODate(now)
  const t = toHHmm(now)
  const lastDay = addDays(today, days)
  return events
    .filter((e) => {
      if (e.date < today || e.date > lastDay) return false
      if (e.date > today || e.start === undefined) return true
      return (e.end ?? e.start) >= t
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
}

export function dayLabel(date: ISODate): string {
  return parseISODate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function eventTime(e: Pick<CalendarEvent, 'start' | 'end'>): string {
  if (!e.start) return 'Heldag'
  return e.end ? `${e.start}–${e.end}` : e.start
}
