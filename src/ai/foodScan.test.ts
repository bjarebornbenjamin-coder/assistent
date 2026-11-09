import { describe, expect, it } from 'vitest'
import { matchExisting, parseScanResponse, scanImage, RECEIPT_PROMPT, FRIDGE_PROMPT } from './foodScan'

const today = '2026-11-10'

describe('parseScanResponse', () => {
  it('kvitto: varor med mängd och uppskattat bäst före', () => {
    const { rows, skipped } = parseScanResponse(JSON.stringify({ items: [{ name: ' Mjölk ', amount: '1 l', shelf_life_days: 7 }, { name: 'Ris', amount: '', shelf_life_days: 365 }, { name: 'Fisk', shelf_life_days: null }] }), 'receipt', today)
    expect(skipped).toBe(0)
    expect(rows.map((r) => [r.name, r.amount, r.expires])).toEqual([['Mjölk', '1 l', '2026-11-17'], ['Ris', '', '2027-11-10'], ['Fisk', '', '']])
    expect(rows.every((r) => r.include)).toBe(true)
  })
  it('kylskåp: inga datum, även om modellen skickar med dem', () => {
    const { rows } = parseScanResponse('{"items":[{"name":"Ost","amount":"halv förpackning","shelf_life_days":30}]}', 'fridge', today)
    expect(rows[0]).toMatchObject({ name: 'Ost', amount: 'halv förpackning', expires: '' })
  })
  it('hoppar över tomma, för långa, ogiltiga datum och dubbletter (skiftlägesokänsligt)', () => {
    const { rows, skipped } = parseScanResponse(
      JSON.stringify({ items: [{ name: 'Mjölk' }, { name: 'mjölk ' }, { name: '' }, { name: 'x'.repeat(80) }, { name: 'Smör', shelf_life_days: -3 }, { name: 'Ägg', shelf_life_days: 'snart' }, null] }),
      'receipt',
      today,
    )
    expect(rows.map((r) => r.name)).toEqual(['Mjölk', 'Smör', 'Ägg'])
    expect(rows.every((r) => r.name !== 'Mjölk' || r.expires === '')).toBe(true)
    expect(rows.find((r) => r.name === 'Smör')?.expires).toBe('')
    expect(skipped).toBe(4)
  })
  it('klarar kodstaket och en ren lista, och kastar begripligt fel på skräp', () => {
    expect(parseScanResponse('```json\n{"items":[{"name":"Bröd"}]}\n```', 'receipt', today).rows).toHaveLength(1)
    expect(parseScanResponse('[{"name":"Bröd"}]', 'fridge', today).rows).toHaveLength(1)
    expect(() => parseScanResponse('Här är listan', 'receipt', today)).toThrow(/tolka/)
    expect(() => parseScanResponse('{"x":1}', 'receipt', today)).toThrow(/inga varor/)
  })
})

describe('matchExisting', () => {
  it('hittar varor som redan finns i lagret och på inköpslistan (ej köpta)', () => {
    const rows = [{ key: 'a', name: 'mjölk', amount: '', expires: '', include: true }, { key: 'b', name: 'Ägg', amount: '', expires: '', include: true }]
    const pantry = [{ id: 'p', name: 'Mjölk', amount: '1 l', addedAt: today, source: 'manual' as const, updatedAt: '' }]
    const shopping = [{ id: 's1', name: 'Ägg', done: false, addedAt: today, updatedAt: '' }, { id: 's2', name: 'Mjölk', done: true, addedAt: today, updatedAt: '' }]
    const m = matchExisting(pantry, shopping)
    expect(m.pantryHit(rows[0])?.id).toBe('p')
    expect(m.pantryHit(rows[1])).toBeUndefined()
    expect(m.listHit(rows[1])?.id).toBe('s1')
    expect(m.listHit(rows[0])).toBeUndefined()
  })
})

describe('scanImage', () => {
  it('väljer rätt instruktion och skickar bilden i JSON-läge', async () => {
    const bodies: { messages: { content: unknown }[]; response_format: unknown }[] = []
    const fetchFn = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string))
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"items":[]}' } }] }))
    }) as unknown as typeof fetch
    await scanImage('receipt', 'data:image/jpeg;base64,AAA', 'gpt-4o-mini', {}, fetchFn)
    await scanImage('fridge', 'data:image/jpeg;base64,BBB', 'gpt-4o-mini', {}, fetchFn)
    expect(bodies[0].messages[0].content).toBe(RECEIPT_PROMPT)
    expect(bodies[1].messages[0].content).toBe(FRIDGE_PROMPT)
    expect(bodies[0].response_format).toEqual({ type: 'json_object' })
    expect(JSON.stringify(bodies[1].messages[1].content)).toContain('BBB')
  })
})
