import { addDays, toHHmm, toISODate, weekdayOf } from './dates'
import type { ISODate, Lesson, Settings } from './types'
import { weekIndex } from './weekCycle'

type CycleSettings = Pick<Settings, 'cycleLength' | 'cycleAnchor'>

export function lessonsOnWeek(
  weekday: number,
  weekIdx: number,
  lessons: Lesson[],
): Lesson[] {
  return lessons
    .filter((l) => l.weekday === weekday && (l.weeks === null || l.weeks.includes(weekIdx)))
    .sort((a, b) => a.start.localeCompare(b.start))
}

export function lessonsOn(date: ISODate, lessons: Lesson[], s: CycleSettings): Lesson[] {
  return lessonsOnWeek(weekdayOf(date), weekIndex(date, s.cycleAnchor, s.cycleLength), lessons)
}

export interface NextLesson {
  lesson: Lesson
  date: ISODate
  /** true om lektionen redan pågår */
  ongoing: boolean
}

/** Pågående lektion, annars nästa lektion inom två veckor. */
export function nextLesson(now: Date, lessons: Lesson[], s: CycleSettings): NextLesson | null {
  const today = toISODate(now)
  const t = toHHmm(now)
  const todays = lessonsOn(today, lessons, s)
  const ongoing = todays.find((l) => l.start <= t && t < l.end)
  if (ongoing) return { lesson: ongoing, date: today, ongoing: true }
  const upcoming = todays.find((l) => l.start > t)
  if (upcoming) return { lesson: upcoming, date: today, ongoing: false }
  for (let i = 1; i <= 14; i++) {
    const date = addDays(today, i)
    const first = lessonsOn(date, lessons, s)[0]
    if (first) return { lesson: first, date, ongoing: false }
  }
  return null
}
