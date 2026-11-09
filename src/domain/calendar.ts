import { addDays, daysBetween, mondayOf, parseISODate, toHHmm, toISODate } from './dates'
import type { CalendarEvent, ISODate, Task } from './types'

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

export type AgendaItem =
  | { kind: 'event'; date: ISODate; event: CalendarEvent }
  | { kind: 'task'; date: ISODate; task: Task }

const norm = (s: string) => s.toLowerCase().normalize('NFC')

/**
 * Händelser och uppgifter som matchar `query` (titel, anteckning eller ämne; alla ord måste finnas).
 * Tom sökning ger det som är kvar från idag och `days` dagar framåt.
 * Kommande först i datumordning, sedan passerade med den senaste först.
 */
export function agenda(query: string, events: CalendarEvent[], tasks: Task[], today: ISODate, opts: { subjectName?: (id?: string) => string | undefined; days?: number } = {}): AgendaItem[] {
  const words = norm(query).split(/\s+/).filter(Boolean)
  const items: AgendaItem[] = [
    ...events.map((event) => ({ kind: 'event' as const, date: event.date, event })),
    ...tasks.map((task) => ({ kind: 'task' as const, date: task.deadline, task })),
  ]
  const text = (i: AgendaItem) =>
    norm(i.kind === 'event' ? `${i.event.title} ${i.event.note}` : `${i.task.title} ${i.task.note ?? ''} ${opts.subjectName?.(i.task.subjectId) ?? ''}`)
  const time = (i: AgendaItem) => (i.kind === 'event' ? i.event.start ?? '' : i.task.time ?? '24')
  const byTime = (a: AgendaItem, b: AgendaItem) => a.date.localeCompare(b.date) || time(a).localeCompare(time(b))
  if (words.length === 0) {
    const last = addDays(today, opts.days ?? 60)
    return items.filter((i) => i.date >= today && i.date <= last && !(i.kind === 'task' && i.task.done)).sort(byTime)
  }
  const hits = items.filter((i) => words.every((w) => text(i).includes(w)))
  return [...hits.filter((i) => i.date >= today).sort(byTime), ...hits.filter((i) => i.date < today).sort((a, b) => byTime(b, a))]
}
