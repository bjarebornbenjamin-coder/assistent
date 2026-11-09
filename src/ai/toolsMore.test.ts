import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { getSettings, saveSettings } from '../db/repo'
import { applyCard } from './cards'
import { runChat, systemPrompt } from './chat'
import { TOOL_DEFINITIONS, runTool, type ToolContext } from './tools'

const ctx: ToolContext = {
  settings: {
    id: 'main', cycleLength: 2, cycleAnchor: '2026-11-02', theme: 'system',
    notify: { evening: true, eveningTime: '20:00', before: false, beforeMinutes: 10, morning: false, morningTime: '07:00' },
    food: { allergies: '', portions: 2, shopping: { enabled: true, weekday: 5, time: '16:00' }, expiry: { enabled: true, time: '08:00' } },
    nutrition: { proteinG: 120, carbsG: 250, fatG: 70, waterMl: 2000, glassMl: 250 },
    memories: ['Gillar inte svamp'],
  },
  subjects: [{ id: 'ma', name: 'Matte', packItems: [{ id: 'p1', text: 'Miniräknare' }] }, { id: 'sv', name: 'Svenska', packItems: [] }],
  lessons: [], events: [], contacts: [{ id: 'c1', name: 'Olle', email: 'olle@example.com' }],
  tasks: [
    { id: 't1', title: 'Läs kapitel 3', deadline: '2026-11-12', done: false, updatedAt: '' },
    { id: 't2', title: 'Läs kapitel 4', deadline: '2026-11-13', done: false, updatedAt: '' },
  ],
  pantry: [{ id: 'pa1', name: 'Mjölk', amount: '1 l', expires: '2026-11-12', addedAt: '2026-11-01', source: 'manual', updatedAt: '' }],
  shopping: [{ id: 's1', name: 'Ägg', done: false, addedAt: '2026-11-01', updatedAt: '' }, { id: 's2', name: 'Bröd', done: false, addedAt: '2026-11-01', updatedAt: '' }],
  reminders: [{ id: 'r1', title: 'Ta medicin', time: '07:30', repeat: { kind: 'daily' }, enabled: true, updatedAt: '' }],
  meals: [], water: [], workouts: [], today: '2026-11-10',
}
const run = (name: string, args: Record<string, unknown>) => runTool(name, args, ctx)
const isErr = (name: string, args: Record<string, unknown>) => expect(run(name, args).result).toHaveProperty('error')

describe('nya verktyg: läsa', () => {
  it('påminnelser och ämnen', () => {
    expect(run('list_reminders', {}).result).toEqual({ reminders: [{ title: 'Ta medicin', time: '07:30', repeat: 'Varje dag', on: true }] })
    expect(run('list_subjects', {}).result).toEqual({ subjects: [{ name: 'Matte', packing: ['Miniräknare'] }, { name: 'Svenska', packing: [] }] })
  })
  it('alla verktyg har unika namn och är fler än 35', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.function.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names.length).toBeGreaterThan(35)
  })
})

describe('nya verktyg: förslag', () => {
  it('påminnelse: skapa (alla upprepningar) och ta bort', () => {
    expect(run('propose_reminder', { title: 'Plugga', time: '18:00', repeat: 'weekdays', days: [3, 1, 1] }).card).toEqual({ type: 'reminder_add', reminder: { title: 'Plugga', time: '18:00', repeat: { kind: 'weekdays', days: [1, 3] } } })
    expect(run('propose_reminder', { title: 'Ring', time: '12:00', repeat: 'once', date: '2026-11-11' }).card).toMatchObject({ reminder: { repeat: { kind: 'once', date: '2026-11-11' } } })
    isErr('propose_reminder', { title: 'x', time: '25:00', repeat: 'daily' })
    isErr('propose_reminder', { title: 'x', time: '10:00', repeat: 'once' })
    isErr('propose_reminder', { title: 'x', time: '10:00', repeat: 'weekdays', days: [9] })
    expect(run('propose_reminder_delete', { title: 'medicin' }).card).toMatchObject({ type: 'reminder_delete', id: 'r1' })
    isErr('propose_reminder_delete', { title: 'finns inte' })
  })
  it('uppgift: bocka av, flytta, ta bort; flera träffar ger fråga', () => {
    expect(run('propose_task_update', { title: 'kapitel 3', done: true }).card).toMatchObject({ type: 'task_update', id: 't1', after: { title: 'Läs kapitel 3', deadline: '2026-11-12', done: true } })
    expect(run('propose_task_update', { title: 'Läs kapitel 4', deadline: '2026-11-20' }).card).toMatchObject({ after: { deadline: '2026-11-20' } })
    expect(JSON.stringify(run('propose_task_update', { title: 'Läs', done: true }).result)).toContain('Flera träffar')
    isErr('propose_task_update', { title: 'Läs kapitel 3' }) // ingen ändring
    expect(run('propose_task_delete', { title: 'kapitel 4' }).card).toMatchObject({ type: 'task_delete', id: 't2' })
  })
  it('lektion: nytt ämne går bra, A/B-vecka valideras', () => {
    expect(run('propose_lesson', { subject: 'Fysik', weekday: 3, start: '10:00', end: '11:00', room: 'F1', week: 'b' }).card).toEqual({ type: 'lesson_add', subject: 'Fysik', lesson: { weekday: 3, start: '10:00', end: '11:00', room: 'F1', teacher: '', weeks: [1] } })
    isErr('propose_lesson', { subject: 'Fysik', weekday: 8, start: '10:00', end: '11:00' })
    isErr('propose_lesson', { subject: 'Fysik', weekday: 3, start: '11:00', end: '10:00' })
    isErr('propose_lesson', { subject: 'Fysik', weekday: 3, start: '10:00', end: '11:00', week: 'C' })
  })
  it('packlista: lägger bara till nytt och tar bara bort det som finns', () => {
    expect(run('propose_pack_items', { subject: 'matte', add: ['Linjal', 'miniräknare', 'linjal'], remove: ['Miniräknare', 'Passare'] }).card).toEqual({ type: 'pack_update', subjectId: 'ma', subjectName: 'Matte', add: ['Linjal'], remove: ['Miniräknare'] })
    isErr('propose_pack_items', { subject: 'Matte', add: ['miniräknare'] })
  })
  it('inköpslista, lager, kontakt', () => {
    expect(run('propose_shopping_update', { mark_bought: ['ägg'], remove: ['Bröd', 'Ost'] }).card).toEqual({ type: 'shopping_update', boughtIds: ['s1'], removeIds: ['s2'], bought: ['Ägg'], removed: ['Bröd'] })
    isErr('propose_shopping_update', { mark_bought: ['Ost'] })
    expect(run('propose_pantry_update', { name: 'mjölk', amount: '0,5 l', expires: '' }).card).toEqual({ type: 'pantry_update', id: 'pa1', before: 'Mjölk, 1 l, bäst före tors 12 nov.', after: { name: 'Mjölk', amount: '0,5 l' } })
    isErr('propose_pantry_update', { name: 'Mjölk', expires: 'snart' })
    expect(run('propose_contact', { name: 'Anna', email: 'anna@example.com' }).card).toEqual({ type: 'contact_add', contact: { name: 'Anna', email: 'anna@example.com' } })
    isErr('propose_contact', { name: 'Olle 2', email: 'OLLE@example.com' })
    isErr('propose_contact', { name: 'X', email: 'inte-en-adress' })
  })
  it('inställningar och minne', () => {
    expect(run('propose_preferences', { allergies: 'nötter', protein_g: 140, water_ml: 2500 }).card).toEqual({
      type: 'prefs_update', food: { allergies: 'nötter' }, nutrition: { proteinG: 140, waterMl: 2500 },
      summary: ['Allergier/kost: nötter', 'Protein: 140 g per dag', 'Vatten: 2500 ml per dag'],
    })
    isErr('propose_preferences', {})
    isErr('propose_preferences', { portions: 99 })
    expect(run('remember', { fact: 'Tränar helst på morgonen' }).card).toEqual({ type: 'memory_add', fact: 'Tränar helst på morgonen' })
    isErr('remember', { fact: 'gillar inte svamp' })
    expect(run('forget', { fact: 'svamp' }).card).toEqual({ type: 'memory_delete', fact: 'Gillar inte svamp' })
  })
})

describe('systemprompt', () => {
  it('innehåller minnet, att allt kan göras via verktyg, och den sammanvägda matregeln', () => {
    const p = systemPrompt(new Date('2026-11-10T12:00:00'), ctx)
    expect(p).toContain('- Gillar inte svamp')
    expect(p).toMatch(/läsa och ändra allt i appen/)
    expect(p).toMatch(/get_nutrition för idag och get_overview för idag/)
    expect(p).toMatch(/träning idag/)
    expect(p).toMatch(/ETABLERADE, kända rätter/)
    expect(systemPrompt(new Date(), { ...ctx, settings: { ...ctx.settings, memories: [] } })).toContain('Inget sparat i minnet än.')
  })
  it('tillåter fler steg per fråga (minst 8 verktygsrundor)', async () => {
    let calls = 0
    const fetchFn = (async () => {
      calls++
      const body = calls < 9 ? { choices: [{ message: { content: null, tool_calls: [{ id: `c${calls}`, type: 'function', function: { name: 'list_reminders', arguments: '{}' } }] } }] } : { choices: [{ message: { content: 'Klart.' } }] }
      return new Response(JSON.stringify(body))
    }) as unknown as typeof fetch
    const r = await runChat({ headers: {}, model: 'm', history: [], userText: 'hej', now: new Date(), loadContext: async () => ctx, fetchFn })
    expect(r.reply).toBe('Klart.')
  })
})

describe('applyCard: nya kort', () => {
  beforeEach(async () => {
    await Promise.all([db.reminders.clear(), db.tasks.clear(), db.subjects.clear(), db.lessons.clear(), db.shopping.clear(), db.pantry.clear(), db.contacts.clear(), db.settings.clear()])
  })
  it('påminnelse, uppgift, lektion med nytt ämne, packlista', async () => {
    await applyCard({ type: 'reminder_add', reminder: { title: 'Plugga', time: '18:00', repeat: { kind: 'daily' } } })
    const r = (await db.reminders.toArray())[0]
    expect(r).toMatchObject({ title: 'Plugga', enabled: true })
    expect(await applyCard({ type: 'reminder_delete', id: r.id, summary: '' })).toBe('done')
    expect(await applyCard({ type: 'reminder_delete', id: r.id, summary: '' })).toBe('missing')

    await db.tasks.put({ id: 't1', title: 'Läs', deadline: '2026-11-12', done: false, updatedAt: '' })
    await applyCard({ type: 'task_update', id: 't1', before: '', after: { title: 'Läs', deadline: '2026-11-15', done: true } })
    expect(await db.tasks.get('t1')).toMatchObject({ deadline: '2026-11-15', done: true })
    await applyCard({ type: 'task_delete', id: 't1', summary: '' })
    expect(await db.tasks.count()).toBe(0)

    await applyCard({ type: 'lesson_add', subject: 'Fysik', lesson: { weekday: 3, start: '10:00', end: '11:00', room: 'F1', teacher: '', weeks: null } })
    await applyCard({ type: 'lesson_add', subject: 'fysik', lesson: { weekday: 4, start: '10:00', end: '11:00', room: '', teacher: '', weeks: null } })
    expect(await db.subjects.count()).toBe(1) // samma ämne återanvänds
    expect(await db.lessons.count()).toBe(2)

    const fys = (await db.subjects.toArray())[0]
    await db.subjects.put({ ...fys, packItems: [{ id: 'x', text: 'Formelblad' }] })
    await applyCard({ type: 'pack_update', subjectId: fys.id, subjectName: 'Fysik', add: ['Miniräknare', 'formelblad'], remove: ['Formelblad'] })
    expect((await db.subjects.get(fys.id))!.packItems.map((p) => p.text).sort()).toEqual(['Miniräknare', 'formelblad'])
  })
  it('inköpslista, lager, kontakt, inställningar och minne', async () => {
    await db.shopping.bulkPut([{ id: 's1', name: 'Ägg', done: false, addedAt: '2026-11-01', updatedAt: '' }, { id: 's2', name: 'Bröd', done: false, addedAt: '2026-11-01', updatedAt: '' }])
    await applyCard({ type: 'shopping_update', boughtIds: ['s1'], removeIds: ['s2'], bought: ['Ägg'], removed: ['Bröd'] })
    expect(await db.shopping.toArray()).toEqual([expect.objectContaining({ id: 's1', done: true })])
    expect(await applyCard({ type: 'shopping_update', boughtIds: ['x'], removeIds: [], bought: [], removed: [] })).toBe('missing')

    await db.pantry.put({ id: 'p', name: 'Mjölk', amount: '1 l', expires: '2026-11-12', addedAt: '2026-11-01', source: 'manual', updatedAt: '' })
    await applyCard({ type: 'pantry_update', id: 'p', before: '', after: { name: 'Mjölk', amount: '0,5 l' } })
    const milk = (await db.pantry.get('p'))!
    expect(milk.amount).toBe('0,5 l')
    expect(milk.expires).toBeUndefined()

    await applyCard({ type: 'contact_add', contact: { name: 'Anna', email: 'anna@example.com' } })
    expect(await db.contacts.count()).toBe(1)

    await applyCard({ type: 'prefs_update', food: { allergies: 'nötter' }, nutrition: { proteinG: 140 }, summary: [] })
    const s = await getSettings()
    expect(s.food).toMatchObject({ allergies: 'nötter', portions: 2 })
    expect(s.nutrition).toMatchObject({ proteinG: 140, carbsG: 250 })

    await applyCard({ type: 'memory_add', fact: 'Gillar inte svamp' })
    await applyCard({ type: 'memory_add', fact: 'gillar inte svamp' })
    expect((await getSettings()).memories).toEqual(['Gillar inte svamp'])
    expect(await applyCard({ type: 'memory_delete', fact: 'Gillar inte svamp' })).toBe('done')
    expect((await getSettings()).memories).toEqual([])
    await saveSettings({ memories: ['a'] })
    expect(await applyCard({ type: 'memory_delete', fact: 'b' })).toBe('missing')
  })
})

describe('plan_study', () => {
  it('ger en plan och påminner om att lägga in provet', () => {
    const out = runTool('plan_study', { exam: 'Matteprov', date: '2026-11-20', topics: ['Derivata', 'Integraler'] }, { ...ctx, today: '2026-11-10', nowTime: '12:00' }).result as { plan: { eventTitle: string }[]; examInCalendar: boolean }
    expect(out.plan.map((p) => p.eventTitle)).toEqual(['Plugg Matteprov: Derivata', 'Plugg Matteprov: Integraler', 'Plugg Matteprov: Repetition av allt och gamla prov'])
    expect(out.examInCalendar).toBe(false)
    expect(runTool('plan_study', { exam: 'X', date: '2026-11-10' }, { ...ctx, today: '2026-11-10' }).result).toHaveProperty('error')
  })
})
