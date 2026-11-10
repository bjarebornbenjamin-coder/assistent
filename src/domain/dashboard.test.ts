import { describe, expect, it } from 'vitest'
import { dayTimeline, share } from './dashboard'

const settings = { cycleLength: 1, cycleAnchor: '2026-11-02' }
const data = {
  settings,
  subjects: [{ id: 'ma', name: 'Matte', color: '#1a73e8', packItems: [] }],
  lessons: [{ id: 'l1', subjectId: 'ma', weekday: 2, start: '08:20', end: '09:40', room: 'B2', teacher: '', weeks: null }, { id: 'l2', subjectId: 'ma', weekday: 2, start: '13:00', end: '14:00', room: '', teacher: '', weeks: null }],
  events: [{ id: 'e', title: 'Fotboll', date: '2026-11-10', start: '18:00', end: '19:30', note: '', updatedAt: '' }, { id: 'h', title: 'Studiedag', date: '2026-11-10', note: '', updatedAt: '' }],
  tasks: [{ id: 't', title: 'Essä', subjectId: 'ma', deadline: '2026-11-10', time: '23:59', done: false, updatedAt: '' }],
  reminders: [{ id: 'r', title: 'Vitaminer', time: '21:00', repeat: { kind: 'daily' as const }, enabled: true, updatedAt: '' }],
}

describe('dagens tidslinje', () => {
  it('sorterar allt efter tid och markerar passerat och pågående', () => {
    const t = dayTimeline('2026-11-10', '13:30', data)
    expect(t.map((i) => [i.title, i.timeLabel, i.past, i.ongoing])).toEqual([
      ['Studiedag', 'Heldag', false, false],
      ['Matte', '08:20–09:40', true, false],
      ['Matte', '13:00–14:00', false, true],
      ['Fotboll', '18:00–19:30', false, false],
      ['Vitaminer', '21:00', false, false],
      ['Essä', 'Inne 23:59', false, false],
    ])
    expect(t[1]).toMatchObject({ sub: 'Sal B2', color: '#1a73e8' })
  })
  it('andra dagar markeras inget som passerat', () => {
    expect(dayTimeline('2026-11-17', null, data).every((i) => !i.past)).toBe(true)
  })
  it('andel av mål stannar mellan 0 och 1', () => {
    expect([share(50, 100), share(150, 100), share(5, 0)]).toEqual([0.5, 1, 0])
  })
})
