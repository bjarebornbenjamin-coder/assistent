import { WEEKDAYS_SHORT, parseISODate, toISODate, weekdayOf } from './dates'
import type { ISODate, Reminder } from './types'

export function occursOn(r: Reminder, date: ISODate): boolean {
  if (!r.enabled) return false
  switch (r.repeat.kind) {
    case 'once':
      return r.repeat.date === date
    case 'daily':
      return true
    case 'weekdays':
      return r.repeat.days.includes(weekdayOf(date))
  }
}

/** Påminnelser som återstår idag (tiden har inte passerat), i tidsordning. */
export function remainingToday(now: Date, reminders: Reminder[]): Reminder[] {
  const today = toISODate(now)
  const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return reminders.filter((r) => occursOn(r, today) && r.time > t).sort((a, b) => a.time.localeCompare(b.time))
}

export function describeRepeat(r: Reminder['repeat']): string {
  if (r.kind === 'daily') return 'Varje dag'
  if (r.kind === 'once') return parseISODate(r.date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  const days = [...r.days].sort()
  if (days.length === 7) return 'Varje dag'
  if (days.join() === '1,2,3,4,5') return 'Vardagar'
  if (days.length === 1) return `Varje ${['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'][days[0] - 1]}`
  return days.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')
}
