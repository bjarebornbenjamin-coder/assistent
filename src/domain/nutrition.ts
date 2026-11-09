import { addDays } from './dates'
import type { ISODate, Meal, NutritionSettings, WaterDay } from './types'

export interface Totals {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/** Kalorier för en måltid: angivna, annars beräknade från makron (4/4/9). */
export const mealKcal = (m: Pick<Meal, 'kcal' | 'protein' | 'carbs' | 'fat'>): number =>
  Math.round(m.kcal ?? m.protein * 4 + m.carbs * 4 + m.fat * 9)

const round1 = (n: number) => Math.round(n * 10) / 10

export function totalsOf(meals: Meal[]): Totals {
  return {
    kcal: meals.reduce((s, m) => s + mealKcal(m), 0),
    protein: round1(meals.reduce((s, m) => s + m.protein, 0)),
    carbs: round1(meals.reduce((s, m) => s + m.carbs, 0)),
    fat: round1(meals.reduce((s, m) => s + m.fat, 0)),
  }
}

/** Målets kalorier, beräknade från makromålen. */
export const goalKcal = (g: Pick<NutritionSettings, 'proteinG' | 'carbsG' | 'fatG'>): number => g.proteinG * 4 + g.carbsG * 4 + g.fatG * 9

export function mealsOn(date: ISODate, meals: Meal[]): Meal[] {
  return meals.filter((m) => m.date === date).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.name.localeCompare(b.name, 'sv'))
}

export interface DayPoint extends Totals {
  date: ISODate
  waterMl: number
  /** Antal loggade måltider, så att en tom dag skiljs från en dag med noll. */
  meals: number
}

/** De `days` senaste dagarna fram till och med `end`, äldst först. Dagar utan data får nollor. */
export function lastDays(end: ISODate, days: number, meals: Meal[], water: WaterDay[]): DayPoint[] {
  const waterByDate = new Map(water.map((w) => [w.date, w.ml]))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(end, i - (days - 1))
    const dayMeals = meals.filter((m) => m.date === date)
    return { date, ...totalsOf(dayMeals), waterMl: waterByDate.get(date) ?? 0, meals: dayMeals.length }
  })
}

/** Genomsnitt över dagar som har loggade måltider (tomma dagar drar inte ner snittet). */
export function averageOverLogged(points: DayPoint[]): Totals | null {
  const logged = points.filter((p) => p.meals > 0)
  if (logged.length === 0) return null
  const avg = (f: (p: DayPoint) => number) => Math.round((logged.reduce((s, p) => s + f(p), 0) / logged.length) * 10) / 10
  return { kcal: Math.round(avg((p) => p.kcal)), protein: avg((p) => p.protein), carbs: avg((p) => p.carbs), fat: avg((p) => p.fat) }
}

/** Andel av målet, begränsad uppåt för staplar (värdet över 100 % visas i text). */
export const progress = (value: number, goal: number): number => (goal > 0 ? Math.min(1, value / goal) : 0)
