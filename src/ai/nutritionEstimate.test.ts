import { describe, expect, it } from 'vitest'
import { NUTRITION_PROMPT, estimateMeal, parseEstimate } from './nutritionEstimate'

describe('parseEstimate', () => {
  it('läser värden och förklaring', () => {
    expect(parseEstimate('{"kcal":520,"protein":32.5,"carbs":48,"fat":18,"assumptions":" Antog 150 g kyckling. "}')).toEqual({ kcal: 520, protein: 32.5, carbs: 48, fat: 18, assumptions: 'Antog 150 g kyckling.' })
  })
  it('räknar ut kalorier ur makron när de saknas', () => {
    expect(parseEstimate('{"protein":30,"carbs":50,"fat":10}').kcal).toBe(30 * 4 + 50 * 4 + 10 * 9)
  })
  it('klarar kodstaket, och kastar begripliga fel för skräp, fel från modellen och orimliga värden', () => {
    expect(parseEstimate('```json\n{"kcal":100,"protein":1,"carbs":2,"fat":3}\n```').protein).toBe(1)
    expect(() => parseEstimate('Ungefär 500 kcal')).toThrow(/tolka/)
    expect(() => parseEstimate('{"error":"Det där är inte mat"}')).toThrow(/Det där är inte mat/)
    expect(() => parseEstimate('{"protein":-5,"carbs":10,"fat":1}')).toThrow(/ofullständig/)
    expect(() => parseEstimate('{"protein":99999,"carbs":10,"fat":1}')).toThrow(/ofullständig/)
    expect(() => parseEstimate('{"protein":"mycket","carbs":10,"fat":1}')).toThrow(/ofullständig/)
  })
})

describe('estimateMeal', () => {
  it('skickar beskrivningen som data i JSON-läge och returnerar uppskattningen', async () => {
    let body: { messages: { content: string }[]; response_format: unknown } | undefined
    const fetchFn = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"kcal":400,"protein":20,"carbs":40,"fat":15,"assumptions":"x"}' } }] }))
    }) as unknown as typeof fetch
    const r = await estimateMeal('2 ägg och 2 skivor bröd', 'gpt-4o-mini', { 'x-app-password': 'pw' }, fetchFn)
    expect(r.kcal).toBe(400)
    expect(body?.messages[0].content).toBe(NUTRITION_PROMPT)
    expect(JSON.parse(body!.messages[1].content)).toEqual({ meal: '2 ägg och 2 skivor bröd' })
    expect(body?.response_format).toEqual({ type: 'json_object' })
    await expect(estimateMeal('   ', 'm', {}, fetchFn)).rejects.toThrow(/Beskriv först/)
    const bad = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
    await expect(estimateMeal('mat', 'm', {}, bad)).rejects.toThrow()
  })
})
