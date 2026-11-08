import { addDays, parseISODate, toISODate } from './dates'
import { packingFor } from './packing'
import { lessonsOn } from './schedule'
import type { Lesson, Settings, Subject } from './types'

export interface PlannedNotification {
  /** Stabilt id så att samma notis inte dubbleras vid omplanering. */
  id: string
  fireAt: Date
  title: string
  body: string
}

const at = (date: string, time: string): Date => {
  const d = parseISODate(date)
  d.setHours(Number(time.slice(0, 2)), Number(time.slice(3, 5)), 0, 0)
  return d
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** Notiser de närmaste `days` dagarna, enligt inställningarna. Bara sådana som ligger i framtiden. */
export function planNotifications(
  now: Date,
  s: Pick<Settings, 'cycleLength' | 'cycleAnchor' | 'notify'>,
  lessons: Lesson[],
  subjects: Subject[],
  days = 14,
): PlannedNotification[] {
  const out: PlannedNotification[] = []
  const today = toISODate(now)
  const name = (l: Lesson) => subjects.find((x) => x.id === l.subjectId)?.name ?? 'Lektion'

  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i)
    const day = lessonsOn(date, lessons, s)
    if (day.length === 0) continue

    if (s.notify.evening) {
      const fireAt = at(addDays(date, -1), s.notify.eveningTime)
      if (fireAt > now) {
        const first = day[0]
        const items = packingFor(day, subjects).flatMap((g) => g.items.map((it) => lowerFirst(it.text.trim())))
        const more = day.length > 1 ? ` (+${day.length - 1} till)` : ''
        out.push({
          id: `evening:${date}`,
          fireAt,
          title: `Imorgon: ${name(first)} ${first.start}${more}`,
          body: items.length > 0 ? `Ta med ${items.join(', ')}` : 'Inget att packa enligt dina packlistor.',
        })
      }
    }

    if (s.notify.before && s.notify.beforeMinutes >= 0) {
      for (const l of day) {
        const start = at(date, l.start)
        const fireAt = new Date(start.getTime() - s.notify.beforeMinutes * 60_000)
        if (fireAt > now) {
          out.push({
            id: `before:${date}:${l.id}`,
            fireAt,
            title: s.notify.beforeMinutes > 0 ? `${name(l)} om ${s.notify.beforeMinutes} min` : `${name(l)} börjar nu`,
            body: [`Kl ${l.start}`, l.room && `sal ${l.room}`, l.teacher].filter(Boolean).join(', '),
          })
        }
      }
    }
  }
  return out.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
}
