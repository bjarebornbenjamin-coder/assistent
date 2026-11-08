import { addDays, parseISODate, toISODate } from './dates'
import type { ISODate, Task } from './types'

const byDeadline = (a: Task, b: Task) => a.deadline.localeCompare(b.deadline) || a.title.localeCompare(b.title, 'sv')

/** Ej klara uppgifter som är försenade eller förfaller inom `days` dagar. */
export function upcomingTasks(now: Date, tasks: Task[], days = 7): Task[] {
  const last = addDays(toISODate(now), days)
  return tasks.filter((t) => !t.done && t.deadline <= last).sort(byDeadline)
}

export function tasksOn(date: ISODate, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.deadline === date).sort((a, b) => Number(a.done) - Number(b.done) || byDeadline(a, b))
}

export function isOverdue(t: Task, today: ISODate): boolean {
  return !t.done && t.deadline < today
}

export function deadlineLabel(date: ISODate, today: ISODate): string {
  if (date === today) return 'Idag'
  if (date === addDays(today, 1)) return 'Imorgon'
  return parseISODate(date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
}
