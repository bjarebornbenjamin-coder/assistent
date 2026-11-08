import { beforeEach, describe, expect, it } from 'vitest'
import { parseBackup } from './backup'
import { db } from './db'
import { addSubject, changePackItems, deleteSubject, exportAll, getSettings, importAll, newId, saveEvent, saveLesson, saveSettings, updateSubject } from './repo'

const lesson = (subjectId: string, weeks: number[] | null) => ({
  id: newId(), subjectId, weekday: 1, start: '08:00', end: '09:00', room: 'A1', teacher: 'Lena', weeks,
})

beforeEach(async () => {
  await Promise.all([db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear(), db.chat.clear(), db.aiConfig.clear()])
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
    await Promise.all([db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear(), db.chat.clear(), db.aiConfig.clear()])
    await importAll(backup)
    expect((await getSettings()).theme).toBe('dark')
    expect(await db.subjects.count()).toBe(1)
    expect((await db.lessons.toArray())[0].weeks).toEqual([0])
  })
})

describe('parseBackup', () => {
  it('avvisar fel filer', () => {
    expect(() => parseBackup({})).toThrow(/inte från appen/)
    expect(() => parseBackup({ app: 'studieassistent', version: 4 })).toThrow(/version/)
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
