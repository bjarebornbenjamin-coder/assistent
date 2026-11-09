import { describe, expect, it } from 'vitest'
import { RECIPE_PROMPT, fetchRecipes, parseRecipes, recipeUserContent } from './recipes'
import type { PantryItem } from '../domain/types'

const p = (name: string, expires?: string, amount?: string): PantryItem => ({ id: name, name, expires, amount, addedAt: '2026-11-01', source: 'manual', updatedAt: '' })
const pantry = [p('Pasta', undefined, '500 g'), p('Mjölk', '2026-11-11', '1 l'), p('Gurka', '2026-11-08'), p('Tomatsås')]

describe('recipeUserContent', () => {
  it('skickar varor med dagar kvar, preferenser och datum som data', () => {
    const data = JSON.parse(recipeUserContent(pantry, { allergies: ' nötter ', portions: 3 }, '2026-11-10'))
    expect(data).toMatchObject({ portions: 3, allergies: 'nötter', today: '2026-11-10' })
    expect(data.pantry).toEqual([{ name: 'Pasta', amount: '500 g' }, { name: 'Mjölk', amount: '1 l', daysLeft: 1 }, { name: 'Gurka', daysLeft: -2 }, { name: 'Tomatsås' }])
    expect(JSON.parse(recipeUserContent([], { allergies: '', portions: 2 }, '2026-11-10')).allergies).toBe('inga angivna')
    expect(RECIPE_PROMPT).toMatch(/DATA/)
  })
})

describe('parseRecipes', () => {
  const recipe = (over: Record<string, unknown> = {}) => ({ title: 'Pasta med sås', minutes: 25, portions: 2, uses: ['pasta', 'Tomatsås'], missing: ['Basilika'], steps: ['Koka pastan.', 'Värm såsen.'], tip: '', ...over })

  it('rensar uses mot lagret och missing mot lagret och basvaror', () => {
    const [r] = parseRecipes(JSON.stringify({ recipes: [recipe({ uses: ['pasta', 'Okänd vara', 'tomatsås', 'Pasta'], missing: ['Salt', 'Mjölk', 'basilika', 'Basilika', 'Vatten', 'Parmesan'] })] }), pantry)
    expect(r.uses).toEqual(['Pasta', 'Tomatsås']) // kanoniska namn, inga okända, inga dubbletter
    expect(r.missing).toEqual(['basilika', 'Parmesan']) // inte salt/vatten (basvaror) eller Mjölk (finns)
  })
  it('hoppar över recept utan titel eller steg, och validerar tid och portioner', () => {
    const list = parseRecipes(JSON.stringify([recipe({ title: '' }), recipe({ steps: [] }), recipe({ title: 'Ok', minutes: -5, portions: 99 })]), pantry)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ title: 'Ok', minutes: null, portions: 2 })
  })
  it('kodstaket klaras, skräp och tomt ger begripliga fel', () => {
    expect(parseRecipes('```json\n' + JSON.stringify({ recipes: [recipe()] }) + '\n```', pantry)).toHaveLength(1)
    expect(() => parseRecipes('Här är recepten', pantry)).toThrow(/tolka/)
    expect(() => parseRecipes('{"x":1}', pantry)).toThrow(/inga recept/)
    expect(() => parseRecipes('{"recipes":[{"title":"x"}]}', pantry)).toThrow(/Inga användbara/)
  })
})

describe('fetchRecipes', () => {
  it('anropar servern i JSON-läge och returnerar rensade recept', async () => {
    let body: { response_format: unknown; messages: { content: string }[] } | undefined
    const fetchFn = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recipes: [{ title: 'Pasta', steps: ['Koka.'], uses: ['pasta'], missing: [] }] }) } }] }))
    }) as unknown as typeof fetch
    const r = await fetchRecipes(pantry, { allergies: '', portions: 2 }, '2026-11-10', 'gpt-4o-mini', { 'x-app-password': 'pw' }, fetchFn)
    expect(r[0].uses).toEqual(['Pasta'])
    expect(body?.response_format).toEqual({ type: 'json_object' })
    expect(body?.messages[0].content).toBe(RECIPE_PROMPT)
    const bad = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
    await expect(fetchRecipes(pantry, { allergies: '', portions: 2 }, '2026-11-10', 'm', {}, bad)).rejects.toThrow()
  })
})
