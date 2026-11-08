import { describe, expect, it } from 'vitest'
import { planNotifications } from './notifications'
import { describeRepeat, occursOn, remainingToday } from './reminders'
import type { Reminder } from './types'

const rem = (id: string, time: string, repeat: Reminder['repeat'], enabled = true): Reminder => ({ id, title: `P ${id}`, time, repeat, enabled, updatedAt: '' })
const s = { cycleLength: 1, cycleAnchor: '2026-11-02', notify: { evening: false, eveningTime: '20:00', before: false, beforeMinutes: 10 } }

describe('påminnelser', () => {
  it('upprepning: en gång, dagligen, valda veckodagar, avstängd', () => {
    expect(occursOn(rem('a', '08:00', { kind: 'once', date: '2026-11-10' }), '2026-11-10')).toBe(true)
    expect(occursOn(rem('a', '08:00', { kind: 'once', date: '2026-11-10' }), '2026-11-11')).toBe(false)
    expect(occursOn(rem('b', '08:00', { kind: 'daily' }), '2026-11-14')).toBe(true)
    const monWed = rem('c', '08:00', { kind: 'weekdays', days: [1, 3] })
    expect(['2026-11-09', '2026-11-10', '2026-11-11'].map((d) => occursOn(monWed, d))).toEqual([true, false, true])
    expect(occursOn(rem('d', '08:00', { kind: 'daily' }, false), '2026-11-10')).toBe(false)
  })
  it('återstående idag, i tidsordning', () => {
    const now = new Date('2026-11-10T12:00:00') // tisdag
    const list = remainingToday(now, [rem('sen', '18:00', { kind: 'daily' }), rem('klar', '09:00', { kind: 'daily' }), rem('tidig', '13:00', { kind: 'weekdays', days: [2] }), rem('annan', '14:00', { kind: 'weekdays', days: [3] })])
    expect(list.map((r) => r.id)).toEqual(['tidig', 'sen'])
  })
  it('beskrivning av upprepning', () => {
    expect(describeRepeat({ kind: 'daily' })).toBe('Varje dag')
    expect(describeRepeat({ kind: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('Vardagar')
    expect(describeRepeat({ kind: 'weekdays', days: [3] })).toBe('Varje onsdag')
    expect(describeRepeat({ kind: 'weekdays', days: [5, 1] })).toBe('Mån, Fre')
  })
  it('planeras som notiser: bara framtida tillfällen, med stabilt id', () => {
    const now = new Date('2026-11-10T12:00:00')
    const plan = planNotifications(now, s, [], [], 2, [rem('x', '09:00', { kind: 'daily' }), rem('y', '15:30', { kind: 'once', date: '2026-11-10' }), rem('z', '08:00', { kind: 'once', date: '2026-11-10' })])
    expect(plan.map((n) => n.id)).toEqual(['reminder:y:2026-11-10', 'reminder:x:2026-11-11', 'reminder:x:2026-11-12'])
    expect(plan[0]).toMatchObject({ title: 'P y', body: 'Påminnelse kl 15:30' })
    expect(plan[0].fireAt).toEqual(new Date('2026-11-10T15:30:00'))
  })
})
