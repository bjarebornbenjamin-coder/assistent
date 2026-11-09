import { describe, expect, it } from 'vitest'
import { dayContext, fetchMealPlan, missingForPlan, parseMealPlan, planStart } from './mealPlan'
import type { PantryItem, PlannedDinner } from '../domain/types'

const settings = { cycleLength: 1, cycleAnchor: '2026-11-02' }
const pantry: PantryItem[] = [{ id: 'p', name: 'Kycklingfilé', amount: '500 g', addedAt: '2026-11-01', source: 'manual', updatedAt: '' }]
const dinner = (date: string, title: string, ingredients: { name: string; amount: string }[]): PlannedDinner => ({ id: date, date, title, reason: '', portions: 2, minutes: 30, ingredients, steps: ['Laga'], updatedAt: '' })

describe('veckomeny', () => {
  it('beskriver dagen: sen skola, kvällsaktivitet och träning ger snabb middag', () => {
    const lessons = [{ id: 'l', subjectId: 's', weekday: 2, start: '13:00', end: '16:40', room: '', teacher: '', weeks: null }]
    const events = [{ id: 'e', title: 'Gym', date: '2026-11-11', start: '18:00', end: '19:00', note: '', updatedAt: '' }]
    expect(dayContext('2026-11-10', lessons, [], settings)).toMatchObject({ weekday: 'tisdag', schoolEnds: '16:40', quick: true, training: false })
    expect(dayContext('2026-11-11', lessons, events, settings)).toMatchObject({ evening: ['Gym 18:00–19:00'], training: true, quick: true })
    expect(dayContext('2026-11-12', lessons, events, settings)).toMatchObject({ quick: false, training: false })
  })

  it('tar bara begärda datum, ett per dag, och kräver ingredienser och steg', () => {
    const text = JSON.stringify({
      days: [
        { date: '2026-11-10', title: 'Pasta carbonara', ingredients: [{ name: 'Pasta', amount: '200 g' }], steps: ['Koka'], nutrition: { kcal: 600, protein: 25, carbs: 70, fat: 22 } },
        { date: '2026-11-10', title: 'Dubblett', ingredients: [{ name: 'X', amount: '1 st' }], steps: ['Y'] },
        { date: '2026-12-01', title: 'Fel datum', ingredients: [{ name: 'X', amount: '1 st' }], steps: ['Y'] },
        { date: '2026-11-11', title: 'Tom', ingredients: [], steps: ['Y'] },
      ],
    })
    const plan = parseMealPlan(text, ['2026-11-10', '2026-11-11'], 2)
    expect(plan.map((d) => d.title)).toEqual(['Pasta carbonara'])
    expect(plan[0]).toMatchObject({ id: '2026-11-10', portions: 2, nutrition: { kcal: 600 } })
    expect(() => parseMealPlan('inte json', ['2026-11-10'], 2)).toThrow(/tolka/)
  })

  it('slår ihop det som saknas över veckan och hoppar över det som finns hemma', () => {
    const plan = [
      dinner('2026-11-10', 'Kycklinggryta', [{ name: 'Kycklingfilé', amount: '400 g' }, { name: 'Grädde', amount: '2 dl' }, { name: 'Salt', amount: '1 tsk' }]),
      dinner('2026-11-12', 'Laxpasta', [{ name: 'grädde', amount: '1,5 dl' }, { name: 'Lax', amount: '300 g' }]),
    ]
    expect(missingForPlan(plan, pantry)).toEqual([
      { name: 'Grädde', amount: '3,5 dl', note: 'Veckomeny: Kycklinggryta, Laxpasta' },
      { name: 'Lax', amount: '300 g', note: 'Veckomeny: Laxpasta' },
    ])
  })

  it('börjar idag före 17, annars imorgon, och skickar dagarna till servern', async () => {
    expect(planStart('2026-11-10', '16:59')).toBe('2026-11-10')
    expect(planStart('2026-11-10', '17:00')).toBe('2026-11-11')
    let sent = ''
    const fetchFn = (async (_url: string, init: RequestInit) => {
      sent = String(init.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ days: [{ date: '2026-11-10', title: 'Chili con carne', ingredients: [{ name: 'Köttfärs', amount: '500 g' }], steps: ['Bryn'] }] }) } }] }), { status: 200 })
    }) as typeof fetch
    const plan = await fetchMealPlan({ days: [dayContext('2026-11-10', [], [], settings)], pantry, food: { allergies: '', portions: 4 }, goals: { proteinG: 120, carbsG: 250, fatG: 70, waterMl: 2000, glassMl: 250 }, memories: ['Gillar inte svamp'], recent: [], today: '2026-11-10' }, 'gpt-4o-mini', {}, fetchFn)
    expect(plan[0]).toMatchObject({ title: 'Chili con carne', portions: 4 })
    expect(sent).toContain('Gillar inte svamp')
    expect(JSON.parse(sent).response_format).toEqual({ type: 'json_object' })
  })
})
