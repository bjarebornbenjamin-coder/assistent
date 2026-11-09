import { WEEKDAYS_LONG, addDays, toHHmm, toISODate, weekdayOf } from './dates'
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

/** Vilka veckor i cykeln en lektion gäller (null = alla). */
function weekSet(weeks: number[] | null, cycleLength: number): Set<number> {
  return new Set(weeks ?? Array.from({ length: Math.max(cycleLength, 1) }, (_, i) => i))
}

/** Lektioner som överlappar `candidate` samma veckodag och i någon gemensam vecka. */
export function findConflicts(
  candidate: Pick<Lesson, 'id' | 'weekday' | 'start' | 'end' | 'weeks'>,
  lessons: Lesson[],
  cycleLength: number,
): Lesson[] {
  const mine = weekSet(candidate.weeks, cycleLength)
  return lessons
    .filter((l) => l.id !== candidate.id && l.weekday === candidate.weekday)
    .filter((l) => candidate.start < l.end && l.start < candidate.end)
    .filter((l) => [...weekSet(l.weeks, cycleLength)].some((w) => mine.has(w)))
    .sort((a, b) => a.start.localeCompare(b.start))
}

const minutesOf = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 === 0 ? `${h} h` : `${h} h ${m % 60} min`
}

const MONTHS = ['jan', 'feb', 'mars', 'apr', 'maj', 'juni', 'juli', 'aug', 'sep', 'okt', 'nov', 'dec']

/** "imorgon", "på onsdag (11 nov)" eller "nästa måndag (16 nov)" när det är samma veckodag som idag. */
export function relativeDay(date: ISODate, today: ISODate): string {
  if (date === today) return 'idag'
  if (date === addDays(today, 1)) return 'imorgon'
  const wd = WEEKDAYS_LONG[weekdayOf(date) - 1]
  const [, m, d] = date.split('-').map(Number)
  const short = `${d} ${MONTHS[m - 1]}`
  return weekdayOf(date) === weekdayOf(today) ? `nästa ${wd} (${short})` : `på ${wd} (${short})`
}

/** Text under "Nästa lektion": pågår, nedräkning idag, eller dag och tid. */
export function describeNext(now: Date, next: NextLesson): string {
  if (next.ongoing) return `Pågår nu – slutar ${next.lesson.end}`
  const today = toISODate(now)
  if (next.date === today) {
    const nowMin = now.getHours() * 60 + now.getMinutes()
    return `Nästa lektion om ${formatDuration(minutesOf(next.lesson.start) - nowMin)}`
  }
  return `Nästa lektion ${relativeDay(next.date, today)} kl ${next.lesson.start}`
}
