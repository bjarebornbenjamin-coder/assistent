import { beforeEach, describe, expect, it } from 'vitest'
import { parseBackup } from './backup'
import { db } from './db'
import { addChatMessage, addPantryItems, addShoppingItems, addSubject, changePackItems, clearBought, moveBoughtToPantry, runOut, deleteSubject, exportAll, getSettings, importAll, importLessons, newId, purgeLegacyApiKey, saveEvent, saveLesson, setPackChecked, saveSettings, updateSubject } from './repo'

const lesson = (subjectId: string, weeks: number[] | null) => ({
  id: newId(), subjectId, weekday: 1, start: '08:00', end: '09:00', room: 'A1', teacher: 'Lena', weeks,
})

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear(), db.chat.clear(), db.aiConfig.clear(), db.packChecks.clear(), db.tasks.clear(), db.reminders.clear(), db.pantry.clear(), db.shopping.clear()])
})

describe('repo', () => {
  it('tar bort lektioner när ämnet tas bort', async () => {
    const s = await addSubject(' Matte ')
    expect(s.name).toBe('Matte')
    await saveLesson(lesson(s.id, null))
    await deleteSubject(s.id)
    expect(await db.lessons.count()).toBe(0)
  })

  it('rättar lektionernas veckor när cykeln ändras', async () => {
    const s = await addSubject('Matte')
    const onlyB = lesson(s.id, [1])
    const both = lesson(s.id, [0, 1])
    await saveLesson(onlyB)
    await saveLesson(both)
    await saveSettings({ cycleLength: 2 })
    expect((await db.lessons.get(both.id))!.weeks).toBeNull() // alla veckor = null
    expect((await db.lessons.get(onlyB.id))!.weeks).toEqual([1])
    await saveSettings({ cycleLength: 1 })
    expect((await db.lessons.get(onlyB.id))!.weeks).toBeNull()
  })

  it('export → import ger samma data', async () => {
    const s = await addSubject('Matte')
    await updateSubject({ ...s, packItems: [{ id: newId(), text: 'miniräknare' }] })
    await saveLesson(lesson(s.id, [0]))
    await saveSettings({ cycleLength: 2, theme: 'dark' })
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll())))
    await Promise.all([db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear(), db.chat.clear(), db.aiConfig.clear(), db.packChecks.clear(), db.tasks.clear(), db.reminders.clear(), db.pantry.clear(), db.shopping.clear()])
    await importAll(backup)
    expect((await getSettings()).theme).toBe('dark')
    expect(await db.subjects.count()).toBe(1)
    expect((await db.lessons.toArray())[0].weeks).toEqual([0])
  })
})

describe('parseBackup', () => {
  it('avvisar fel filer', () => {
    expect(() => parseBackup({})).toThrow(/inte från appen/)
    expect(() => parseBackup({ app: 'studieassistent', version: 7 })).toThrow(/version/)
    expect(() =>
      parseBackup({ app: 'studieassistent', version: 1, settings: null, subjects: [], lessons: [{ id: 'x', subjectId: 'y', weekday: 1, start: '08:00', end: '09:00', room: '', teacher: '', weeks: null }] }),
    ).toThrow(/ämne som inte finns/)
    expect(() =>
      parseBackup({ app: 'studieassistent', version: 1, settings: null, subjects: [], lessons: [{ id: 'x', subjectId: 'y', weekday: 9, start: '08:00', end: '09:00', room: '', teacher: '', weeks: null }] }),
    ).toThrow(/veckodag/)
  })
})

describe('changePackItems', () => {
  it('förlorar inga ändringar vid snabba anrop efter varandra', async () => {
    const s = await addSubject('Matte')
    await Promise.all(['a', 'b', 'c'].map((text) => changePackItems(s.id, (items) => [...items, { id: newId(), text }])))
    expect((await db.subjects.get(s.id))!.packItems.map((i) => i.text).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('händelser', () => {
  it('export → import behåller händelser, och version 1 utan händelser går att läsa', async () => {
    await saveEvent({ id: newId(), title: 'Prov i matte', date: '2026-11-12', start: '09:00', note: 'kap 4', updatedAt: '' })
    await saveEvent({ id: newId(), title: 'Inlämning', date: '2026-11-13', note: '', updatedAt: '' })
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll())))
    expect(backup.events).toHaveLength(2)
    await db.events.clear()
    await importAll(backup)
    expect((await db.events.toArray()).map((e) => e.title).sort()).toEqual(['Inlämning', 'Prov i matte'])
    const old = parseBackup({ app: 'studieassistent', version: 1, settings: null, subjects: [], lessons: [] })
    expect(old.events).toEqual([])
  })
  it('avvisar sluttid utan starttid', () => {
    const bad = { app: 'studieassistent', version: 2, subjects: [], lessons: [], events: [{ id: 'x', title: 't', date: '2026-11-12', end: '10:00', note: '' }] }
    expect(() => parseBackup(bad)).toThrow(/sluttid/)
  })
})

describe('ämnesfärg', () => {
  it('nya ämnen får olika färger och färgen följer med export/import', async () => {
    const a = await addSubject('A')
    const b = await addSubject('B')
    expect(a.color).toMatch(/^#/)
    expect(b.color).not.toBe(a.color)
    const copy = parseBackup(JSON.parse(JSON.stringify(await exportAll())))
    expect(copy.subjects.find((s) => s.id === a.id)?.color).toBe(a.color)
  })
  it('avvisar ogiltig färg men tillåter ämnen utan färg', () => {
    const base = { app: 'studieassistent', version: 3, lessons: [] }
    expect(() => parseBackup({ ...base, subjects: [{ id: '1', name: 'x', color: 'red', packItems: [] }] })).toThrow(/ämnesfärg/)
    expect(parseBackup({ ...base, subjects: [{ id: '1', name: 'x', packItems: [] }] }).subjects[0].color).toBeUndefined()
  })
})

describe('avbockad packlista', () => {
  it('sparas per datum, kan avbockas igen och gamla dagar städas bort', async () => {
    await setPackChecked('2026-11-08', 'bok', true, '2026-11-08')
    await setPackChecked('2026-11-09', 'dator', true, '2026-11-08')
    await setPackChecked('2026-11-09', 'bok', true, '2026-11-08')
    expect((await db.packChecks.get('2026-11-09'))!.checked.sort()).toEqual(['bok', 'dator'])
    await setPackChecked('2026-11-09', 'bok', false, '2026-11-09') // nästa dag: gårdagens rad rensas
    expect((await db.packChecks.get('2026-11-09'))!.checked).toEqual(['dator'])
    expect(await db.packChecks.get('2026-11-08')).toBeUndefined()
  })
})

describe('äldre OpenAI-nyckel', () => {
  it('tas bort från webbläsaren men inställningar i övrigt behålls', async () => {
    await db.aiConfig.put({ id: 'main', apiKey: 'sk-gammal', model: 'gpt-4.1' } as never)
    await purgeLegacyApiKey()
    const row = (await db.aiConfig.get('main')) as unknown as Record<string, unknown>
    expect(row).not.toHaveProperty('apiKey')
    expect(row.model).toBe('gpt-4.1')
    expect(JSON.stringify(row)).not.toContain('sk-gammal')
  })
})

describe('importLessons', () => {
  it('skapar saknade ämnen en gång, återanvänder befintliga och sparar allt eller inget', async () => {
    const matte = await addSubject('Matte')
    const draft = (subject: string, start: string) => ({ subject, weekday: 1, start, end: '23:00', room: ' A1 ', teacher: '', weeks: null })
    const r = await importLessons([draft('matte', '08:00'), draft('Spanska', '09:00'), draft('SPANSKA', '10:00')])
    expect(r).toEqual({ lessons: 3, newSubjects: 1 })
    expect(await db.subjects.count()).toBe(2)
    const lessons = await db.lessons.toArray()
    expect(lessons.filter((l) => l.subjectId === matte.id)).toHaveLength(1)
    expect(lessons[0].room).toBe('A1')
  })
})

describe('påminnelser i export', () => {
  it('följer med export/import, och ogiltiga avvisas', async () => {
    await db.reminders.put({ id: 'r1', title: 'Ta medicin', time: '07:30', repeat: { kind: 'weekdays', days: [1, 3, 5] }, enabled: true, updatedAt: '' })
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll())))
    expect(backup.reminders).toHaveLength(1)
    await db.reminders.clear()
    await importAll(backup)
    expect((await db.reminders.get('r1'))?.repeat).toEqual({ kind: 'weekdays', days: [1, 3, 5] })
    const base = { app: 'studieassistent', version: 5, subjects: [], lessons: [] }
    expect(() => parseBackup({ ...base, reminders: [{ id: 'x', title: 't', time: '25:00', repeat: { kind: 'daily' } }] })).toThrow(/påminnelse/)
    expect(() => parseBackup({ ...base, reminders: [{ id: 'x', title: 't', time: '07:00', repeat: { kind: 'weekdays', days: [] } }] })).toThrow(/upprepning/)
    expect(parseBackup({ ...base, version: 4 }).reminders).toEqual([])
  })
})

describe('chattordning', () => {
  it('behåller ordningen även när meddelanden skapas samtidigt', async () => {
    await db.chat.clear()
    const orig = Date.now
    Date.now = () => 1_800_000_000_000 // fryst klocka
    try {
      for (const t of ['1', '2', '3', '4']) await addChatMessage({ role: 'user', content: t })
    } finally {
      Date.now = orig
    }
    expect((await db.chat.orderBy('createdAt').toArray()).map((m) => m.content)).toEqual(['1', '2', '3', '4'])
  })
})

describe('mat i export', () => {
  it('lager och inköpslista följer med export/import; ogiltigt avvisas; äldre filer får tomma listor', async () => {
    await db.pantry.put({ id: 'p1', name: 'Mjölk', amount: '1 l', expires: '2026-11-12', addedAt: '2026-11-08', source: 'receipt', updatedAt: '' })
    await db.shopping.put({ id: 's1', name: 'Ägg', done: false, addedAt: '2026-11-08', updatedAt: '' })
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll())))
    expect(backup.pantry).toHaveLength(1)
    expect(backup.shopping).toHaveLength(1)
    await Promise.all([db.pantry.clear(), db.shopping.clear()])
    await importAll(backup)
    expect((await db.pantry.get('p1'))?.expires).toBe('2026-11-12')
    expect((await db.shopping.get('s1'))?.name).toBe('Ägg')
    const base = { app: 'studieassistent', version: 6, subjects: [], lessons: [] }
    expect(() => parseBackup({ ...base, pantry: [{ id: 'x', name: '', addedAt: '2026-11-08' }] })).toThrow(/matvara/)
    expect(() => parseBackup({ ...base, shopping: [{ id: 'x' }] })).toThrow(/inköpsvara/)
    expect(parseBackup({ ...base, version: 5 })).toMatchObject({ pantry: [], shopping: [] })
  })
})

describe('inköpslista', () => {
  beforeEach(async () => {
    await Promise.all([db.shopping.clear(), db.pantry.clear()])
  })
  it('hoppar över dubbletter (skiftlägesokänsligt) men tillåter igen när varan är köpt', async () => {
    expect(await addShoppingItems([{ name: 'Mjölk' }, { name: ' mjölk ' }, { name: 'Ägg', amount: '10 st' }, { name: '  ' }])).toEqual({ added: 2, skipped: 2 })
    const milk = (await db.shopping.toArray()).find((i) => i.name === 'Mjölk')!
    await db.shopping.update(milk.id, { done: true })
    expect((await addShoppingItems([{ name: 'mjölk' }])).added).toBe(1) // den köpta räknas inte
  })
  it('köpta varor flyttas till lagret, resten ligger kvar', async () => {
    await addShoppingItems([{ name: 'Mjölk', amount: '1 l' }, { name: 'Ägg' }])
    const milk = (await db.shopping.toArray()).find((i) => i.name === 'Mjölk')!
    await db.shopping.update(milk.id, { done: true })
    expect(await moveBoughtToPantry('2026-11-10')).toBe(1)
    expect((await db.pantry.toArray())[0]).toMatchObject({ name: 'Mjölk', amount: '1 l', source: 'shopping', addedAt: '2026-11-10' })
    expect((await db.shopping.toArray()).map((i) => i.name)).toEqual(['Ägg'])
  })
  it('rensa köpta och "slut" med eller utan inköpslista', async () => {
    await addShoppingItems([{ name: 'A' }, { name: 'B' }])
    const a = (await db.shopping.toArray()).find((i) => i.name === 'A')!
    await db.shopping.update(a.id, { done: true })
    await clearBought()
    expect((await db.shopping.toArray()).map((i) => i.name)).toEqual(['B'])
    await db.pantry.bulkAdd([
      { id: 'p1', name: 'Smör', amount: '1 st', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
      { id: 'p2', name: 'Ost', addedAt: '2026-11-01', source: 'manual', updatedAt: '' },
    ])
    await runOut('p1', true)
    await runOut('p2', false)
    expect(await db.pantry.count()).toBe(0)
    expect((await db.shopping.toArray()).map((i) => i.name).sort()).toEqual(['B', 'Smör'])
  })
})

describe('addPantryItems', () => {
  it('sparar varor med källa och datum, och rensar samma varor från inköpslistan', async () => {
    await Promise.all([db.pantry.clear(), db.shopping.clear()])
    await addShoppingItems([{ name: 'Mjölk' }, { name: 'Ägg' }, { name: 'Bröd' }])
    const r = await addPantryItems([{ name: ' mjölk ', amount: '1 l', expires: '2026-11-17' }, { name: 'Ris' }, { name: '  ' }], 'receipt', { clearFromList: true, today: '2026-11-10' })
    expect(r).toEqual({ added: 2, removedFromList: 1 })
    const items = await db.pantry.toArray()
    expect(items.find((i) => i.name === 'mjölk')).toMatchObject({ amount: '1 l', expires: '2026-11-17', source: 'receipt', addedAt: '2026-11-10' })
    expect((await db.shopping.toArray()).map((i) => i.name).sort()).toEqual(['Bröd', 'Ägg'])
  })
})
