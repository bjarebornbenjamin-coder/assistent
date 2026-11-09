import { describe, expect, it } from 'vitest'
import { addDays, daysBetween } from './dates'
import { normalizeType, planWorkouts, workoutTypeOf, type PlanInput } from './training'
import type { CalendarEvent, Lesson } from './types'

const lesson = (id: string, weekday: number, start: string, end: string): Lesson => ({ id, subjectId: 's', weekday, start, end, room: '', teacher: '', weeks: null })
const ev = (id: string, title: string, date: string, start?: string, end?: string): CalendarEvent => ({ id, title, date, start, end, note: '', updatedAt: '' })
const base: Pick<PlanInput, 'lessons' | 'events' | 'tasks' | 'settings'> = { lessons: [], events: [], tasks: [], settings: { cycleLength: 1, cycleAnchor: '2026-11-02' } }
// 2026-11-11 är en onsdag
const FROM = '2026-11-11'

const idx = (plan: { sessions: { date: string }[] }) => plan.sessions.map((s) => daysBetween(FROM, s.date))
const maxRun = (days: number[], pre: number[] = []) => {
  const all = new Set([...pre, ...days])
  let run = 0
  let best = 0
  for (let i = -3; i < 20; i++) {
    run = all.has(i) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

describe('träningsplanerare', () => {
  it('användarens fall: tre pass på lediga dagar läggs INTE tre dagar i rad', () => {
    // Skola bara mån–tis; ons–sön är helt lediga, så en naiv plan tar ons–tors–fre.
    const input: PlanInput = { ...base, from: FROM, days: 7, lessons: [lesson('a', 1, '08:00', '15:00'), lesson('b', 2, '08:00', '15:00')], sessions: [{ type: 'gym', count: 3 }] }
    const plan = planWorkouts(input)
    const days = idx(plan)
    expect(days).toHaveLength(3)
    expect(maxRun(days)).toBeLessThanOrEqual(2)
    const gaps = days.slice(1).map((d, i) => d - days[i])
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(2) // minst en vilodag mellan gympassen
    expect(plan.warnings).toEqual([])
    expect(plan.sessions.every((s) => /vilodag dagen före|vila dagen efter/.test(s.why))).toBe(true)
  })

  it('gym och löpning hamnar aldrig samma dag, och samma sort aldrig dag efter dag', () => {
    const plan = planWorkouts({ ...base, from: FROM, days: 7, sessions: [{ type: 'gym', count: 2 }, { type: 'springa', count: 2 }] })
    expect(plan.sessions).toHaveLength(4)
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(4) // ett pass per dag
    const byDate = new Map(plan.sessions.map((s) => [daysBetween(FROM, s.date), s.type]))
    for (const [d, t] of byDate) expect(byDate.get(d + 1)).not.toBe(t)
    expect(maxRun(idx(plan))).toBeLessThanOrEqual(2)
    expect(plan.sessions.filter((s) => s.type === 'gym')).toHaveLength(2)
    expect(plan.sessions.filter((s) => s.type === 'löpning')).toHaveLength(2) // "springa" blir löpning
  })

  it('räknar med träningspass som redan ligger i kalendern', () => {
    const events = [ev('g', 'Gym', '2026-11-12', '17:00', '18:00')] // torsdag
    const plan = planWorkouts({ ...base, from: FROM, days: 7, events, sessions: [{ type: 'gym', count: 2 }] })
    expect(plan.existing).toEqual([{ date: '2026-11-12', type: 'gym', title: 'Gym' }])
    const days = idx(plan)
    expect(days).not.toContain(0) // onsdag och fredag är intill torsdagens gympass
    expect(days).not.toContain(2)
    expect(days).not.toContain(1) // själva torsdagen är upptagen
    expect(maxRun([...days, 1])).toBeLessThanOrEqual(2)
  })

  it('tar hänsyn till pass dagarna före periodens start (inte 3 i rad över gränsen)', () => {
    const events = [ev('a', 'Löpning', '2026-11-09', '17:00', '18:00'), ev('b', 'Gym', '2026-11-10', '17:00', '18:00')] // mån, tis
    const plan = planWorkouts({ ...base, from: FROM, days: 3, events, sessions: [{ type: 'gym', count: 1 }] })
    expect(idx(plan)).not.toContain(0) // onsdag skulle bli tredje dagen i rad
  })

  it('för många pass: varnar och begränsar utan att bryta reglerna', () => {
    const plan = planWorkouts({ ...base, from: FROM, days: 7, sessions: [{ type: 'gym', count: 4 }, { type: 'löpning', count: 3 }] })
    expect(plan.sessions.length).toBeLessThan(7)
    expect(plan.sessions.length).toBeLessThanOrEqual(5)
    expect(plan.warnings.join(' ')).toMatch(/går inte att lägga 7 pass/)
    expect(maxRun(idx(plan))).toBeLessThanOrEqual(2)
  })

  it('undviker dagen före prov och avstängda veckodagar', () => {
    const events = [ev('p', 'Prov i matte', '2026-11-13', '09:00', '10:00')] // fredag, så torsdag undviks
    const plan = planWorkouts({ ...base, from: FROM, days: 7, events, sessions: [{ type: 'gym', count: 2 }], avoidWeekdays: [7] })
    const dates = plan.sessions.map((s) => s.date)
    expect(dates).not.toContain('2026-11-12')
    expect(dates).not.toContain('2026-11-15') // söndag avstängd
  })

  it('tider: efter skolan på skoldagar, tidigt på lediga dagar, aldrig över händelser eller efter 21', () => {
    const lessons = [1, 2, 3, 4, 5].map((d) => lesson(`l${d}`, d, '08:00', '15:30'))
    const events = [ev('e', 'Föräldramöte', '2026-11-11', '17:00', '19:00')]
    const plan = planWorkouts({ ...base, from: FROM, days: 7, lessons, events, sessions: [{ type: 'gym', count: 3, minutes: 60 }] })
    for (const s of plan.sessions) {
      const start = Number(s.start.slice(0, 2)) * 60 + Number(s.start.slice(3, 5))
      const end = start + s.minutes
      expect(end).toBeLessThanOrEqual(21 * 60)
      const wd = new Date(s.date + 'T12:00:00').getDay()
      if (wd >= 1 && wd <= 5) expect(start).toBeGreaterThanOrEqual(16 * 60) // efter skolan + paus
      else expect(start).toBe(10 * 60)
      if (s.date === '2026-11-11') expect(start >= 19 * 60 || end <= 17 * 60).toBe(true)
    }
  })

  it('en plan som inte kan hålla sig inom 2 dagar i rad blir aldrig sämre än så, även med bara 3 dagar att välja på', () => {
    const plan = planWorkouts({ ...base, from: FROM, days: 3, sessions: [{ type: 'gym', count: 3 }] })
    expect(plan.sessions.length).toBeLessThan(3)
    expect(maxRun(idx(plan))).toBeLessThanOrEqual(2)
    expect(plan.warnings.length).toBeGreaterThan(0)
  })

  it('hjälpfunktioner för passtyper', () => {
    expect(['Gym', 'Styrkepass', 'Löptur', 'Springa 5 km', 'Yoga', 'Matte', 'Tandläkare'].map(workoutTypeOf)).toEqual(['gym', 'gym', 'löpning', 'löpning', 'annat', null, null])
    expect(['Gym', 'styrka', 'springa', 'Löpning', 'joggning', 'Yoga', ' '].map(normalizeType)).toEqual(['gym', 'gym', 'löpning', 'löpning', 'löpning', 'yoga', 'träning'])
  })

  it('är snabb även för stora önskemål (14 dagar, 7 pass)', () => {
    const t0 = Date.now()
    const plan = planWorkouts({ ...base, from: FROM, days: 14, sessions: [{ type: 'gym', count: 3 }, { type: 'löpning', count: 2 }, { type: 'yoga', count: 2 }] })
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(plan.sessions.length).toBe(7)
    expect(maxRun(idx(plan))).toBeLessThanOrEqual(2)
    expect(addDays(FROM, 0)).toBe(FROM)
  })
})
