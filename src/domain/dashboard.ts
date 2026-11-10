import { eventTime, eventsOn } from './calendar'
import { occursOn } from './reminders'
import { lessonsOn } from './schedule'
import { tasksOn } from './tasks'
import type { CalendarEvent, ISODate, Lesson, Reminder, Settings, Subject, Task } from './types'

export interface TimelineItem {
  key: string
  kind: 'lesson' | 'event' | 'task' | 'reminder'
  /** Sorteringstid, HH:mm. Heldag och uppgifter utan klockslag sorteras först respektive sist. */
  sortTime: string
  timeLabel: string
  title: string
  sub?: string
  /** Ämnesfärg för lektioner och uppgifter. */
  color?: string
  past: boolean
  ongoing: boolean
  task?: Task
}

/** Allt som händer en dag i tidsordning: lektioner, händelser, uppgifter som ska in och påminnelser. */
export function dayTimeline(
  date: ISODate,
  nowTime: string | null,
  d: { lessons: Lesson[]; events: CalendarEvent[]; tasks: Task[]; reminders: Reminder[]; subjects: Subject[]; settings: Pick<Settings, 'cycleLength' | 'cycleAnchor'> },
): TimelineItem[] {
  const subject = (id?: string) => d.subjects.find((s) => s.id === id)
  const passed = (end: string) => nowTime !== null && end <= nowTime
  const items: TimelineItem[] = [
    ...lessonsOn(date, d.lessons, d.settings).map((l) => ({
      key: `l:${l.id}`,
      kind: 'lesson' as const,
      sortTime: l.start,
      timeLabel: `${l.start}–${l.end}`,
      title: subject(l.subjectId)?.name ?? 'Lektion',
      sub: [l.room && `Sal ${l.room}`, l.teacher].filter(Boolean).join(' · ') || undefined,
      color: subject(l.subjectId)?.color,
      past: passed(l.end),
      ongoing: nowTime !== null && l.start <= nowTime && nowTime < l.end,
    })),
    ...eventsOn(date, d.events).map((e) => ({
      key: `e:${e.id}`,
      kind: 'event' as const,
      sortTime: e.start ?? '00:00',
      timeLabel: eventTime(e),
      title: e.title,
      sub: e.note || undefined,
      past: e.start ? passed(e.end ?? e.start) : false,
      ongoing: Boolean(e.start && e.end && nowTime !== null && e.start <= nowTime && nowTime < e.end),
    })),
    ...tasksOn(date, d.tasks).map((t) => ({
      key: `t:${t.id}`,
      kind: 'task' as const,
      sortTime: t.time ?? '23:59',
      timeLabel: t.time ? `Inne ${t.time}` : 'Ska in',
      title: t.title,
      sub: subject(t.subjectId)?.name,
      color: subject(t.subjectId)?.color,
      past: t.done,
      ongoing: false,
      task: t,
    })),
    ...d.reminders
      .filter((r) => occursOn(r, date))
      .map((r) => ({ key: `r:${r.id}`, kind: 'reminder' as const, sortTime: r.time, timeLabel: r.time, title: r.title, sub: 'Påminnelse', past: passed(r.time), ongoing: false })),
  ]
  return items.sort((a, b) => a.sortTime.localeCompare(b.sortTime) || a.kind.localeCompare(b.kind))
}

/** "1,3" med svensk decimal. */
export const sv1 = (v: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: 1 })

/** Andel av ett mål som 0–1, för staplar. */
export const share = (value: number, goal: number) => (goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0)
