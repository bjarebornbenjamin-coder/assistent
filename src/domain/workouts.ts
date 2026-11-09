import { addDays, mondayOf } from './dates'
import { normalizeType, workoutTypeOf } from './training'
import type { CalendarEvent, ISODate, Workout } from './types'

const n1 = (v: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: 1 })

/** Tempo i min/km, t.ex. "5:23/km". */
export function pace(minutes: number, km: number): string | null {
  if (!(km > 0) || !(minutes > 0)) return null
  const secPerKm = Math.round((minutes * 60) / km)
  return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}/km`
}

/** Kort sammanfattning, t.ex. "5,2 km · 28 min · 5:23/km" eller "4 övningar · 60 min". */
export function workoutSummary(w: Pick<Workout, 'minutes' | 'distanceKm' | 'exercises'>): string {
  const p = w.minutes && w.distanceKm ? pace(w.minutes, w.distanceKm) : null
  return [
    w.distanceKm ? `${n1(w.distanceKm)} km` : null,
    w.exercises.length ? `${w.exercises.length} ${w.exercises.length === 1 ? 'övning' : 'övningar'}` : null,
    w.minutes ? `${w.minutes} min` : null,
    p,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** "3 × 8 × 60 kg" */
export function setLabel(e: Pick<Workout['exercises'][number], 'sets' | 'reps' | 'weightKg'>): string {
  return `${e.sets} × ${e.reps}${e.weightKg ? ` × ${n1(e.weightKg)} kg` : ''}`
}

export const byNewest = (a: Workout, b: Workout) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)

/** Senaste passet av samma sort, för att fylla i samma övningar igen. */
export function lastOfType(type: string, workouts: Workout[], before?: ISODate): Workout | undefined {
  const t = normalizeType(type)
  return [...workouts].sort(byNewest).find((w) => normalizeType(w.type) === t && (!before || w.date <= before))
}

/** Senaste gången varje övning gjordes (namn utan hänsyn till versaler). */
export function exerciseHistory(workouts: Workout[]): { name: string; date: ISODate; label: string }[] {
  const seen = new Map<string, { name: string; date: ISODate; label: string }>()
  for (const w of [...workouts].sort(byNewest)) {
    for (const e of w.exercises) {
      const key = e.name.trim().toLowerCase()
      if (!seen.has(key)) seen.set(key, { name: e.name.trim(), date: w.date, label: setLabel(e) })
    }
  }
  return [...seen.values()]
}

/** Pass per vecka (måndag–söndag) de senaste `weeks` veckorna, äldst först. */
export function weeklyCounts(workouts: Workout[], today: ISODate, weeks = 6): { monday: ISODate; count: number; minutes: number; km: number }[] {
  const thisMonday = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => {
    const monday = addDays(thisMonday, -7 * (weeks - 1 - i))
    const sunday = addDays(monday, 6)
    const inWeek = workouts.filter((w) => w.date >= monday && w.date <= sunday)
    return {
      monday,
      count: inWeek.length,
      minutes: inWeek.reduce((s, w) => s + (w.minutes ?? 0), 0),
      km: Math.round(inWeek.reduce((s, w) => s + (w.distanceKm ?? 0), 0) * 10) / 10,
    }
  })
}

/** Träningspass i kalendern från `from` till idag som inte loggats än (samma dag och sort). */
export function unloggedPlanned(events: CalendarEvent[], workouts: Workout[], from: ISODate, today: ISODate): CalendarEvent[] {
  return events
    .filter((e) => e.date >= from && e.date <= today && workoutTypeOf(e.title))
    .filter((e) => !workouts.some((w) => w.date === e.date && normalizeType(w.type) === workoutTypeOf(e.title)))
    .sort((a, b) => b.date.localeCompare(a.date))
}
