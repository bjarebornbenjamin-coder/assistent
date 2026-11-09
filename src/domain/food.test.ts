import { describe, expect, it } from 'vitest'
import { expiringWithin, expiryLabel, expiryStatus, foodKey, sortPantry } from './food'
import type { PantryItem } from './types'

const it_ = (name: string, expires?: string): PantryItem => ({ id: name, name, expires, addedAt: '2026-11-01', source: 'manual', updatedAt: '' })
const today = '2026-11-10'

describe('utgångsdatum', () => {
  it('status och text', () => {
    expect(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', undefined].map((d) => expiryStatus(d, today))).toEqual(['expired', 'expired', 'today', 'soon', 'soon', 'ok', 'none'])
    expect(expiryLabel('2026-11-07', today)).toBe('Gick ut för 3 dagar sedan')
    expect(expiryLabel('2026-11-09', today)).toBe('Gick ut igår')
    expect(expiryLabel('2026-11-10', today)).toBe('Går ut idag')
    expect(expiryLabel('2026-11-11', today)).toBe('Går ut imorgon')
    expect(expiryLabel('2026-11-14', today)).toBe('Går ut om 4 dagar')
    expect(expiryLabel('2026-12-24', today)).toMatch(/^Bäst före 24 dec/)
    expect(expiryLabel(undefined, today)).toBe('')
  })
  it('sorterar utgångna och snart utgående först, utan datum sist', () => {
    const list = sortPantry([it_('ris'), it_('mjölk', '2026-11-12'), it_('yoghurt', '2026-11-09'), it_('ägg', '2026-11-12')])
    expect(list.map((i) => i.name)).toEqual(['yoghurt', 'mjölk', 'ägg', 'ris'])
  })
  it('hittar det som går ut inom två dagar (inklusive utgånget)', () => {
    const list = expiringWithin([it_('a', '2026-11-08'), it_('b', '2026-11-12'), it_('c', '2026-11-13'), it_('d')], today)
    expect(list.map((i) => i.name)).toEqual(['a', 'b'])
  })
  it('foodKey', () => {
    expect(foodKey('  Mjölk   3% ')).toBe('mjölk 3%')
  })
})
