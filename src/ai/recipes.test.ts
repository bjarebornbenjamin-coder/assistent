import { describe, expect, it } from 'vitest'
import { parseQty, withPantryStatus } from './recipes'
import type { PantryItem } from '../domain/types'

const p = (name: string, expires?: string, amount?: string): PantryItem => ({ id: name, name, expires, amount, addedAt: '2026-11-01', source: 'manual', updatedAt: '' })

describe('mängder mot lagret', () => {
  it('tolkar vanliga mått', () => {
    expect(['400 g', '1,5 kg', '2 dl', '1 l', '3 st', '1 msk', 'några skivor', '1 bit', ''].map((t) => parseQty(t))).toEqual([
      { value: 400, unit: 'g' }, { value: 1500, unit: 'g' }, { value: 200, unit: 'ml' }, { value: 1000, unit: 'ml' }, { value: 3, unit: 'st' }, { value: 15, unit: 'ml' }, null, { value: 1, unit: 'st' }, null,
    ])
  })
  it('markerar för lite och okänd mängd (testarens fall: kött och ost)', () => {
    const pantry2 = [p('Kött', undefined, 'några skivor'), p('Ost', undefined, '100 g'), p('Mjölk', undefined, '1 l')]
    const r = withPantryStatus([{ name: 'Kött', amount: '400 g' }, { name: 'Ost', amount: '200 g' }, { name: 'Mjölk', amount: '2 dl' }, { name: 'Salt', amount: '1 tsk' }, { name: 'Lök', amount: '1 st' }], pantry2)
    expect(r.map((i) => [i.name, i.status])).toEqual([['Kött', 'pantry-check'], ['Ost', 'pantry-low'], ['Mjölk', 'pantry'], ['Salt', 'staple'], ['Lök', 'missing']])
  })
})
