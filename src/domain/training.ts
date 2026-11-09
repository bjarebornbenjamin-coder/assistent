import { WEEKDAYS_LONG, addDays, daysBetween, weekdayOf } from './dates'
import { eventsOn } from './calendar'
import { lessonsOn } from './schedule'
import { tasksOn } from './tasks'
import type { CalendarEvent, ISODate, Lesson, Settings, Task } from './types'

export interface SessionRequest {
  /** t.ex. "gym", "löpning" */
  type: string
  count: number
  minutes?: number
}

export interface PlannedSession {
  date: ISODate
  weekday: string
  type: string
  start: string
  end: string
  minutes: number
  why: string
}

export interface WorkoutPlan {
  sessions: PlannedSession[]
  restDays: ISODate[]
  /** Träningspass som redan finns i kalendern och som planen tagit hänsyn till. */
  existing: { date: ISODate; type: string; title: string }[]
  /** Träningspass de närmaste dagarna före perioden (påverkar vila och följder). */
  recent: { date: ISODate; type: string; title: string }[]
  warnings: string[]
}

export interface PlanInput {
  from: ISODate
  days: number
  sessions: SessionRequest[]
  lessons: Lesson[]
  events: CalendarEvent[]
  tasks: Task[]
  settings: Pick<Settings, 'cycleLength' | 'cycleAnchor'>
  avoidWeekdays?: number[]
  /** Loggade (genomförda) pass; räknas som träningsdagar precis som pass i kalendern. */
  logged?: { date: ISODate; type: string; title: string }[]
  /** Om planen börjar idag: tidigaste starttid (nu), HH:mm. */
  earliestToday?: string
  preferredTime?: 'morning' | 'afternoon' | 'evening'
}

export const TRAINING_RULES = [
  'Aldrig tre träningsdagar i rad (högst två).',
  'Högst ett pass per dag, så olika pass (t.ex. gym och löpning) hamnar på olika dagar.',
  'Minst en vilodag mellan två pass av samma sort.',
  'Passen sprids jämnt över perioden i stället för att klumpas ihop.',
  'Pass läggs efter skolan och inte över andra händelser; dagen före prov och deadlines undviks när det går.',
]

const MAX_CONSECUTIVE = 2
const WORKOUT = /(gym|träning|styrk|crossfit|hiit|löp|spring|jogg|run|simning|simma|yoga|pilates|cykl|spinning|fotboll|basket|padel|tennis|innebandy)/i
const EXAM = /(prov|tenta|redovisning|presentation|nationella)/i
/** Pluggpass ("Plugg Matteprov: …") är inte själva provet. */
const isExam = (title: string) => EXAM.test(title) && !/^plugg/i.test(title.trim())

/** Är det här ett träningspass i kalendern, och i så fall vilken sort? */
export function workoutTypeOf(title: string): string | null {
  if (!WORKOUT.test(title)) return null
  if (/(gym|styrk|crossfit|hiit)/i.test(title)) return 'gym'
  if (/(löp|spring|jogg|run)/i.test(title)) return 'löpning'
  return 'annat'
}

/** Normaliserar användarens ord till en pass-sort så att "springa" och "löpning" räknas som samma. */
export function normalizeType(type: string): string {
  const t = type.trim().toLowerCase()
  if (/(gym|styrk|crossfit|hiit)/.test(t)) return 'gym'
  if (/(löp|spring|jogg|run)/.test(t)) return 'löpning'
  return t || 'träning'
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const DEFAULT_MINUTES: Record<string, number> = { gym: 60, löpning: 45 }

interface Interval {
  start: number
  end: number
}

/** Upptagna tider en dag: lektioner och händelser med tid. */
function busyOn(date: ISODate, input: PlanInput): Interval[] {
  const lessons = lessonsOn(date, input.lessons, input.settings).map((l) => ({ start: toMin(l.start), end: toMin(l.end) }))
  const events = eventsOn(date, input.events)
    .filter((e) => e.start)
    .map((e) => ({ start: toMin(e.start!), end: e.end ? toMin(e.end) : toMin(e.start!) + 60 }))
  return [...lessons, ...events]
}

/** Första lediga tid för ett pass av given längd, eller null. */
function findSlot(date: ISODate, minutes: number, input: PlanInput): { start: number; end: number; afterSchool: number | null } | null {
  const busy = busyOn(date, input)
  const lessonEnd = lessonsOn(date, input.lessons, input.settings).reduce((m, l) => Math.max(m, toMin(l.end)), 0)
  const schoolDay = lessonEnd > 0
  const pref = input.preferredTime
  // Fönster: efter skolan (45 min restid/paus) på skoldagar, annars dagtid. Aldrig efter 21:00.
  let from = schoolDay ? Math.max(lessonEnd + 45, 16 * 60) : pref === 'morning' ? 8 * 60 : pref === 'afternoon' ? 15 * 60 : pref === 'evening' ? 18 * 60 : 10 * 60
  if (schoolDay && pref === 'evening') from = Math.max(from, 18 * 60)
  if (schoolDay && pref === 'morning') from = Math.max(6 * 60 + 30, 0) // morgon före skolan, om första lektionen är sen nog
  const first = lessonsOn(date, input.lessons, input.settings)[0]
  if (schoolDay && pref === 'morning' && first && toMin(first.start) >= 6 * 60 + 30 + minutes + 90) {
    const start = 6 * 60 + 30
    if (!busy.some((b) => start < b.end && b.start < start + minutes)) return { start, end: start + minutes, afterSchool: null }
  }
  if (schoolDay && pref === 'morning') from = Math.max(lessonEnd + 45, 16 * 60)
  if (input.earliestToday && date === input.from) from = Math.max(from, toMin(input.earliestToday) + 30)
  for (let start = Math.ceil(from / 15) * 15; start + minutes <= 21 * 60; start += 15) {
    if (!busy.some((b) => start < b.end && b.start < start + minutes)) return { start, end: start + minutes, afterSchool: schoolDay ? lessonEnd : null }
  }
  return null
}

/** Hur belastad dagen är, som straff (högre = sämre dag att träna). */
function dayLoad(date: ISODate, input: PlanInput): number {
  let load = 0
  const lessonEnd = lessonsOn(date, input.lessons, input.settings).reduce((m, l) => Math.max(m, toMin(l.end)), 0)
  if (lessonEnd > 17 * 60) load += 2
  load += Math.min(2, eventsOn(date, input.events).filter((e) => !workoutTypeOf(e.title)).length) * 1.5
  load += Math.min(2, tasksOn(date, input.tasks).filter((t) => !t.done).length)
  // Dagen före prov/deadline: dålig dag att slita på kroppen sent.
  const next = addDays(date, 1)
  if (eventsOn(next, input.events).some((e) => isExam(e.title))) load += 4
  load += Math.min(2, tasksOn(next, input.tasks).filter((t) => !t.done).length) * 1.5
  const wd = weekdayOf(date)
  if (wd >= 6 && lessonEnd === 0) load -= 1 // ledig helgdag är bra träningsdag
  return load
}

function uniquePermutations<T>(items: T[]): T[][] {
  const out: T[][] = []
  const sorted = [...items].sort() as T[]
  const used = new Array(sorted.length).fill(false)
  const cur: T[] = []
  const rec = () => {
    if (cur.length === sorted.length) return void out.push([...cur])
    for (let i = 0; i < sorted.length; i++) {
      if (used[i] || (i > 0 && sorted[i] === sorted[i - 1] && !used[i - 1])) continue
      used[i] = true
      cur.push(sorted[i])
      rec()
      cur.pop()
      used[i] = false
    }
  }
  rec()
  return out
}

interface Subset {
  days: number[] // index i i dagslistan
  cost: number
}

export function planWorkouts(input: PlanInput): WorkoutPlan {
  const warnings: string[] = []
  const dates = Array.from({ length: input.days }, (_, i) => addDays(input.from, i))
  const requested: string[] = input.sessions.flatMap((s) => Array.from({ length: s.count }, () => normalizeType(s.type)))
  const minutesFor = new Map<string, number>()
  for (const s of input.sessions) minutesFor.set(normalizeType(s.type), s.minutes ?? DEFAULT_MINUTES[normalizeType(s.type)] ?? 45)

  // Befintliga träningspass: i perioden och tre dagar före (för att inte bli 3 i rad över gränsen).
  const existing: { date: ISODate; type: string; title: string }[] = []
  const recent: { date: ISODate; type: string; title: string }[] = []
  const trainedType = new Map<ISODate, string>()
  for (let i = -3; i < input.days; i++) {
    const d = addDays(input.from, i)
    const fromLog = (input.logged ?? []).filter((w) => w.date === d).map((w) => ({ title: w.title, type: normalizeType(w.type) }))
    for (const e of [...fromLog, ...eventsOn(d, input.events).map((x) => ({ title: x.title, type: workoutTypeOf(x.title) }))]) {
      const type = e.type
      if (type && !trainedType.has(d)) {
        trainedType.set(d, type)
        if (i >= 0) existing.push({ date: d, type, title: e.title })
        else recent.push({ date: d, type, title: e.title })
      }
    }
  }

  // Dagar som går att använda: lucka finns, inte avstängd veckodag, inte redan träningsdag.
  const avoid = new Set(input.avoidWeekdays ?? [])
  const slots = dates.map((d) => {
    if (avoid.has(weekdayOf(d)) || trainedType.has(d)) return null
    return findSlot(d, Math.min(...[...minutesFor.values(), 45]), input)
  })
  const candidates = dates.map((_, i) => i).filter((i) => slots[i] !== null)

  let n = requested.length
  if (n === 0) return { sessions: [], restDays: dates.filter((d) => !trainedType.has(d)), existing, recent, warnings: ['Inga pass att planera.'] }

  const trainedIdx = (d: ISODate) => daysBetween(input.from, d)
  const preTrained = [...trainedType.keys()].map(trainedIdx) // index relativt from (kan vara negativa)

  /** Max antal i följd om vi lägger till `chosen`. */
  const consecutiveOk = (chosen: number[]) => {
    const all = new Set([...preTrained, ...chosen])
    let run = 0
    for (let i = -3; i <= input.days; i++) {
      run = all.has(i) ? run + 1 : 0
      if (run > MAX_CONSECUTIVE) return false
    }
    return true
  }

  const loads = dates.map((d) => dayLoad(d, input))
  const ideal = input.days / n

  function search(count: number): Subset[] {
    const found: Subset[] = []
    const rec = (pos: number, chosen: number[]) => {
      if (chosen.length === count) {
        const all = [...new Set([...preTrained.filter((i) => i >= -1), ...chosen])].sort((a, b) => a - b)
        let cost = chosen.reduce((s, i) => s + loads[i], 0)
        for (let k = 1; k < all.length; k++) {
          const gap = all[k] - all[k - 1]
          if (gap === 1) cost += 6 // pass på två dagar i rad: tillåtet men inte önskvärt
          cost += (gap - ideal) ** 2 * 0.6
        }
        // Spridning mot periodens kanter
        const lead = (chosen[0] ?? 0) - 0
        const tail = input.days - 1 - (chosen[chosen.length - 1] ?? 0)
        cost += Math.max(0, lead - ideal) ** 2 * 0.2 + Math.max(0, tail - ideal) ** 2 * 0.2
        found.push({ days: [...chosen], cost })
        return
      }
      for (let k = pos; k < candidates.length; k++) {
        const next = [...chosen, candidates[k]]
        if (!consecutiveOk(next)) continue
        rec(k + 1, next)
      }
    }
    rec(0, [])
    return found.sort((a, b) => a.cost - b.cost).slice(0, 40)
  }

  // Minska antalet pass tills det går att placera utan att bryta reglerna.
  let subsets = search(n)
  while (subsets.length === 0 && n > 0) {
    n--
    subsets = search(n)
  }
  if (n < requested.length) {
    warnings.push(`Det går inte att lägga ${requested.length} pass på ${input.days} dagar utan att bryta träningsreglerna (högst 2 dagar i rad, vila mellan lika pass, lediga luckor). Planen har ${n} pass.`)
  }
  if (n === 0) return { sessions: [], restDays: dates.filter((d) => !trainedType.has(d)), existing, recent, warnings }

  // Välj vilka pass som ryms: behåll fördelningen mellan sorterna så gott det går.
  const types = (() => {
    const counts = new Map<string, number>()
    for (const t of requested) counts.set(t, (counts.get(t) ?? 0) + 1)
    const list: string[] = []
    while (list.length < n) {
      for (const [t, c] of counts) if (c > 0 && list.length < n) (list.push(t), counts.set(t, c - 1))
    }
    return list
  })()

  const typeAt = new Map<number, string>()
  for (const [d, t] of trainedType) typeAt.set(trainedIdx(d), t)

  let best: { cost: number; days: number[]; assign: string[] } | null = null
  const perms = uniquePermutations(types)
  const evaluate = (relax: boolean) => {
    for (const sub of subsets) {
      for (const perm of perms) {
        let cost = sub.cost
        let ok = true
        const at = new Map(typeAt)
        sub.days.forEach((d, i) => at.set(d, perm[i]))
        for (const [d, t] of at) {
          const nextT = at.get(d + 1)
          if (nextT === undefined) continue
          if (nextT === t) {
            if (!relax) ok = false
            else cost += 8
          } else cost += 1.5 // olika sorter dag efter dag: ok, men vila är bättre
        }
        if (!ok) continue
        if (!best || cost < best.cost) best = { cost, days: sub.days, assign: perm }
      }
    }
  }
  evaluate(false)
  if (!best) {
    evaluate(true)
    if (best) warnings.push('Två pass av samma sort hamnar dag efter dag. Det gick inte att undvika med de här dagarna och passen.')
  }
  if (!best) return { sessions: [], restDays: dates, existing, recent, warnings: [...warnings, 'Kunde inte hitta en bra plan.'] }

  const chosen = best as { cost: number; days: number[]; assign: string[] }
  const trained = new Set([...preTrained, ...chosen.days])
  const sessions: PlannedSession[] = chosen.days
    .map((idx, i) => ({ idx, type: chosen.assign[i] }))
    .sort((a, b) => a.idx - b.idx)
    .map(({ idx, type }) => {
      const date = dates[idx]
      const minutes = minutesFor.get(type) ?? 45
      const slot = findSlot(date, minutes, input) ?? slots[idx]!
      const lessonEnd = slot.afterSchool
      const why = [
        lessonEnd !== null ? `efter skolan (slutar ${fromMin(lessonEnd)})` : weekdayOf(date) >= 6 ? 'ledig helgdag' : 'ingen skola',
        trained.has(idx - 1) ? 'dagen före är ett träningspass' : 'vilodag dagen före',
        trained.has(idx + 1) ? 'dagen efter är ett träningspass' : 'vila dagen efter',
      ].join(', ')
      return { date, weekday: WEEKDAYS_LONG[weekdayOf(date) - 1], type, start: fromMin(slot.start), end: fromMin(slot.start + minutes), minutes, why }
    })

  const plannedDates = new Set(sessions.map((s) => s.date))
  return {
    sessions,
    restDays: dates.filter((d) => !plannedDates.has(d) && !trainedType.has(d)),
    existing,
    recent,
    warnings,
  }
}
