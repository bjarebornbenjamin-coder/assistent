import { addDays, parseISODate, toISODate, weekdayOf } from './dates'
import { packingFor } from './packing'
import { occursOn } from './reminders'
import { lessonsOn } from './schedule'
import { eventTime, eventsOn } from './calendar'
import { tasksOn } from './tasks'
import type { CalendarEvent, ISODate, Lesson, PantryItem, Reminder, Settings, ShoppingItem, Subject, Task } from './types'

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

const list = (items: string[], max: number) => items.slice(0, max).join(', ') + (items.length > max ? ` +${items.length - max} till` : '')

export interface BriefingData {
  lessons: Lesson[]
  subjects: Subject[]
  events: CalendarEvent[]
  tasks: Task[]
  reminders: Reminder[]
  pantry: PantryItem[]
}

/** Morgonöversikt för en dag, eller null om dagen är tom. En rad per sort så att notisen går att skumma. */
export function morningBriefing(date: ISODate, s: Pick<Settings, 'cycleLength' | 'cycleAnchor'>, d: BriefingData): { title: string; body: string } | null {
  const name = (l: Lesson) => d.subjects.find((x) => x.id === l.subjectId)?.name ?? 'Lektion'
  const lessons = lessonsOn(date, d.lessons, s)
  const events = eventsOn(date, d.events)
  const due = tasksOn(date, d.tasks).filter((t) => !t.done)
  const overdue = d.tasks.filter((t) => !t.done && t.deadline < date)
  const reminders = d.reminders.filter((r) => occursOn(r, date)).sort((a, b) => a.time.localeCompare(b.time))
  const expiring = d.pantry.filter((p) => p.expires === date).map((p) => p.name)
  if (!lessons.length && !events.length && !due.length && !overdue.length && !reminders.length && !expiring.length) return null

  const title = lessons.length
    ? `Idag: ${name(lessons[0])} ${lessons[0].start}${lessons.length > 1 ? `, slutar ${lessons.reduce((m, l) => (l.end > m ? l.end : m), '00:00')}` : ''}`
    : 'Idag: ingen skola'
  const pack = packingFor(lessons, d.subjects).flatMap((g) => g.items.map((it) => lowerFirst(it.text.trim())))
  const lines = [
    lessons.length > 1 && `Lektioner: ${list(lessons.map((l) => `${name(l)} ${l.start}`), 4)}`,
    pack.length > 0 && `Ta med: ${list(pack, 5)}`,
    due.length > 0 && `Ska in: ${list(due.map((t) => (t.time ? `${t.title} ${t.time}` : t.title)), 3)}`,
    overdue.length > 0 && `Försenat: ${list(overdue.map((t) => t.title), 2)}`,
    events.length > 0 && `Händelser: ${list(events.map((e) => (e.start ? `${e.title} ${eventTime(e)}` : e.title)), 3)}`,
    reminders.length > 0 && `Påminnelser: ${list(reminders.map((r) => `${r.title} ${r.time}`), 3)}`,
    expiring.length > 0 && `Ät idag: ${list(expiring, 3)} (går ut)`,
  ].filter((x): x is string => Boolean(x))
  return { title, body: lines.join('\n') || 'Inget mer inplanerat.' }
}

/** Notiser de närmaste `days` dagarna, enligt inställningarna. Bara sådana som ligger i framtiden. */
export function planNotifications(
  now: Date,
  s: Pick<Settings, 'cycleLength' | 'cycleAnchor' | 'notify'> & Partial<Pick<Settings, 'food'>>,
  lessons: Lesson[],
  subjects: Subject[],
  days = 14,
  reminders: Reminder[] = [],
  food: { pantry: PantryItem[]; shopping: ShoppingItem[] } = { pantry: [], shopping: [] },
  calendar: { events: CalendarEvent[]; tasks: Task[] } = { events: [], tasks: [] },
): PlannedNotification[] {
  const out: PlannedNotification[] = []
  const today = toISODate(now)
  const name = (l: Lesson) => subjects.find((x) => x.id === l.subjectId)?.name ?? 'Lektion'

  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i)
    for (const r of reminders) {
      const fireAt = at(date, r.time)
      if (occursOn(r, date) && fireAt > now) {
        out.push({ id: `reminder:${r.id}:${date}`, fireAt, title: r.title, body: `Påminnelse kl ${r.time}` })
      }
    }

    if (s.notify.morning) {
      const fireAt = at(date, s.notify.morningTime)
      const brief = fireAt > now ? morningBriefing(date, s, { lessons, subjects, reminders, pantry: food.pantry, ...calendar }) : null
      if (brief) out.push({ id: `morning:${date}`, fireAt, ...brief })
    }

    const f = s.food
    if (f?.expiry.enabled) {
      const tomorrow = addDays(date, 1)
      const soon = food.pantry
        .filter((p) => p.expires === date || p.expires === tomorrow)
        .sort((a, b) => (a.expires ?? '').localeCompare(b.expires ?? '') || a.name.localeCompare(b.name, 'sv'))
      const fireAt = at(date, f.expiry.time)
      if (soon.length > 0 && fireAt > now) {
        const names = soon.slice(0, 4).map((p) => `${p.name} (${p.expires === date ? 'idag' : 'imorgon'})`)
        out.push({
          id: `expiry:${date}`,
          fireAt,
          title: 'Mat som snart går ut',
          body: names.join(', ') + (soon.length > 4 ? ` +${soon.length - 4} till` : ''),
        })
      }
    }

    if (f?.shopping.enabled && weekdayOf(date) === f.shopping.weekday) {
      const open = food.shopping.filter((i) => !i.done)
      const fireAt = at(date, f.shopping.time)
      if (open.length > 0 && fireAt > now) {
        const names = open.slice(0, 6).map((i) => i.name)
        out.push({
          id: `shopping:${date}`,
          fireAt,
          title: `Inköpslistan: ${open.length} ${open.length === 1 ? 'vara' : 'varor'}`,
          body: names.join(', ') + (open.length > 6 ? ` +${open.length - 6} till` : ''),
        })
      }
    }

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
