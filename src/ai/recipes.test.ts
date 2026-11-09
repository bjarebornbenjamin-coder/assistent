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
  })
  it('instruktionen kräver mått, detaljerade steg och näring per portion', () => {
    expect(RECIPE_PROMPT).toMatch(/DATA/)
    expect(RECIPE_PROMPT).toMatch(/EXAKT det antal portioner/)
    expect(RECIPE_PROMPT).toMatch(/ugnstemperatur/)
    expect(RECIPE_PROMPT).toMatch(/hur man ser att det är klart/)
    expect(RECIPE_PROMPT).toMatch(/PER PORTION/)
    expect(RECIPE_PROMPT).toMatch(/ETABLERADE rätter/)
    expect(RECIPE_PROMPT).toMatch(/Hitta ALDRIG på egna kombinationer/)
    expect(RECIPE_PROMPT).toMatch(/max 6 per recept/)
  })
})

describe('parseRecipes', () => {
  const recipe = (over: Record<string, unknown> = {}) => ({
    title: 'Pasta med sås',
    portions: 2,
    prepMinutes: 10,
    cookMinutes: 15,
    ingredients: [{ name: 'pasta', amount: '200 g' }, { name: 'Tomatsås', amount: '3 dl' }, { name: 'Basilika', amount: '1 kruka' }, { name: 'Salt', amount: '1 tsk' }],
    equipment: ['Stor kastrull', 'Sked'],
    steps: ['Koka upp 2 liter vatten med 1 msk salt.', 'Koka pastan 9 minuter tills den är al dente.'],
    tip: 'Spara lite pastavatten.',
    nutrition: { kcal: 560, protein: 20, carbs: 90, fat: 12 },
    ...over,
  })

  it('räknar ut status per ingrediens mot lagret, och uses/missing från den', () => {
    const [r] = parseRecipes(JSON.stringify({ recipes: [recipe()] }), pantry)
    expect(r.ingredients).toEqual([
      { name: 'pasta', amount: '200 g', status: 'pantry', pantryName: 'Pasta' },
      { name: 'Tomatsås', amount: '3 dl', status: 'pantry', pantryName: 'Tomatsås' },
      { name: 'Basilika', amount: '1 kruka', status: 'missing' },
      { name: 'Salt', amount: '1 tsk', status: 'staple' },
    ])
    expect(r.uses).toEqual(['Pasta', 'Tomatsås'])
    expect(r.missing).toEqual([{ name: 'Basilika', amount: '1 kruka' }]) // salt är basvara
    expect(r).toMatchObject({ portions: 2, prepMinutes: 10, cookMinutes: 15, equipment: ['Stor kastrull', 'Sked'], tip: 'Spara lite pastavatten.', nutrition: { kcal: 560, protein: 20, carbs: 90, fat: 12 } })
    expect(r.steps).toHaveLength(2)
  })
  it('ignorerar modellens egna uses/missing och dubbletter bland ingredienser', () => {
    const [r] = parseRecipes(JSON.stringify({ recipes: [recipe({ uses: ['Okänd'], missing: ['Mjölk'], ingredients: [{ name: 'Pasta', amount: '200 g' }, { name: 'pasta', amount: '100 g' }, { name: 'Mjölk', amount: '2 dl' }] })] }), pantry)
    expect(r.ingredients.map((i) => i.name)).toEqual(['Pasta', 'Mjölk'])
    expect(r.uses).toEqual(['Pasta', 'Mjölk'])
    expect(r.missing).toEqual([])
  })
  it('hoppar över recept utan titel, steg eller ingredienser; validerar tider, portioner och näring', () => {
    const list = parseRecipes(JSON.stringify([recipe({ title: '' }), recipe({ steps: [] }), recipe({ ingredients: [] }), recipe({ title: 'Ok', prepMinutes: -5, cookMinutes: 'snart', portions: 99, nutrition: { kcal: 'mycket', protein: 1, carbs: 1, fat: 1 } })]), pantry)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ title: 'Ok', prepMinutes: null, cookMinutes: null, portions: 2, nutrition: null })
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
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recipes: [{ title: 'Pasta', ingredients: [{ name: 'Pasta', amount: '200 g' }], steps: ['Koka.'] }] }) } }] }))
    }) as unknown as typeof fetch
    const r = await fetchRecipes(pantry, { allergies: '', portions: 2 }, '2026-11-10', 'gpt-4o-mini', { 'x-app-password': 'pw' }, fetchFn)
    expect(r[0].uses).toEqual(['Pasta'])
    expect(body?.response_format).toEqual({ type: 'json_object' })
    expect(body?.messages[0].content).toBe(RECIPE_PROMPT)
    const bad = (async () => new Response('{}', { status: 429 })) as unknown as typeof fetch
    await expect(fetchRecipes(pantry, { allergies: '', portions: 2 }, '2026-11-10', 'm', {}, bad)).rejects.toThrow()
  })
})
