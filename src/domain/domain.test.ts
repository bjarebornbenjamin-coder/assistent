import { describe, expect, it } from 'vitest'
import { addDays, mondayOf, weekdayOf } from './dates'
import { packingFor, packingTarget } from './packing'
import { lessonsOn, nextLesson } from './schedule'
import type { Lesson, Subject } from './types'
import { anchorFor, weekIndex } from './weekCycle'

const mk = (id: string, subjectId: string, weekday: number, start: string, end: string, weeks: number[] | null = null): Lesson => ({
  id, subjectId, weekday, start, end, room: '', teacher: '', weeks,
})
const subjects: Subject[] = [
  { id: 'ma', name: 'Matte', packItems: [{ id: '1', text: 'miniräknare' }, { id: '2', text: 'mattebok' }] },
  { id: 'sv', name: 'Svenska', packItems: [] },
  { id: 'en', name: 'Engelska', packItems: [{ id: '3', text: 'ordbok' }] },
]

describe('datum', () => {
  it('veckodag och måndag', () => {
    expect(weekdayOf('2026-11-08')).toBe(7) // söndag
    expect(mondayOf('2026-11-08')).toBe('2026-11-02')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('veckocykel', () => {
  const anchor = '2026-11-02' // vecka A
  it('växlar A/B över veckor och årsskiften', () => {
    expect(weekIndex('2026-11-02', anchor, 2)).toBe(0)
    expect(weekIndex('2026-11-08', anchor, 2)).toBe(0) // söndag hör till måndagens vecka
    expect(weekIndex('2026-11-09', anchor, 2)).toBe(1)
    expect(weekIndex('2027-01-04', anchor, 2)).toBe(1) // 9 veckor senare
    expect(weekIndex('2026-10-26', anchor, 2)).toBe(1) // före ankaret
  })
  it('en vecka i cykeln ger alltid 0', () => {
    expect(weekIndex('2030-01-01', anchor, 1)).toBe(0)
  })
  it('anchorFor ger rätt vecka', () => {
    const a = anchorFor('2026-11-11', 1) // denna vecka är B
    expect(weekIndex('2026-11-11', a, 2)).toBe(1)
    expect(weekIndex('2026-11-18', a, 2)).toBe(0)
  })
})

describe('schema', () => {
  const s = { cycleLength: 2, cycleAnchor: '2026-11-02' }
  const lessons = [
    mk('a', 'ma', 1, '10:00', '11:00'),
    mk('b', 'en', 1, '08:00', '09:00', [1]), // bara B-veckor
    mk('c', 'sv', 2, '09:00', '10:00'),
  ]
  it('filtrerar på vecka och sorterar på tid', () => {
    expect(lessonsOn('2026-11-02', lessons, s).map((l) => l.id)).toEqual(['a'])
    expect(lessonsOn('2026-11-09', lessons, s).map((l) => l.id)).toEqual(['b', 'a'])
  })
  it('nästa lektion: pågående, senare idag, senare dag', () => {
    const at = (iso: string) => new Date(iso)
    expect(nextLesson(at('2026-11-09T08:30:00'), lessons, s)).toMatchObject({ lesson: { id: 'b' }, ongoing: true })
    expect(nextLesson(at('2026-11-09T09:30:00'), lessons, s)).toMatchObject({ lesson: { id: 'a' }, ongoing: false })
    expect(nextLesson(at('2026-11-09T12:00:00'), lessons, s)).toMatchObject({ lesson: { id: 'c' }, date: '2026-11-10' })
    expect(nextLesson(at('2026-11-12T12:00:00'), [], s)).toBeNull()
  })
})

describe('packlista', () => {
  it('slår ihop ämnen och hoppar över tomma listor', () => {
    const day = [mk('1', 'ma', 1, '08:00', '09:00'), mk('2', 'sv', 1, '09:00', '10:00'), mk('3', 'ma', 1, '10:00', '11:00')]
    const groups = packingFor(day, subjects)
    expect(groups.map((g) => g.subject.id)).toEqual(['ma'])
    expect(groups[0].items.map((i) => i.text)).toEqual(['miniräknare', 'mattebok'])
  })
  it('målet är idag före sista lektionen, annars nästa lektionsdag', () => {
    const s = { cycleLength: 1, cycleAnchor: '2026-11-02' }
    const lessons = [mk('1', 'ma', 1, '08:00', '09:00'), mk('2', 'en', 3, '08:00', '09:00')]
    expect(packingTarget(new Date('2026-11-09T07:00:00'), lessons, subjects, s)?.date).toBe('2026-11-09')
    expect(packingTarget(new Date('2026-11-09T18:00:00'), lessons, subjects, s)?.date).toBe('2026-11-11')
    expect(packingTarget(new Date('2026-11-09T18:00:00'), [], subjects, s)).toBeNull()
  })
})

import { monthGrid, upcomingEvents, eventsOn, weekDays } from './calendar'
import { isoWeek } from './dates'
import type { CalendarEvent } from './types'

const ev = (id: string, date: string, start?: string, end?: string): CalendarEvent => ({ id, title: id, date, start, end, note: '', updatedAt: '' })

describe('kalender', () => {
  it('ISO-veckonummer', () => {
    expect(isoWeek('2026-11-08')).toBe(45)
    expect(isoWeek('2026-11-09')).toBe(46)
    expect(isoWeek('2027-01-01')).toBe(53) // fredag, hör till 2026 v53
    expect(isoWeek('2024-12-30')).toBe(1)
  })
  it('månadsrutnät börjar på måndag och täcker hela månaden', () => {
    const g = monthGrid(2026, 10) // november 2026, 1:a är söndag
    expect(g[0][0]).toBe('2026-10-26')
    expect(g[0][6]).toBe('2026-11-01')
    expect(g.flat()).toContain('2026-11-30')
    expect(g.length).toBe(6)
    expect(monthGrid(2027, 1).length).toBe(4) // feb 2027 börjar på en måndag och har 28 dagar
    expect(monthGrid(2026, 1).length).toBe(5)
  })
  it('veckodagar', () => {
    expect(weekDays('2026-11-08')[0]).toBe('2026-11-02')
  })
  it('händelser per dag: heldag först', () => {
    const list = eventsOn('2026-11-10', [ev('b', '2026-11-10', '10:00'), ev('a', '2026-11-10'), ev('c', '2026-11-11')])
    expect(list.map((e) => e.id)).toEqual(['a', 'b'])
  })
  it('kommande: hoppar över slutförda och för långt fram', () => {
    const now = new Date('2026-11-10T12:00:00')
    const list = upcomingEvents(now, [
      ev('klar', '2026-11-10', '08:00', '09:00'),
      ev('pågår', '2026-11-10', '11:00', '13:00'),
      ev('heldag', '2026-11-10'),
      ev('imorgon', '2026-11-11', '08:00'),
      ev('dag7', '2026-11-17', '08:00'),
      ev('dag8', '2026-11-18', '08:00'),
      ev('igår', '2026-11-09'),
    ])
    expect(list.map((e) => e.id)).toEqual(['heldag', 'pågår', 'imorgon', 'dag7'])
  })
})
