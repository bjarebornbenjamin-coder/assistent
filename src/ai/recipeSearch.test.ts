import { describe, expect, it } from 'vitest'
import { findRecipes, ingredientStatuses, splitIngredient } from './recipeSearch'
import type { PantryItem } from '../domain/types'

const pantry: PantryItem[] = [
  { id: '1', name: 'Kycklingfilé', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
  { id: '2', name: 'Grädde', expires: '2026-11-01', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
]

describe('receptsökning i appen', () => {
  it('delar upp ingrediensrader i mängd och vara', () => {
    expect(splitIngredient('400 g kycklingfilé')).toEqual({ amount: '400 g', name: 'kycklingfilé' })
    expect(splitIngredient('1 1/2 dl grädde')).toEqual({ amount: '1 1/2 dl', name: 'grädde' })
    expect(splitIngredient('2 klyftor vitlök')).toEqual({ amount: '2 klyftor', name: 'vitlök' })
    expect(splitIngredient('salt och peppar')).toEqual({ amount: '', name: 'salt och peppar' })
  })
  it('markerar det som finns hemma, basvaror och det som saknas', () => {
    expect(ingredientStatuses(['500 g kycklingfilé, i bitar', '2 dl grädde', '1 tsk salt', '1 gul lök'], pantry).map((i) => i.status)).toEqual(['pantry', 'pantry', 'staple', 'missing'])
  })
  it('skickar valet och bara ej utgångna varor till servern', async () => {
    let sent: Record<string, unknown> = {}
    const f = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body))
      return new Response(JSON.stringify({ recipes: [{ title: 'Kycklinggryta', url: 'https://www.ica.se/recept/x/', site: 'ica.se', why: '', ingredients: ['500 g kycklingfilé'] }] }))
    }) as typeof fetch
    const r = await findRecipes({ mode: 'pantry', pantry, food: { allergies: 'nötter' }, memories: [], today: '2026-11-10', wish: ' snabbt ' }, {}, f)
    expect(r[0].title).toBe('Kycklinggryta')
    expect(sent).toMatchObject({ mode: 'pantry', allergies: 'nötter', wish: 'snabbt', count: 3 })
    expect(sent.pantry).toEqual([{ name: 'Kycklingfilé' }])
  })
})
