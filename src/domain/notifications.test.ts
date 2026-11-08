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
const notify = (o = {}) => ({ evening: true, eveningTime: '20:00', before: false, beforeMinutes: 10, ...o })

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
