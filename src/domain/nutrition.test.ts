import { describe, expect, it } from 'vitest'
import { averageOverLogged, goalKcal, lastDays, mealKcal, mealsOn, progress, totalsOf } from './nutrition'
import type { Meal } from './types'

const meal = (id: string, date: string, protein: number, carbs: number, fat: number, over: Partial<Meal> = {}): Meal => ({ id, date, name: id, protein, carbs, fat, source: 'manual', updatedAt: '', ...over })

describe('näring', () => {
  it('kalorier: angivna går före beräknade (4/4/9)', () => {
    expect(mealKcal(meal('a', '2026-11-10', 30, 50, 10))).toBe(410)
    expect(mealKcal(meal('b', '2026-11-10', 30, 50, 10, { kcal: 500 }))).toBe(500)
    expect(mealKcal(meal('c', '2026-11-10', 0, 0, 0, { kcal: 0 }))).toBe(0) // 0 är ett giltigt angivet värde
  })
  it('summerar makron och kalorier', () => {
    expect(totalsOf([meal('a', 'd', 30.5, 50, 10), meal('b', 'd', 20, 25.25, 5, { kcal: 300 })])).toEqual({ kcal: 412 + 300, protein: 50.5, carbs: 75.3, fat: 15 })
    expect(totalsOf([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 })
  })
  it('målets kalorier och andel av mål', () => {
    expect(goalKcal({ proteinG: 120, carbsG: 250, fatG: 70 })).toBe(480 + 1000 + 630)
    expect(progress(50, 100)).toBe(0.5)
    expect(progress(150, 100)).toBe(1)
    expect(progress(10, 0)).toBe(0)
  })
  it('måltider per dag sorterade på tid, utan tid sist', () => {
    const list = mealsOn('2026-11-10', [meal('lunch', '2026-11-10', 1, 1, 1, { time: '12:30' }), meal('annan', '2026-11-11', 1, 1, 1), meal('frukost', '2026-11-10', 1, 1, 1, { time: '08:00' }), meal('snack', '2026-11-10', 1, 1, 1)])
    expect(list.map((m) => m.name)).toEqual(['frukost', 'lunch', 'snack'])
  })
  it('senaste dagar: äldst först, tomma dagar med nollor, vatten per dag', () => {
    const pts = lastDays('2026-11-10', 3, [meal('a', '2026-11-10', 30, 50, 10), meal('b', '2026-11-08', 10, 10, 10)], [{ id: '2026-11-09', date: '2026-11-09', ml: 1500, updatedAt: '' }])
    expect(pts.map((p) => [p.date, p.protein, p.meals, p.waterMl])).toEqual([['2026-11-08', 10, 1, 0], ['2026-11-09', 0, 0, 1500], ['2026-11-10', 30, 1, 0]])
  })
  it('snitt räknas bara över dagar med loggade måltider', () => {
    const pts = lastDays('2026-11-10', 4, [meal('a', '2026-11-10', 100, 200, 50), meal('b', '2026-11-08', 50, 100, 20)], [])
    expect(averageOverLogged(pts)).toEqual({ kcal: Math.round((1650 + 780) / 2), protein: 75, carbs: 150, fat: 35 })
    expect(averageOverLogged(lastDays('2026-11-10', 3, [], []))).toBeNull()
  })
})
