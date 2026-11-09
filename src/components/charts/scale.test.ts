import { describe, expect, it } from 'vitest'
import { niceMax, topRoundedRect } from './scale'

describe('niceMax', () => {
  it('ger jämna axelsteg som täcker värdet', () => {
    expect(niceMax(0)).toEqual({ max: 4, ticks: [0, 1, 2, 3, 4] })
    expect(niceMax(2000)).toEqual({ max: 2000, ticks: [0, 500, 1000, 1500, 2000] })
    expect(niceMax(2350)).toMatchObject({ max: 3000, ticks: [0, 1000, 2000, 3000] })
    expect(niceMax(130)).toMatchObject({ max: 150, ticks: [0, 50, 100, 150] })
    expect(niceMax(97)).toMatchObject({ max: 100, ticks: [0, 25, 50, 75, 100] })
    expect(niceMax(7)).toMatchObject({ max: 8, ticks: [0, 2, 4, 6, 8] })
  })
  it('max täcker alltid värdet och ticks börjar på 0 och slutar på max', () => {
    for (const v of [1, 3.3, 18, 99, 120, 480, 1234, 2750, 9999, 12345]) {
      const { max, ticks } = niceMax(v)
      expect(max).toBeGreaterThanOrEqual(v)
      expect(ticks[0]).toBe(0)
      expect(ticks.at(-1)).toBe(max)
      expect(ticks.length).toBeLessThanOrEqual(7)
    }
  })
})

describe('topRoundedRect', () => {
  it('rundar bara de övre hörnen och begränsar radien', () => {
    expect(topRoundedRect(0, 0, 20, 30)).toBe('M0,30V4Q0,0 4,0H16Q20,0 20,4V30Z')
    expect(topRoundedRect(0, 0, 20, 2)).toContain('V2Q0,0 2,0') // låg stapel: radien krymper till höjden
  })
})
