import { describe, expect, it } from 'vitest'
import { planWorkouts } from './training'
import type { Workout } from './types'
import { exerciseHistory, lastOfType, pace, unloggedPlanned, weeklyCounts, workoutSummary } from './workouts'

const w = (id: string, date: string, type: string, extra: Partial<Workout> = {}): Workout => ({ id, date, type, title: type, exercises: [], note: '', updatedAt: date, ...extra })

describe('träningslogg', () => {
  it('räknar tempo och sammanfattning', () => {
    expect(pace(27, 5)).toBe('5:24/km')
    expect(workoutSummary({ minutes: 27, distanceKm: 5, exercises: [] })).toBe('5 km · 27 min · 5:24/km')
    expect(workoutSummary({ minutes: 60, exercises: [{ name: 'Knäböj', sets: 3, reps: 8 }] })).toBe('1 övning · 60 min')
  })

  it('hittar senaste passet av samma sort och senaste resultat per övning', () => {
    const list = [
      w('a', '2026-11-02', 'gym', { exercises: [{ name: 'Bänkpress', sets: 3, reps: 8, weightKg: 55 }] }),
      w('b', '2026-11-05', 'gym', { exercises: [{ name: 'bänkpress', sets: 3, reps: 8, weightKg: 60 }] }),
      w('c', '2026-11-06', 'löpning'),
    ]
    expect(lastOfType('styrketräning', list)?.id).toBe('b')
    expect(exerciseHistory(list)).toEqual([{ name: 'bänkpress', date: '2026-11-05', label: '3 × 8 × 60 kg' }])
  })

  it('veckosummor och planerade pass som inte loggats', () => {
    const list = [w('a', '2026-11-03', 'löpning', { minutes: 30, distanceKm: 5 }), w('b', '2026-11-09', 'gym', { minutes: 60 })]
    expect(weeklyCounts(list, '2026-11-10', 2)).toEqual([
      { monday: '2026-11-02', count: 1, minutes: 30, km: 5 },
      { monday: '2026-11-09', count: 1, minutes: 60, km: 0 },
    ])
    const ev = (id: string, title: string, date: string) => ({ id, title, date, note: '', updatedAt: '' })
    const events = [ev('1', 'Gym', '2026-11-09'), ev('2', 'Löpning', '2026-11-08'), ev('3', 'Bio', '2026-11-08'), ev('4', 'Gym', '2026-11-12')]
    expect(unloggedPlanned(events, list, '2026-11-03', '2026-11-10').map((e) => e.id)).toEqual(['2'])
  })

  it('träningsplaneringen räknar loggade pass som träningsdagar', () => {
    const logged = [w('a', '2026-11-08', 'gym'), w('b', '2026-11-09', 'löpning')]
    const plan = planWorkouts({ from: '2026-11-10', days: 7, sessions: [{ type: 'gym', count: 2 }], lessons: [], events: [], tasks: [], settings: { cycleLength: 1, cycleAnchor: '2026-11-02' }, logged })
    expect(plan.recent.map((r) => r.date)).toEqual(['2026-11-08', '2026-11-09'])
    expect(plan.sessions[0].date).not.toBe('2026-11-10') // annars tre dagar i rad
  })
})
