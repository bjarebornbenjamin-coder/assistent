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
  it('samma sak i två ämnen visas en gång (skiftlägesokänsligt)', () => {
    const subs: Subject[] = [
      { id: 'a', name: 'A', packItems: [{ id: '1', text: 'Dator' }, { id: '2', text: 'Penna' }] },
      { id: 'b', name: 'B', packItems: [{ id: '3', text: ' dator ' }] },
      { id: 'c', name: 'C', packItems: [{ id: '4', text: 'Bok' }, { id: '5', text: 'bok' }] },
    ]
    const groups = packingFor([mk('1', 'a', 1, '08:00', '09:00'), mk('2', 'b', 1, '09:00', '10:00'), mk('3', 'c', 1, '10:00', '11:00')], subs)
    expect(groups.map((g) => [g.subject.id, g.items.map((i) => i.text)])).toEqual([['a', ['Dator', 'Penna']], ['c', ['Bok']]])
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

import { findConflicts } from './schedule'

describe('krockar', () => {
  const spanish = mk('es', 'sp', 1, '08:20', '09:40')
  const cand = (start: string, end: string, weeks: number[] | null = null, weekday = 1, id = 'new') => ({ id, weekday, start, end, weeks })
  it('hittar överlapp men inte lektioner som bara tangerar', () => {
    expect(findConflicts(cand('09:00', '10:00'), [spanish], 1).map((l) => l.id)).toEqual(['es'])
    expect(findConflicts(cand('09:40', '10:30'), [spanish], 1)).toEqual([])
    expect(findConflicts(cand('07:00', '08:20'), [spanish], 1)).toEqual([])
    expect(findConflicts(cand('09:00', '10:00', null, 2), [spanish], 1)).toEqual([])
  })
  it('tar hänsyn till A/B-veckor och ignorerar sig själv', () => {
    const onlyA = mk('a', 'sp', 1, '08:00', '09:00', [0])
    expect(findConflicts(cand('08:30', '09:30', [1]), [onlyA], 2)).toEqual([])
    expect(findConflicts(cand('08:30', '09:30', [0, 1]), [onlyA], 2)).toHaveLength(1)
    expect(findConflicts(cand('08:30', '09:30', null), [onlyA], 2)).toHaveLength(1)
    expect(findConflicts(cand('08:30', '09:30', null, 1, 'a'), [onlyA], 2)).toEqual([])
  })
})

import { describeNext, formatDuration } from './schedule'

describe('nedräkning', () => {
  it('formaterar tid', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(60)).toBe('1 h')
    expect(formatDuration(80)).toBe('1 h 20 min')
  })
  it('beskriver pågående, senare idag och andra dagar', () => {
    const lesson = mk('l', 'ma', 1, '09:40', '10:30')
    const at = (iso: string, date: string, ongoing = false) => describeNext(new Date(iso), { lesson, date, ongoing })
    expect(at('2026-11-09T10:00:00', '2026-11-09', true)).toBe('Pågår nu – slutar 10:30')
    expect(at('2026-11-09T08:20:00', '2026-11-09')).toBe('Nästa lektion om 1 h 20 min')
    expect(at('2026-11-09T09:35:00', '2026-11-09')).toBe('Nästa lektion om 5 min')
    expect(at('2026-11-09T18:00:00', '2026-11-10')).toBe('Nästa lektion imorgon kl 09:40')
    expect(at('2026-11-09T18:00:00', '2026-11-12')).toBe('Nästa lektion på torsdag (12 nov) kl 09:40')
    expect(at('2026-11-09T19:00:00', '2026-11-16')).toBe('Nästa lektion nästa måndag (16 nov) kl 09:40') // testarens fall
  })
})

import { isOverdue, tasksOn, upcomingTasks } from './tasks'
import type { Task } from './types'

const tk = (id: string, deadline: string, done = false): Task => ({ id, title: id, deadline, done, updatedAt: '' })

describe('uppgifter', () => {
  const now = new Date('2026-11-10T12:00:00')
  it('kommande: försenade först, inte klara, inte för långt fram', () => {
    const list = upcomingTasks(now, [tk('sen', '2026-11-08'), tk('idag', '2026-11-10'), tk('klar', '2026-11-10', true), tk('dag7', '2026-11-17'), tk('dag8', '2026-11-18')])
    expect(list.map((t) => t.id)).toEqual(['sen', 'idag', 'dag7'])
  })
  it('per dag och försenad', () => {
    expect(tasksOn('2026-11-10', [tk('a', '2026-11-10', true), tk('b', '2026-11-10'), tk('c', '2026-11-11')]).map((t) => t.id)).toEqual(['b', 'a'])
    expect(isOverdue(tk('x', '2026-11-09'), '2026-11-10')).toBe(true)
    expect(isOverdue(tk('x', '2026-11-09', true), '2026-11-10')).toBe(false)
  })
})

describe('uppgifter med klockslag', async () => {
  const { dueLabel, upcomingTasks } = await import('./tasks')
  it('visar klockslag och sorterar dagens uppgifter på tid, utan tid sist', () => {
    expect(dueLabel({ deadline: '2026-11-10', time: '23:59' }, '2026-11-09')).toBe('Imorgon 23:59')
    expect(dueLabel({ deadline: '2026-11-10' }, '2026-11-09')).toBe('Imorgon')
    const t = (id: string, time?: string) => ({ id, title: id, deadline: '2026-11-10', done: false, updatedAt: '', ...(time ? { time } : {}) })
    expect(upcomingTasks(new Date('2026-11-09T12:00:00'), [t('c'), t('b', '15:00'), t('a', '08:00')]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('agenda och sökning i kalendern', async () => {
  const { agenda } = await import('./calendar')
  const ev = (id: string, title: string, date: string, start?: string) => ({ id, title, date, note: '', updatedAt: '', ...(start ? { start } : {}) })
  const events = [ev('a', 'Matteprov', '2026-10-01'), ev('b', 'Matteprov kap 4', '2026-11-20'), ev('c', 'Fotboll', '2026-11-10', '18:00'), ev('d', 'Bio', '2027-03-01')]
  const tasks = [{ id: 't', title: 'Labbrapport', subjectId: 'fy', deadline: '2026-11-10', time: '23:59', done: false, updatedAt: '' }]
  it('utan sökord: kommande 60 dagar i tidsordning', () => {
    expect(agenda('', events, tasks, '2026-11-09').map((i) => (i.kind === 'event' ? i.event.id : i.task.id))).toEqual(['c', 't', 'b'])
  })
  it('söker i titel och ämne, kommande först och sedan tidigare', () => {
    expect(agenda('MATTEPROV', events, tasks, '2026-11-09').map((i) => i.date)).toEqual(['2026-11-20', '2026-10-01'])
    expect(agenda('fysik', events, tasks, '2026-11-09', { subjectName: (id) => (id === 'fy' ? 'Fysik' : undefined) })).toHaveLength(1)
    expect(agenda('matteprov kap', events, tasks, '2026-11-09')).toHaveLength(1)
  })
})

describe('packlista med händelser', async () => {
  const { packingTarget } = await import('./packing')
  const ev = (id: string, date: string, start: string | undefined, items: string[]) => ({ id, title: id, date, ...(start ? { start } : {}), note: '', packItems: items, updatedAt: '' })
  it('idag gäller tills händelsen börjat, sedan nästa dag med lektioner eller händelser', () => {
    const s = { cycleLength: 1, cycleAnchor: '2026-11-02' }
    const events = [ev('Gym', '2026-11-10', '17:00', ['Gymkort']), ev('Utflykt', '2026-11-12', undefined, ['Matsäck'])]
    const t1 = packingTarget(new Date('2026-11-10T15:00:00'), [], [], s, events)!
    expect([t1.date, t1.events.map((e) => e.items)]).toEqual(['2026-11-10', [['Gymkort']]])
    const t2 = packingTarget(new Date('2026-11-10T18:00:00'), [], [], s, events)!
    expect([t2.date, t2.events[0].event.id]).toEqual(['2026-11-12', 'Utflykt'])
  })
})
