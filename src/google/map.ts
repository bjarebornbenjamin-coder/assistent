import { addDays, daysBetween, toHHmm, toISODate } from '../domain/dates'
import type { CalendarEvent } from '../domain/types'

/** Det vi använder av en händelse från Google Calendar API (events.list med singleEvents=true). */
export interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  description?: string
  location?: string
  htmlLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
}

const MAX_DAYS = 14

/**
 * Gör om Googles händelser till appens. Heldagar över flera dagar blir en händelse per dag
 * (högst 14). Händelser med tid får lokal tid; slutar de en annan dag utelämnas sluttiden.
 */
export function fromGoogle(calendarId: string, items: GoogleEvent[], now = new Date()): CalendarEvent[] {
  const out: CalendarEvent[] = []
  const updatedAt = now.toISOString()
  for (const g of items) {
    if (g.status === 'cancelled' || !g.id || !g.start) continue
    const title = (g.summary ?? '').trim().slice(0, 100) || '(Utan titel)'
    const note = [g.location?.trim(), g.description?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()].filter(Boolean).join(' · ').slice(0, 500)
    const base = { title, note, source: 'google' as const, ...(g.htmlLink ? { link: g.htmlLink } : {}), updatedAt }
    const key = `g:${calendarId}:${g.id}`
    if (g.start.date) {
      const first = g.start.date
      const last = g.end?.date ? addDays(g.end.date, -1) : first // Googles slutdatum är exklusivt
      const n = Math.min(MAX_DAYS, Math.max(1, daysBetween(first, last) + 1))
      for (let i = 0; i < n; i++) {
        const date = addDays(first, i)
        out.push({ id: n === 1 ? key : `${key}:${date}`, date, ...base })
      }
    } else if (g.start.dateTime) {
      const s = new Date(g.start.dateTime)
      const e = g.end?.dateTime ? new Date(g.end.dateTime) : null
      const date = toISODate(s)
      const start = toHHmm(s)
      const end = e && toISODate(e) === date && toHHmm(e) > start ? toHHmm(e) : undefined
      out.push({ id: key, date, start, ...(end ? { end } : {}), ...base })
    }
  }
  return out
}

export const isGoogle = (e: Pick<CalendarEvent, 'source'>) => e.source === 'google'
