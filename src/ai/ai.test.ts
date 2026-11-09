import { describe, expect, it } from 'vitest'
import { ChatError, runChat } from './chat'
import { runTool, type ToolContext } from './tools'

const ctx: ToolContext = {
  settings: { id: 'main', cycleLength: 1, cycleAnchor: '2026-11-02', theme: 'system', notify: { evening: true, eveningTime: '20:00', before: false, beforeMinutes: 10 }, food: { allergies: '', portions: 2, shopping: { enabled: true, weekday: 5, time: '16:00' }, expiry: { enabled: true, time: '08:00' } }, nutrition: { proteinG: 120, carbsG: 250, fatG: 70, waterMl: 2000, glassMl: 250 } },
  subjects: [{ id: 'ma', name: 'Matte', packItems: [{ id: '1', text: 'miniräknare' }] }],
  lessons: [{ id: 'l', subjectId: 'ma', weekday: 1, start: '08:00', end: '09:00', room: 'B12', teacher: 'Lena', weeks: null }],
  events: [{ id: 'e', title: 'Prov', date: '2026-11-10', start: '09:00', note: '', updatedAt: '' }],
  pantry: [
    { id: 'p1', name: 'Mjölk', amount: '1 l', expires: '2026-11-09', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
    { id: 'p2', name: 'Pasta', amount: '500 g', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
    { id: 'p3', name: 'Gurka', expires: '2026-11-11', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
  ],
  shopping: [{ id: 's1', name: 'Ägg', done: false, addedAt: '2026-11-01', updatedAt: '' }, { id: 's2', name: 'Bröd', done: true, addedAt: '2026-11-01', updatedAt: '' }],
  today: '2026-11-10',
  reminders: [{ id: 'r1', title: 'Ta medicin', time: '07:30', repeat: { kind: 'weekdays', days: [2] }, enabled: true, updatedAt: '' }],
  tasks: [{ id: 't1', title: 'Läs kapitel 3', subjectId: 'ma', deadline: '2026-11-12', done: false, updatedAt: '' }, { id: 't2', title: 'Gammal', deadline: '2026-11-01', done: false, updatedAt: '' }, { id: 't3', title: 'Klar', deadline: '2026-11-12', done: true, updatedAt: '' }],
  contacts: [
    { id: '1', name: 'Anna Berg', email: 'anna@example.com' },
    { id: '2', name: 'Anna Lund', email: 'anna.l@example.com' },
    { id: '3', name: 'Olle', email: 'olle@example.com' },
  ],
}

describe('verktyg', () => {
  it('list_tasks tar med försenade men inte klara, och propose_task kopplar ämne', () => {
    const r = runTool('list_tasks', { from: '2026-11-09', to: '2026-11-15' }, ctx).result as { tasks: { title: string; overdue?: boolean; subject?: string }[] }
    expect(r.tasks.map((t) => t.title)).toEqual(['Gammal', 'Läs kapitel 3'])
    expect(r.tasks[0].overdue).toBe(true)
    expect(r.tasks[1].subject).toBe('Matte')
    expect(runTool('propose_task', { title: 'Läxa', deadline: '2026-11-13', subject: 'matt' }, ctx).card).toEqual({ type: 'task', task: { title: 'Läxa', deadline: '2026-11-13', subjectId: 'ma' } })
    expect(runTool('propose_task', { title: 'Läxa', deadline: '2026-11-13', subject: 'Fysik' }, ctx).result).toHaveProperty('note')
    expect(runTool('propose_task', { title: 'Läxa', deadline: 'fredag' }, ctx).result).toHaveProperty('error')
  })
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
const base = { headers: { 'x-app-password': 'pw' }, model: 'm', history: [], now: new Date('2026-11-08T13:00:00'), loadContext: async () => ctx }

describe('runChat', () => {
  it('kör verktyg och skickar tillbaka resultatet till modellen', async () => {
    const { fetchFn, calls } = fakeApi([
      { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_schedule', arguments: '{"date":"2026-11-09"}' } }] } }] } },
      { body: { choices: [{ message: { content: 'Du har Matte 08:00.' } }] } },
    ])
    const res = await runChat({ ...base, userText: 'Vad har jag imorgon?', fetchFn })
    expect(res.reply).toBe('Du har Matte 08:00.')
    expect(calls[0].url).toBe('/api/chat')
    expect(calls[0].init.headers).toMatchObject({ 'x-app-password': 'pw' })
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
    await expect(runChat({ ...base, userText: 'hej', fetchFn: fakeApi([{ status: 401, body: { error: { message: 'bad' } } }]).fetchFn })).rejects.toThrow(/lösenord/i)
    await expect(runChat({ ...base, userText: 'hej', fetchFn: (async () => { throw new TypeError('offline') }) as unknown as typeof fetch })).rejects.toThrow(ChatError)
  })
  it('avbryter om modellen aldrig slutar anropa verktyg', async () => {
    const loop = { body: { choices: [{ message: { content: null, tool_calls: [{ id: 'c', type: 'function', function: { name: 'find_contact', arguments: '{"name":"a"}' } }] } }] } }
    await expect(runChat({ ...base, userText: 'hej', fetchFn: fakeApi(Array(10).fill(loop)).fetchFn })).rejects.toThrow(/loop/)
  })
})

describe('ändra och ta bort', () => {
  it('uppdatering: bara angivna fält ändras, ogiltigt och oförändrat avvisas', () => {
    const r = runTool('propose_update_event', { id: 'e', date: '2026-11-12' }, ctx)
    expect(r.card).toMatchObject({ type: 'event_update', id: 'e', after: { title: 'Prov', date: '2026-11-12', start: '09:00' } })
    expect(runTool('propose_update_event', { id: 'e', start: '' }, ctx).card).toMatchObject({ after: { title: 'Prov', date: '2026-11-10' } })
    expect((runTool('propose_update_event', { id: 'e', start: '' }, ctx).card as { after: Record<string, unknown> }).after).not.toHaveProperty('start')
    expect(runTool('propose_update_event', { id: 'e', title: 'Prov' }, ctx).result).toHaveProperty('error') // ingen ändring
    expect(runTool('propose_update_event', { id: 'e', end: '08:00' }, ctx).result).toHaveProperty('error')
    expect(runTool('propose_update_event', { id: 'finns-inte', date: '2026-11-12' }, ctx).result).toHaveProperty('error')
    expect(runTool('propose_update_lesson', { id: 'l', start: '10:00', end: '11:00', room: 'C3' }, ctx).card).toMatchObject({
      type: 'lesson_update',
      after: { weekday: 1, start: '10:00', end: '11:00', room: 'C3', teacher: 'Lena' },
    })
    expect(runTool('propose_update_lesson', { id: 'l', start: '10:00' }, ctx).result).toHaveProperty('error') // start efter slut
    expect(runTool('propose_update_lesson', { id: 'l', weekday: 9 }, ctx).result).toHaveProperty('error')
  })
  it('borttagning kräver giltigt id och ger bara ett kort', () => {
    expect(runTool('propose_delete_event', { id: 'e' }, ctx).card).toMatchObject({ type: 'event_delete', id: 'e' })
    expect(runTool('propose_delete_lesson', { id: 'l' }, ctx).card).toMatchObject({ type: 'lesson_delete', id: 'l' })
    expect(runTool('propose_delete_lesson', { id: 'x' }, ctx).result).toHaveProperty('error')
  })
  it('id följer med i schema- och händelselistor så att modellen kan peka ut dem', () => {
    expect(runTool('get_schedule', { date: '2026-11-09' }, ctx).result).toMatchObject({ lessons: [{ id: 'l' }] })
    expect(runTool('list_events', { from: '2026-11-10', to: '2026-11-10' }, ctx).result).toMatchObject({ events: [{ id: 'e' }] })
  })
})

describe('mat', () => {
  it('list_pantry sorterar efter bäst före och ger daysLeft (negativt = utgånget)', () => {
    const r = runTool('list_pantry', {}, ctx).result as { today: string; items: { name: string; daysLeft?: number }[] }
    expect(r.today).toBe('2026-11-10')
    expect(r.items.map((i) => [i.name, i.daysLeft])).toEqual([['Mjölk', -1], ['Gurka', 1], ['Pasta', undefined]])
    expect(runTool('list_shopping', {}, ctx).result).toEqual({ items: [{ name: 'Ägg', amount: undefined, done: false }, { name: 'Bröd', amount: undefined, done: true }] })
  })
  it('propose_shopping_items hoppar över det som redan står på listan, men inte köpta varor', () => {
    const r = runTool('propose_shopping_items', { items: [{ name: 'ägg' }, { name: 'Bröd', amount: '1 limpa' }, { name: 'Ost' }, { name: 'ost' }] }, ctx)
    expect(r.card).toEqual({ type: 'shopping_add', items: [{ name: 'Bröd', amount: '1 limpa' }, { name: 'Ost' }] })
    expect(r.result).toHaveProperty('note')
    expect(runTool('propose_shopping_items', { items: [{ name: 'Ägg' }] }, ctx).result).toHaveProperty('error')
    expect(runTool('propose_shopping_items', { items: [] }, ctx).result).toHaveProperty('error')
    expect(runTool('propose_shopping_items', { items: Array.from({ length: 41 }, (_, i) => ({ name: `v${i}` })) }, ctx).result).toHaveProperty('error')
  })
  it('propose_pantry_add validerar datum', () => {
    expect(runTool('propose_pantry_add', { items: [{ name: 'Smör', amount: '1 st', expires: '2026-12-01' }] }, ctx).card).toEqual({ type: 'pantry_add', items: [{ name: 'Smör', amount: '1 st', expires: '2026-12-01' }] })
    expect(runTool('propose_pantry_add', { items: [{ name: 'Smör', expires: 'snart' }] }, ctx).result).toHaveProperty('error')
  })
  it('propose_pantry_remove matchar namn mot lagret och rapporterar okända', () => {
    const r = runTool('propose_pantry_remove', { names: ['mjölk', 'Pasta', 'Kaviar'] }, ctx)
    expect(r.card).toEqual({ type: 'pantry_remove', ids: ['p1', 'p2'], names: ['Mjölk', 'Pasta'] })
    expect(JSON.stringify(r.result)).toContain('Kaviar')
    expect(runTool('propose_pantry_remove', { names: ['Kaviar'] }, ctx).result).toHaveProperty('error')
    expect(runTool('propose_pantry_remove', { names: [] }, ctx).result).toHaveProperty('error')
  })
})

describe('matinstruktioner till modellen', () => {
  it('systemprompten har matregler, standardportioner och allergier', async () => {
    const { systemPrompt } = await import('./chat')
    const base = systemPrompt(new Date('2026-11-10T12:00:00'), ctx)
    expect(base).toContain('list_pantry')
    expect(base).toContain('Standard är 2 portioner.')
    expect(base).not.toContain('Allergier/kostönskemål')
    const withAllergy = systemPrompt(new Date('2026-11-10T12:00:00'), { ...ctx, settings: { ...ctx.settings, food: { ...ctx.settings.food, allergies: 'nötter' } } })
    expect(withAllergy).toContain('Allergier/kostönskemål som du måste respektera: nötter.')
  })
})

describe('get_overview (helhetsbild)', () => {
  type Day = { date: string; weekday: string; lessons: unknown[]; events: unknown[]; tasksDue: { title: string; subject?: string }[]; reminders: { title: string; time: string }[]; packing: string[] }
  it('tar med uppgifter och påminnelser även när det inte finns några lektioner (användarens fall)', () => {
    // 2026-11-12 är en torsdag: ingen lektion, men uppgiften "Läs kapitel 3" har deadline då (och klar uppgift ska vara med som klar)
    const r = runTool('get_overview', { from: '2026-11-12' }, ctx).result as { days: Day[]; overdueTasks?: unknown[]; note?: string }
    expect(r.days).toHaveLength(1)
    expect(r.days[0]).toMatchObject({ date: '2026-11-12', weekday: 'torsdag', lessons: [] })
    expect(r.days[0].tasksDue.map((t) => [t.title, t.subject])).toEqual([['Läs kapitel 3', 'Matte'], ['Klar', undefined]])
    expect(r.note).toBeUndefined()
    expect(r.overdueTasks).toEqual([{ title: 'Gammal', subject: undefined, deadline: '2026-11-01' }])
  })
  it('dag med lektion, händelse och packlista; veckodagspåminnelse bara på rätt dag', () => {
    const r = runTool('get_overview', { from: '2026-11-09', to: '2026-11-10' }, ctx).result as { days: Day[] }
    expect(r.days[0]).toMatchObject({ weekday: 'måndag', packing: ['miniräknare'], reminders: [] })
    expect(r.days[0].lessons).toMatchObject([{ subject: 'Matte', start: '08:00' }])
    expect(r.days[1]).toMatchObject({ weekday: 'tisdag', events: [{ title: 'Prov', start: '09:00' }], reminders: [{ title: 'Ta medicin', time: '07:30' }] })
  })
  it('helt tom period ger en tydlig notering, ogiltigt intervall ger fel', () => {
    const r = runTool('get_overview', { from: '2026-12-20' }, { ...ctx, tasks: [] }).result as { note?: string }
    expect(r.note).toBe('Inget inplanerat under perioden.')
    expect((runTool('get_overview', { from: '2026-12-20' }, ctx).result as { note?: string }).note).toBeUndefined() // försenad uppgift finns
    expect(runTool('get_overview', { from: 'imorgon' }, ctx).result).toHaveProperty('error')
    expect(runTool('get_overview', { from: '2026-11-01', to: '2026-12-31' }, ctx).result).toHaveProperty('error')
    expect(runTool('get_overview', { from: '2026-11-05', to: '2026-11-01' }, ctx).result).toHaveProperty('error')
  })
})

describe('tomt svar från modellen', () => {
  it('ber om ett textsvar en gång, och ger annars ett begripligt meddelande', async () => {
    const answers = [{ choices: [{ message: { content: '' } }] }, { choices: [{ message: { content: 'Du har en uppgift imorgon.' } }] }]
    const seen: { messages: { role: string; content: string }[] }[] = []
    const fetchFn = (async (_u: string, init: RequestInit) => {
      seen.push(JSON.parse(init.body as string))
      return new Response(JSON.stringify(answers.shift()))
    }) as unknown as typeof fetch
    const r = await runChat({ ...base, userText: 'Vad har jag imorgon?', fetchFn })
    expect(r.reply).toBe('Du har en uppgift imorgon.')
    expect(seen[1].messages.at(-1)?.content).toMatch(/Svara i text/)
    const alwaysEmpty = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }))) as unknown as typeof fetch
    expect((await runChat({ ...base, userText: 'hej', fetchFn: alwaysEmpty })).reply).toMatch(/inget svar/)
  })
  it('systemprompten kräver get_overview för dag- och veckofrågor', async () => {
    const { systemPrompt } = await import('./chat')
    expect(systemPrompt(new Date('2026-11-10T12:00:00'), ctx)).toMatch(/ALLTID get_overview/)
  })
})
