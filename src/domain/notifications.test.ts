import { describe, expect, it } from 'vitest'
import { planNotifications } from './notifications'
import type { Lesson, Subject } from './types'

const subjects: Subject[] = [
  { id: 'es', name: 'Spanska', packItems: [{ id: '1', text: 'Bok' }, { id: '2', text: 'Dator' }, { id: '3', text: 'Penna' }] },
  { id: 'ma', name: 'Matte', packItems: [] },
]
const lesson = (id: string, subjectId: string, weekday: number, start: string, end: string, room = ''): Lesson => ({ id, subjectId, weekday, start, end, room, teacher: '', weeks: null })
const lessons = [lesson('a', 'es', 1, '08:20', '09:40', 'A1'), lesson('b', 'ma', 1, '10:00', '11:00'), lesson('c', 'ma', 3, '09:00', '10:00')]
const base = { cycleLength: 1, cycleAnchor: '2026-11-02' }
const notify = (o = {}) => ({ evening: true, eveningTime: '20:00', before: false, beforeMinutes: 10, morning: false, morningTime: '07:00', ...o })

describe('planNotifications', () => {
  const now = new Date('2026-11-08T12:00:00') // söndag

  it('kvällsnotis kvällen före, med första lektionen och packlista', () => {
    const [first] = planNotifications(now, { ...base, notify: notify() }, lessons, subjects, 7)
    expect(first).toMatchObject({ id: 'evening:2026-11-09', title: 'Imorgon: Spanska 08:20 (+1 till)', body: 'Ta med bok, dator, penna' })
    expect(first.fireAt).toEqual(new Date('2026-11-08T20:00:00'))
  })
  it('hoppar över dagar utan lektioner och notiser som redan passerat', () => {
    const list = planNotifications(new Date('2026-11-08T21:00:00'), { ...base, notify: notify() }, lessons, subjects, 8)
    expect(list.map((n) => n.id)).toEqual(['evening:2026-11-11', 'evening:2026-11-16']) // måndag 9:e passerad; ons 11:e → tisdagskväll
    expect(list[0].fireAt).toEqual(new Date('2026-11-10T20:00:00'))
  })
  it('dag utan packlista får ett tydligt meddelande', () => {
    const wed = planNotifications(now, { ...base, notify: notify() }, lessons, subjects, 7).find((n) => n.id === 'evening:2026-11-11')!
    expect(wed).toMatchObject({ title: 'Imorgon: Matte 09:00', body: 'Inget att packa enligt dina packlistor.' })
  })
  it('notis före varje lektion', () => {
    const list = planNotifications(now, { ...base, notify: notify({ evening: false, before: true, beforeMinutes: 15 }) }, lessons, subjects, 1)
    expect(list.map((n) => [n.id, n.title, n.body])).toEqual([
      ['before:2026-11-09:a', 'Spanska om 15 min', 'Kl 08:20, sal A1'],
      ['before:2026-11-09:b', 'Matte om 15 min', 'Kl 10:00'],
    ])
    expect(list[0].fireAt).toEqual(new Date('2026-11-09T08:05:00'))
  })
  it('allt avstängt ger inga notiser; A/B-veckor respekteras', () => {
    expect(planNotifications(now, { ...base, notify: notify({ evening: false }) }, lessons, subjects)).toEqual([])
    const onlyB = [{ ...lessons[0], weeks: [1] }]
    const ab = { cycleLength: 2, cycleAnchor: '2026-11-09' } // vecka som börjar 9/11 är A
    const ids = planNotifications(now, { ...ab, notify: notify() }, onlyB, subjects, 14).map((n) => n.id)
    expect(ids).toEqual(['evening:2026-11-16'])
  })
})

describe('mat-notiser', () => {
  const food = { allergies: '', portions: 2, shopping: { enabled: true, weekday: 5, time: '16:00' }, expiry: { enabled: true, time: '08:00' } }
  const settings = { ...s0(), food }
  function s0() { return { cycleLength: 1, cycleAnchor: '2026-11-02', notify: { evening: false, eveningTime: '20:00', before: false, beforeMinutes: 10, morning: false, morningTime: '07:00' } } }
  const item = (name: string, expires?: string) => ({ id: name, name, expires, addedAt: '2026-11-01', source: 'manual' as const, updatedAt: '' })
  const buy = (name: string, done = false) => ({ id: name, name, done, addedAt: '2026-11-01', updatedAt: '' })
  const now = new Date('2026-11-10T12:00:00') // tisdag

  it('utgångsnotis dagen varan går ut och dagen före, sorterad, och inte för tider som passerat', () => {
    const plan = planNotifications(now, settings, [], [], 3, [], { pantry: [item('Mjölk', '2026-11-12'), item('Yoghurt', '2026-11-11'), item('Ris', '2027-01-01'), item('Gammal', '2026-11-01')], shopping: [] })
    const exp = plan.filter((n) => n.id.startsWith('expiry:'))
    // idag 08:00 har redan passerat, så första är i morgon
    expect(exp.map((n) => n.id)).toEqual(['expiry:2026-11-11', 'expiry:2026-11-12'])
    expect(exp[0]).toMatchObject({ title: 'Mat som snart går ut', body: 'Yoghurt (idag), Mjölk (imorgon)' })
    expect(exp[1].body).toBe('Mjölk (idag)')
    expect(exp[0].fireAt).toEqual(new Date('2026-11-11T08:00:00'))
  })
  it('hoppar över passerad tid idag och avstängd notis', () => {
    const late = new Date('2026-11-10T09:00:00')
    expect(planNotifications(late, settings, [], [], 0, [], { pantry: [item('Mjölk', '2026-11-10')], shopping: [] })).toEqual([])
    const off = { ...settings, food: { ...food, expiry: { ...food.expiry, enabled: false } } }
    expect(planNotifications(now, off, [], [], 3, [], { pantry: [item('Mjölk', '2026-11-11')], shopping: [] })).toEqual([])
  })
  it('inköpsnotis på vald veckodag med antal och namn, bara om listan har något', () => {
    const shopping = [buy('Mjölk'), buy('Ägg'), buy('Bröd', true)]
    const plan = planNotifications(now, settings, [], [], 7, [], { pantry: [], shopping })
    const shop = plan.filter((n) => n.id.startsWith('shopping:'))
    expect(shop.map((n) => n.id)).toEqual(['shopping:2026-11-13']) // fredag
    expect(shop[0]).toMatchObject({ title: 'Inköpslistan: 2 varor', body: 'Mjölk, Ägg' })
    expect(shop[0].fireAt).toEqual(new Date('2026-11-13T16:00:00'))
    expect(planNotifications(now, settings, [], [], 7, [], { pantry: [], shopping: [buy('Bröd', true)] })).toEqual([])
    expect(planNotifications(now, settings, [], [], 7, [], { pantry: [], shopping: [buy('Ost')] })[0].title).toBe('Inköpslistan: 1 vara')
  })
  it('många varor kortas med "+N till"', () => {
    const shopping = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((n) => buy(n))
    expect(planNotifications(now, settings, [], [], 7, [], { pantry: [], shopping })[0].body).toBe('a, b, c, d, e, f +2 till')
  })
})

describe('morgonöversikt', () => {
  const now = new Date('2026-11-08T12:00:00') // söndag
  const s = { ...base, notify: notify({ evening: false, morning: true }) }
  const tasks = [
    { id: 't1', title: 'Essä', deadline: '2026-11-09', time: '23:59', done: false, updatedAt: '' },
    { id: 't2', title: 'Läxa', deadline: '2026-11-07', done: false, updatedAt: '' },
  ]
  const events = [{ id: 'e', title: 'Fotboll', date: '2026-11-09', start: '18:00', end: '19:30', note: '', updatedAt: '' }]
  const pantry = [{ id: 'p', name: 'Mjölk', expires: '2026-11-09', addedAt: '2026-11-01', source: 'manual' as const, updatedAt: '' }]

  it('samlar dagens lektioner, packlista, deadlines, händelser och mat som går ut', () => {
    const list = planNotifications(now, s, lessons, subjects, 1, [], { pantry, shopping: [] }, { events, tasks })
    const m = list.find((n) => n.id === 'morning:2026-11-09')!
    expect(m.fireAt).toEqual(new Date('2026-11-09T07:00:00'))
    expect(m.title).toBe('Idag: Spanska 08:20, slutar 11:00')
    expect(m.body.split('\n')).toEqual([
      'Lektioner: Spanska 08:20, Matte 10:00',
      'Ta med: bok, dator, penna',
      'Ska in: Essä 23:59',
      'Försenat: Läxa',
      'Händelser: Fotboll 18:00–19:30',
      'Ät idag: Mjölk (går ut)',
    ])
  })
  it('skickas inte tomma dagar', () => {
    const ids = planNotifications(now, s, lessons, subjects, 3).map((n) => n.id)
    expect(ids).toEqual(['morning:2026-11-09', 'morning:2026-11-11'])
  })
})

describe('packlistor för händelser', () => {
  const now = new Date('2026-11-08T12:00:00') // söndag
  const events = [{ id: 'f', title: 'Fotboll', date: '2026-11-10', start: '18:00', note: '', packItems: ['Fotbollsskor', 'Bok'], updatedAt: '' }]
  it('kvällsnotis även dagar utan lektioner, och inga dubbletter mot ämnenas listor', () => {
    const list = planNotifications(now, { ...base, notify: notify() }, lessons, subjects, 3, [], { pantry: [], shopping: [] }, { events, tasks: [] })
    expect(list.find((n) => n.id === 'evening:2026-11-10')).toMatchObject({ title: 'Imorgon: Fotboll 18:00', body: 'Ta med fotbollsskor, bok' })
    const mon = [{ ...events[0], date: '2026-11-09' }]
    const m = planNotifications(now, { ...base, notify: notify({ evening: false, morning: true }) }, lessons, subjects, 1, [], { pantry: [], shopping: [] }, { events: mon, tasks: [] })
    expect(m[0].body.split('\n')[1]).toBe('Ta med: bok, dator, penna, fotbollsskor')
  })
})
