import { describe, expect, it } from 'vitest'
import { ChatError, runChat } from './chat'
import { runTool, type ToolContext } from './tools'

const ctx: ToolContext = {
  settings: { id: 'main', cycleLength: 1, cycleAnchor: '2026-11-02', theme: 'system' },
  subjects: [{ id: 'ma', name: 'Matte', packItems: [{ id: '1', text: 'miniräknare' }] }],
  lessons: [{ id: 'l', subjectId: 'ma', weekday: 1, start: '08:00', end: '09:00', room: 'B12', teacher: 'Lena', weeks: null }],
  events: [{ id: 'e', title: 'Prov', date: '2026-11-10', start: '09:00', note: '', updatedAt: '' }],
  contacts: [
    { id: '1', name: 'Anna Berg', email: 'anna@example.com' },
    { id: '2', name: 'Anna Lund', email: 'anna.l@example.com' },
    { id: '3', name: 'Olle', email: 'olle@example.com' },
  ],
}

describe('verktyg', () => {
  it('schema och packlista för en måndag', () => {
    expect(runTool('get_schedule', { date: '2026-11-09' }, ctx).result).toMatchObject({ lessons: [{ subject: 'Matte', start: '08:00', room: 'B12' }] })
    expect(runTool('get_packing_list', { date: '2026-11-09' }, ctx).result).toMatchObject({ packing: [{ subject: 'Matte', items: ['miniräknare'] }] })
    expect(runTool('get_schedule', { date: 'imorgon' }, ctx).result).toHaveProperty('error')
  })
  it('händelser i intervall, och avvisar för långt intervall', () => {
    expect(runTool('list_events', { from: '2026-11-09', to: '2026-11-11' }, ctx).result).toMatchObject({ events: [{ title: 'Prov' }] })
    expect(runTool('list_events', { from: '2026-01-01', to: '2026-12-31' }, ctx).result).toHaveProperty('error')
  })
  it('propose_event lägger inte in något, bara ett kort', () => {
    const out = runTool('propose_event', { title: 'Prov', date: '2026-11-13', start: '09:00' }, ctx)
    expect(out.card).toMatchObject({ type: 'event', event: { title: 'Prov', date: '2026-11-13', start: '09:00' } })
    expect(runTool('propose_event', { title: 'x', date: '2026-11-13', end: '10:00' }, ctx).result).toHaveProperty('error')
  })
  it('draft_email slår upp kontakt, och frågar vid flera träffar eller ingen', () => {
    expect(runTool('draft_email', { to: 'olle', subject: 's', body: 'b' }, ctx).card).toMatchObject({ to: 'olle@example.com', toName: 'Olle' })
    expect(runTool('draft_email', { to: 'Anna', subject: 's', body: 'b' }, ctx).result).toMatchObject({ error: expect.stringContaining('Flera') })
    expect(runTool('draft_email', { to: 'Kalle', subject: 's', body: 'b' }, ctx).result).toHaveProperty('error')
    expect(runTool('draft_email', { to: 'x@y.se', subject: 's', body: 'b' }, ctx).card).toMatchObject({ to: 'x@y.se' })
  })
})

function fakeApi(responses: unknown[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const r = responses.shift() as { status?: number; body: unknown }
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 })
  }) as unknown as typeof fetch
  return { fetchFn, calls }
}
const base = { apiKey: 'sk-test', model: 'm', history: [], now: new Date('2026-11-08T13:00:00'), loadContext: async () => ctx }

describe('runChat', () => {
  it('kör verktyg och skickar tillbaka resultatet till modellen', async () => {
    const { fetchFn, calls } = fakeApi([
      { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_schedule', arguments: '{"date":"2026-11-09"}' } }] } }] } },
      { body: { choices: [{ message: { content: 'Du har Matte 08:00.' } }] } },
    ])
    const res = await runChat({ ...base, userText: 'Vad har jag imorgon?', fetchFn })
    expect(res.reply).toBe('Du har Matte 08:00.')
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer sk-test' })
    const second = JSON.parse(calls[1].init.body as string)
    expect(second.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' })
    expect(second.messages.at(-1).content).toContain('Matte')
    expect(second.messages[0].content).toContain('söndag 2026-11-08')
  })
  it('samlar kort från mejlutkast', async () => {
    const { fetchFn } = fakeApi([
      { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'draft_email', arguments: '{"to":"Olle","subject":"Läxan","body":"Hej Olle"}' } }] } }] } },
      { body: { choices: [{ message: { content: 'Utkast klart.' } }] } },
    ])
    const res = await runChat({ ...base, userText: 'Mejla Olle', fetchFn })
    expect(res.cards).toEqual([{ type: 'email', to: 'olle@example.com', toName: 'Olle', subject: 'Läxan', body: 'Hej Olle' }])
  })
  it('ger begripliga fel', async () => {
    await expect(runChat({ ...base, userText: 'hej', fetchFn: fakeApi([{ status: 401, body: { error: { message: 'bad' } } }]).fetchFn })).rejects.toThrow(/nyckeln/)
    await expect(runChat({ ...base, userText: 'hej', fetchFn: (async () => { throw new TypeError('offline') }) as unknown as typeof fetch })).rejects.toThrow(ChatError)
  })
  it('avbryter om modellen aldrig slutar anropa verktyg', async () => {
    const loop = { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'find_contact', arguments: '{"name":"a"}' } }] } }] } }
    await expect(runChat({ ...base, userText: 'hej', fetchFn: fakeApi(Array(10).fill(loop)).fetchFn })).rejects.toThrow(/loop/)
  })
})
