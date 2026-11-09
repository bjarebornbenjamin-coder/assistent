import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { saveEvent, saveLesson } from '../db/repo'
import { applyCard } from './cards'

beforeEach(async () => {
  await Promise.all([db.events.clear(), db.lessons.clear(), db.subjects.clear(), db.tasks.clear(), db.pantry.clear(), db.shopping.clear(), db.meals.clear(), db.water.clear()])
})

describe('applyCard', () => {
  it('ändrar och tar bort händelse, och tar bort start/slut vid heldag', async () => {
    await saveEvent({ id: 'e', title: 'Prov', date: '2026-11-10', start: '09:00', end: '10:00', note: 'n', updatedAt: '' })
    expect(await applyCard({ type: 'event_update', id: 'e', before: '', afterText: '', after: { title: 'Prov', date: '2026-11-11', note: 'n' } })).toBe('done')
    const e = (await db.events.get('e'))!
    expect(e).toMatchObject({ date: '2026-11-11', title: 'Prov' })
    expect(e.start).toBeUndefined()
    expect(e.end).toBeUndefined()
    expect(await applyCard({ type: 'event_delete', id: 'e', summary: '' })).toBe('done')
    expect(await db.events.count()).toBe(0)
  })
  it('lektioner ändras och tas bort; saknade mål ger "missing" utan ändring', async () => {
    await saveLesson({ id: 'l', subjectId: 's', weekday: 1, start: '08:00', end: '09:00', room: 'A', teacher: 'T', weeks: [0] })
    await applyCard({ type: 'lesson_update', id: 'l', before: '', afterText: '', after: { weekday: 2, start: '10:00', end: '11:00', room: 'B', teacher: 'T' } })
    expect(await db.lessons.get('l')).toMatchObject({ weekday: 2, start: '10:00', room: 'B', weeks: [0], subjectId: 's' })
    await applyCard({ type: 'lesson_delete', id: 'l', summary: '' })
    expect(await applyCard({ type: 'lesson_delete', id: 'l', summary: '' })).toBe('missing')
    expect(await applyCard({ type: 'event_delete', id: 'finns-inte', summary: '' })).toBe('missing')
    expect(await applyCard({ type: 'event_update', id: 'finns-inte', before: '', afterText: '', after: { title: 'x', date: '2026-11-11', note: '' } })).toBe('missing')
  })
  it('nya uppgifter och händelser skapas', async () => {
    await applyCard({ type: 'task', task: { title: 'Läxa', deadline: '2026-11-13' } })
    await applyCard({ type: 'event', event: { title: 'Prov', date: '2026-11-13', note: '' } })
    expect(await db.tasks.count()).toBe(1)
    expect(await db.events.count()).toBe(1)
  })
})

describe('applyCard: mat', () => {
  it('lägger på inköpslistan (utan dubbletter), i lagret, och tar bort ur lagret', async () => {
    await applyCard({ type: 'shopping_add', items: [{ name: 'Mjölk', amount: '2 l' }, { name: 'Ägg' }] })
    await applyCard({ type: 'shopping_add', items: [{ name: 'mjölk' }] })
    expect((await db.shopping.toArray()).map((i) => i.name).sort()).toEqual(['Mjölk', 'Ägg'])
    await applyCard({ type: 'pantry_add', items: [{ name: 'Smör', amount: '1 st', expires: '2026-12-01' }, { name: 'Ost' }] })
    const pantry = await db.pantry.toArray()
    expect(pantry.map((p) => p.name).sort()).toEqual(['Ost', 'Smör'])
    const butter = pantry.find((p) => p.name === 'Smör')!
    expect(await applyCard({ type: 'pantry_remove', ids: [butter.id, 'finns-inte'], names: ['Smör'] })).toBe('done')
    expect((await db.pantry.toArray()).map((p) => p.name)).toEqual(['Ost'])
    expect(await applyCard({ type: 'pantry_remove', ids: [butter.id], names: ['Smör'] })).toBe('missing')
  })
})

describe('applyCard: kost', () => {
  it('loggar måltid som AI-uppskattad och lägger till vatten (flera gånger summeras)', async () => {
    await applyCard({ type: 'meal_add', meal: { date: '2026-11-10', name: 'Gröt', protein: 12, carbs: 60, fat: 8, time: '08:00' } })
    const m = (await db.meals.toArray())[0]
    expect(m).toMatchObject({ name: 'Gröt', source: 'ai', date: '2026-11-10', time: '08:00', protein: 12 })
    await applyCard({ type: 'water_add', date: '2026-11-10', ml: 500 })
    await applyCard({ type: 'water_add', date: '2026-11-10', ml: 250 })
    expect((await db.water.get('2026-11-10'))?.ml).toBe(750)
  })
})

describe('applyCard: flera händelser', () => {
  it('lägger in alla händelser med nya id:n', async () => {
    await applyCard({ type: 'events_add', events: [{ title: 'Gym', date: '2026-11-11', start: '17:00', end: '18:00', note: '' }, { title: 'Löpning', date: '2026-11-13', note: '5 km' }] })
    const events = await db.events.toArray()
    expect(events.map((e) => e.title).sort()).toEqual(['Gym', 'Löpning'])
    expect(new Set(events.map((e) => e.id)).size).toBe(2)
    expect(events.find((e) => e.title === 'Löpning')).toMatchObject({ date: '2026-11-13', note: '5 km' })
  })
})
