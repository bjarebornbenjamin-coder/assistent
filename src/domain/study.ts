import { WEEKDAYS_LONG, addDays, daysBetween, weekdayOf } from './dates'
import { eventsOn } from './calendar'
import { lessonsOn } from './schedule'
import type { CalendarEvent, ISODate, Lesson, Settings } from './types'

export interface StudyInput {
  exam: string
  examDate: ISODate
  /** Det som ingår, ett moment per rad. Kan vara tomt. */
  topics: string[]
  /** Första dag att plugga. */
  from: ISODate
  /** Antal pass; utelämnat = ett per moment plus repetition, högst ett per dag. */
  sessions?: number
  minutes?: number
  lessons: Lesson[]
  events: CalendarEvent[]
  settings: Pick<Settings, 'cycleLength' | 'cycleAnchor'>
  /** Om planen börjar idag: klockslaget nu, så att inga pass hamnar bakåt i tiden. */
  nowTime?: string
}

export interface StudySession {
  date: ISODate
  weekday: string
  start: string
  end: string
  focus: string
  title: string
}

export interface StudyPlan {
  sessions: StudySession[]
  warnings: string[]
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const LATEST_END = 21 * 60

/** Första lediga tid: efter skolan (30 min paus, tidigast 15:30) på skoldagar, annars från 10:00. */
function slotOn(date: ISODate, minutes: number, input: StudyInput): number | null {
  const lessons = lessonsOn(date, input.lessons, input.settings)
  const busy = [
    ...lessons.map((l) => [toMin(l.start), toMin(l.end)]),
    ...eventsOn(date, input.events)
      .filter((e) => e.start)
      .map((e) => [toMin(e.start!), e.end ? toMin(e.end) : toMin(e.start!) + 60]),
  ]
  const lessonEnd = lessons.reduce((m, l) => Math.max(m, toMin(l.end)), 0)
  let from = lessonEnd ? Math.max(lessonEnd + 30, 15 * 60 + 30) : 10 * 60
  if (date === input.from && input.nowTime) from = Math.max(from, toMin(input.nowTime) + 15)
  for (let s = Math.ceil(from / 15) * 15; s + minutes <= LATEST_END; s += 15) {
    if (!busy.some(([a, b]) => s < b && a < s + minutes)) return s
  }
  return null
}

/** Fördelar momenten på passen. Sista passet är alltid repetition när det finns fler pass än moment. */
export function focusFor(topics: string[], n: number): string[] {
  if (n <= 0) return []
  if (topics.length === 0) return Array.from({ length: n }, (_, i) => (i === n - 1 && n > 1 ? 'Repetition och gamla prov' : 'Läs och gör uppgifter'))
  if (n === 1) return [topics.join(', ')]
  if (n <= topics.length) {
    // Fler moment än pass: slå ihop i tur och ordning, sista passet får repetition om det finns plats.
    const groups: string[][] = Array.from({ length: n }, () => [])
    topics.forEach((t, i) => groups[Math.floor((i * n) / topics.length)].push(t))
    return groups.map((g) => g.join(', '))
  }
  const out = [...topics]
  // Extra pass: repetera momenten igen (svårast att minnas är det som lästes först), sist allt.
  let k = 0
  while (out.length < n - 1) out.push(`Repetera ${topics[k++ % topics.length]}`)
  out.push('Repetition av allt och gamla prov')
  return out
}

export function planStudy(input: StudyInput): StudyPlan {
  const warnings: string[] = []
  const minutes = input.minutes ?? 45
  const daysLeft = daysBetween(input.from, input.examDate)
  if (daysLeft <= 0) return { sessions: [], warnings: ['Provet är idag eller redan passerat, så det finns inga dagar att planera.'] }

  const wanted = input.sessions ?? Math.min(daysLeft, Math.max(2, input.topics.length + 1))
  const candidates: { date: ISODate; start: number }[] = []
  for (let i = 0; i < daysLeft; i++) {
    const date = addDays(input.from, i)
    const start = slotOn(date, minutes, input)
    if (start !== null) candidates.push({ date, start })
  }

  let picked = candidates
  if (candidates.length > wanted) {
    // Jämnt utspritt och med sista passet så nära provet som möjligt.
    picked = Array.from({ length: wanted }, (_, k) => candidates[Math.round(((k + 1) * candidates.length) / wanted) - 1])
  }
  if (picked.length < wanted) {
    warnings.push(
      candidates.length === 0
        ? `Hittade ingen ledig tid på ${minutes} min före provet.`
        : `Det finns bara lediga tider för ${picked.length} av ${wanted} pass före provet. Gör passen längre, börja tidigare eller frigör tid.`,
    )
  }
  if (daysLeft <= 2) warnings.push('Kort om tid: fokusera på det som är svårast och på gamla prov.')

  const focus = focusFor(input.topics, picked.length)
  return {
    sessions: picked.map((c, i) => ({
      date: c.date,
      weekday: WEEKDAYS_LONG[weekdayOf(c.date) - 1],
      start: fromMin(c.start),
      end: fromMin(c.start + minutes),
      focus: focus[i],
      title: `Plugg ${input.exam}: ${focus[i]}`.slice(0, 100),
    })),
    warnings,
  }
}
