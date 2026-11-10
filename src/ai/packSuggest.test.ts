import { describe, expect, it } from 'vitest'
import { parsePackSuggestions, suggestPackItems } from './packSuggest'

describe('packförslag', () => {
  it('rensar dubbletter och sådant som redan står på listan', () => {
    expect(parsePackSuggestions('{"items":["Fotbollsskor"," benskydd ","Benskydd","",3,"Vattenflaska"]}', ['vattenflaska'])).toEqual(['Fotbollsskor', 'benskydd'])
    expect(parsePackSuggestions('{"items":[]}')).toEqual([])
    expect(() => parsePackSuggestions('nej')).toThrow(/tolka/)
  })
  it('skickar händelsen och preferenserna som data', async () => {
    let sent = ''
    const f = (async (_u: string, init: RequestInit) => {
      sent = String(init.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"items":["Badkläder","Handduk"]}' } }] }))
    }) as typeof fetch
    const items = await suggestPackItems({ title: 'Simning', date: '2026-11-11', start: '17:00', note: '' }, [], ['Har glasögon'], 'gpt-4o-mini', {}, f)
    expect(items).toEqual(['Badkläder', 'Handduk'])
    const user = JSON.parse(JSON.parse(sent).messages[1].content)
    expect(user).toMatchObject({ event: { title: 'Simning', weekday: 'onsdag', time: '17:00' }, preferences: ['Har glasögon'] })
  })
})
