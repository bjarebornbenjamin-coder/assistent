import { describe, expect, it } from 'vitest'
import { focusFor, planStudy } from './study'
import type { Lesson } from './types'

const settings = { cycleLength: 1, cycleAnchor: '2026-11-02' }
// Måndag–fredag 08:00–15:00
const lessons: Lesson[] = [1, 2, 3, 4, 5].map((wd) => ({ id: `l${wd}`, subjectId: 'ma', weekday: wd, start: '08:00', end: '15:00', room: '', teacher: '', weeks: null }))

describe('studieplanering', () => {
  it('lägger ett pass per moment plus repetition, efter skolan, sista dagen före provet', () => {
    const plan = planStudy({ exam: 'Matte', examDate: '2026-11-20', topics: ['Derivata', 'Integraler', 'Gränsvärden'], from: '2026-11-10', lessons, events: [], settings })
    expect(plan.sessions.map((s) => s.focus)).toEqual(['Derivata', 'Integraler', 'Gränsvärden', 'Repetition av allt och gamla prov'])
    expect(plan.sessions.at(-1)!.date).toBe('2026-11-19')
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(4)
    expect(plan.sessions.filter((s) => s.date >= '2026-11-10' && ['2026-11-14', '2026-11-15'].indexOf(s.date) < 0).every((s) => s.start >= '15:30')).toBe(true)
    expect(plan.warnings).toEqual([])
  })

  it('går runt händelser och varnar när tiden inte räcker', () => {
    const events = [{ id: 'e', title: 'Fotboll', date: '2026-11-11', start: '15:00', end: '21:00', note: '', updatedAt: '' }]
    const plan = planStudy({ exam: 'Kemi', examDate: '2026-11-12', topics: ['A', 'B', 'C'], from: '2026-11-10', lessons, events, settings, sessions: 3 })
    expect(plan.sessions.map((s) => s.date)).toEqual(['2026-11-10'])
    expect(plan.warnings.join(' ')).toMatch(/bara lediga tider för 1 av 3/)
  })

  it('börjar inte bakåt i tiden idag och tomt om provet redan varit', () => {
    const plan = planStudy({ exam: 'Engelska', examDate: '2026-11-12', topics: [], from: '2026-11-10', nowTime: '19:00', lessons, events: [], settings })
    expect(plan.sessions[0]).toMatchObject({ date: '2026-11-10', start: '19:15' })
    expect(planStudy({ exam: 'X', examDate: '2026-11-10', topics: [], from: '2026-11-10', lessons, events: [], settings }).sessions).toEqual([])
  })

  it('slår ihop moment när passen är färre', () => {
    expect(focusFor(['a', 'b', 'c', 'd'], 2)).toEqual(['a, b', 'c, d'])
    expect(focusFor(['a'], 4)).toEqual(['a', 'Repetera a', 'Repetera a', 'Repetition av allt och gamla prov'])
  })
})
