import { DEFAULT_MODEL } from '../ai/models'
import { SUBJECT_COLORS } from '../domain/colors'
import { mondayOf, toISODate } from '../domain/dates'
import { foodKey } from '../domain/food'
import type { Workout, AiConfig, Backup, CalendarEvent, ChatMessage, Contact, FoodSettings, Lesson, Meal, NotifySettings, NutritionSettings, PantryItem, Reminder, Settings, ShoppingItem, Subject, Task } from '../domain/types'
import { db } from './db'

export const newId = () => crypto.randomUUID()

export const DEFAULT_NOTIFY: NotifySettings = { evening: true, eveningTime: '20:00', before: false, beforeMinutes: 10, morning: true, morningTime: '07:00' }

export const DEFAULT_FOOD: FoodSettings = {
  allergies: '',
  portions: 2,
  shopping: { enabled: true, weekday: 5, time: '16:00' },
  expiry: { enabled: true, time: '08:00' },
}

export const DEFAULT_NUTRITION: NutritionSettings = { proteinG: 120, carbsG: 250, fatG: 70, waterMl: 2000, glassMl: 250 }

export function defaultSettings(): Settings {
  return { id: 'main', cycleLength: 1, cycleAnchor: mondayOf(toISODate(new Date())), theme: 'system', notify: DEFAULT_NOTIFY, food: DEFAULT_FOOD, nutrition: DEFAULT_NUTRITION, memories: [] }
}

/** Äldre sparade inställningar saknar fält som tillkommit senare. */
export function withDefaults(stored: Settings | undefined): Settings {
  const d = defaultSettings()
  if (!stored) return d
  const food = stored.food ?? DEFAULT_FOOD
  return {
    ...d,
    ...stored,
    notify: { ...DEFAULT_NOTIFY, ...(stored.notify ?? {}) },
    nutrition: { ...DEFAULT_NUTRITION, ...(stored.nutrition ?? {}) },
    memories: Array.isArray(stored.memories) ? stored.memories : [],
    food: { ...DEFAULT_FOOD, ...food, shopping: { ...DEFAULT_FOOD.shopping, ...(food.shopping ?? {}) }, expiry: { ...DEFAULT_FOOD.expiry, ...(food.expiry ?? {}) } },
  }
}

export async function getSettings(): Promise<Settings> {
  return withDefaults(await db.settings.get('main'))
}

/** Sparar inställningar och rättar lektionernas veckor om cykeln blivit kortare. */
export async function saveSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, db.lessons, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.settings.put(next)
    if (patch.cycleLength !== undefined) {
      const len = next.cycleLength
      for (const l of await db.lessons.toArray()) {
        if (l.weeks === null) continue
        const kept = l.weeks.filter((w) => w < len)
        const weeks = len === 1 || kept.length === 0 || kept.length === len ? null : kept
        if (JSON.stringify(weeks) !== JSON.stringify(l.weeks)) await db.lessons.put({ ...l, weeks })
      }
    }
  })
}

export async function addSubject(name: string): Promise<Subject> {
  const color = SUBJECT_COLORS[(await db.subjects.count()) % SUBJECT_COLORS.length].value
  const subject: Subject = { id: newId(), name: name.trim(), color, packItems: [] }
  await db.subjects.add(subject)
  return subject
}

export async function updateSubject(subject: Subject): Promise<void> {
  await db.subjects.put(subject)
}

/** Läser om ämnet i en transaktion så att snabba ändringar efter varandra inte skriver över varandra. */
export async function changePackItems(
  subjectId: string,
  change: (items: Subject['packItems']) => Subject['packItems'],
): Promise<void> {
  await db.transaction('rw', db.subjects, async () => {
    const subject = await db.subjects.get(subjectId)
    if (subject) await db.subjects.put({ ...subject, packItems: change(subject.packItems) })
  })
}

export async function deleteSubject(id: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.lessons, async () => {
    await db.lessons.where('subjectId').equals(id).delete()
    await db.subjects.delete(id)
  })
}

export async function saveLesson(lesson: Lesson): Promise<void> {
  await db.lessons.put(lesson)
}

export async function deleteLesson(id: string): Promise<void> {
  await db.lessons.delete(id)
}

export async function saveEvent(event: CalendarEvent): Promise<void> {
  await db.events.put({ ...event, updatedAt: new Date().toISOString() })
}

export async function deleteEvent(id: string): Promise<void> {
  await db.events.delete(id)
}

export async function getAiConfig(): Promise<AiConfig> {
  return (await db.aiConfig.get('main')) ?? { id: 'main', password: '', model: DEFAULT_MODEL }
}

/** Äldre ämnen saknar färg (visas då som en vit prick). Ge dem en färg ur paletten. */
export async function assignMissingColors(): Promise<void> {
  const subjects = await db.subjects.toArray()
  const missing = subjects.filter((s) => !s.color)
  if (missing.length === 0) return
  const used = new Set(subjects.map((s) => s.color).filter(Boolean))
  const free = SUBJECT_COLORS.map((c) => c.value).filter((c) => !used.has(c))
  await db.transaction('rw', db.subjects, async () => {
    for (let i = 0; i < missing.length; i++) {
      await db.subjects.put({ ...missing[i], color: free[i] ?? SUBJECT_COLORS[(subjects.length + i) % SUBJECT_COLORS.length].value })
    }
  })
}

/** Tar bort en OpenAI-nyckel som äldre versioner sparade i webbläsaren. */
export async function purgeLegacyApiKey(): Promise<void> {
  const row = (await db.aiConfig.get('main')) as (Record<string, unknown> & { id: 'main' }) | undefined
  if (row && 'apiKey' in row) {
    const { apiKey: _removed, ...rest } = row
    void _removed
    await db.aiConfig.put({ password: '', model: DEFAULT_MODEL, ...rest } as never)
  }
}

export async function saveAiConfig(patch: Partial<Omit<AiConfig, 'id'>>): Promise<void> {
  await db.aiConfig.put({ ...(await getAiConfig()), ...patch })
}

export async function saveContact(contact: Contact): Promise<void> {
  await db.contacts.put(contact)
}

export async function deleteContact(id: string): Promise<void> {
  await db.contacts.delete(id)
}

export async function addChatMessage(m: Omit<ChatMessage, 'id' | 'createdAt'>): Promise<string> {
  const id = newId()
  // Strikt stigande tidsstämplar, så att meddelanden som skapas på samma millisekund behåller sin ordning.
  const last = await db.chat.orderBy('createdAt').last()
  let at = Date.now()
  if (last && at <= new Date(last.createdAt).getTime()) at = new Date(last.createdAt).getTime() + 1
  await db.chat.add({ ...m, id, createdAt: new Date(at).toISOString() })
  return id
}

export async function setCardStatus(id: string, cardStatus: NonNullable<ChatMessage['cardStatus']>): Promise<void> {
  await db.chat.update(id, { cardStatus })
}

export async function clearChat(): Promise<void> {
  await db.chat.clear()
}

/** Bockar av/ur en packsak för ett datum och rensar rader för dagar som passerat. */
export async function setPackChecked(date: string, key: string, checked: boolean, today = toISODate(new Date())): Promise<void> {
  await db.transaction('rw', db.packChecks, async () => {
    await db.packChecks.where('date').below(today).delete()
    const row = (await db.packChecks.get(date)) ?? { date, checked: [] }
    const rest = row.checked.filter((k) => k !== key)
    await db.packChecks.put({ date, checked: checked ? [...rest, key] : rest })
  })
}

export async function saveTask(task: Task): Promise<void> {
  await db.tasks.put({ ...task, updatedAt: new Date().toISOString() })
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  await db.tasks.update(id, { done, updatedAt: new Date().toISOString() })
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id)
}

export interface LessonDraft {
  subject: string
  weekday: number
  start: string
  end: string
  room: string
  teacher: string
  weeks: number[] | null
}

/** Sparar flera lektioner på en gång. Ämnen som saknas skapas (namnjämförelse utan hänsyn till versaler). */
export async function importLessons(drafts: LessonDraft[]): Promise<{ lessons: number; newSubjects: number }> {
  return db.transaction('rw', db.subjects, db.lessons, async () => {
    const subjects = await db.subjects.toArray()
    const byName = new Map(subjects.map((s) => [s.name.trim().toLowerCase(), s.id]))
    let created = 0
    for (const d of drafts) {
      const key = d.subject.trim().toLowerCase()
      if (!byName.has(key)) {
        const color = SUBJECT_COLORS[(subjects.length + created) % SUBJECT_COLORS.length].value
        const subject: Subject = { id: newId(), name: d.subject.trim(), color, packItems: [] }
        await db.subjects.add(subject)
        byName.set(key, subject.id)
        created++
      }
      await db.lessons.add({
        id: newId(),
        subjectId: byName.get(key)!,
        weekday: d.weekday,
        start: d.start,
        end: d.end,
        room: d.room.trim(),
        teacher: d.teacher.trim(),
        weeks: d.weeks,
      })
    }
    return { lessons: drafts.length, newSubjects: created }
  })
}

export async function saveReminder(reminder: Reminder): Promise<void> {
  await db.reminders.put({ ...reminder, updatedAt: new Date().toISOString() })
}

export async function setReminderEnabled(id: string, enabled: boolean): Promise<void> {
  await db.reminders.update(id, { enabled, updatedAt: new Date().toISOString() })
}

export async function deleteReminder(id: string): Promise<void> {
  await db.reminders.delete(id)
}

export async function savePantryItem(item: PantryItem): Promise<void> {
  await db.pantry.put({ ...item, updatedAt: new Date().toISOString() })
}

export async function deletePantryItem(id: string): Promise<void> {
  await db.pantry.delete(id)
}

export async function saveShoppingItem(item: ShoppingItem): Promise<void> {
  await db.shopping.put({ ...item, updatedAt: new Date().toISOString() })
}

export async function deleteShoppingItem(id: string): Promise<void> {
  await db.shopping.delete(id)
}

export interface PantryDraft {
  name: string
  amount?: string
  expires?: string
}

/** Lägger flera varor i lagret. Om `clearFromList`, tas samma varor bort från inköpslistan (ej köpta, exakt namn). */
export async function addPantryItems(
  drafts: PantryDraft[],
  source: PantryItem['source'],
  opts: { clearFromList?: boolean; today?: string } = {},
): Promise<{ added: number; removedFromList: number }> {
  const today = opts.today ?? toISODate(new Date())
  return db.transaction('rw', db.pantry, db.shopping, async () => {
    let added = 0
    for (const d of drafts) {
      const name = d.name.trim()
      if (!name) continue
      await db.pantry.add({
        id: newId(),
        name,
        ...(d.amount?.trim() ? { amount: d.amount.trim() } : {}),
        ...(d.expires ? { expires: d.expires } : {}),
        addedAt: today,
        source,
        updatedAt: new Date().toISOString(),
      })
      added++
    }
    let removedFromList = 0
    if (opts.clearFromList) {
      const names = new Set(drafts.map((d) => foodKey(d.name)))
      const hits = (await db.shopping.toArray()).filter((i) => !i.done && names.has(foodKey(i.name)))
      await db.shopping.bulkDelete(hits.map((i) => i.id))
      removedFromList = hits.length
    }
    return { added, removedFromList }
  })
}

export interface ShoppingDraft {
  name: string
  amount?: string
  note?: string
}

/** Lägger varor på inköpslistan. Sådant som redan står på listan (ej köpt) hoppas över. */
export async function addShoppingItems(drafts: ShoppingDraft[], today = toISODate(new Date())): Promise<{ added: number; skipped: number }> {
  return db.transaction('rw', db.shopping, async () => {
    const open = new Set((await db.shopping.toArray()).filter((i) => !i.done).map((i) => foodKey(i.name)))
    let added = 0
    let skipped = 0
    for (const d of drafts) {
      const name = d.name.trim()
      if (!name || open.has(foodKey(name))) {
        skipped++
        continue
      }
      open.add(foodKey(name))
      await db.shopping.add({
        id: newId(),
        name,
        ...(d.amount?.trim() ? { amount: d.amount.trim() } : {}),
        ...(d.note?.trim() ? { note: d.note.trim() } : {}),
        done: false,
        addedAt: today,
        updatedAt: new Date().toISOString(),
      })
      added++
    }
    return { added, skipped }
  })
}

/** Flyttar avbockade varor från inköpslistan till matlagret. */
export async function moveBoughtToPantry(today = toISODate(new Date())): Promise<number> {
  return db.transaction('rw', db.shopping, db.pantry, async () => {
    const bought = (await db.shopping.toArray()).filter((i) => i.done)
    for (const i of bought) {
      await db.pantry.add({
        id: newId(),
        name: i.name,
        ...(i.amount ? { amount: i.amount } : {}),
        addedAt: today,
        source: 'shopping',
        updatedAt: new Date().toISOString(),
      })
      await db.shopping.delete(i.id)
    }
    return bought.length
  })
}

export async function clearBought(): Promise<void> {
  const ids = (await db.shopping.toArray()).filter((i) => i.done).map((i) => i.id)
  await db.shopping.bulkDelete(ids)
}

/** Varan är slut: tas bort ur lagret och läggs, om du vill, på inköpslistan. */
export async function runOut(pantryId: string, addToList: boolean): Promise<void> {
  const item = await db.pantry.get(pantryId)
  if (!item) return
  if (addToList) await addShoppingItems([{ name: item.name, amount: item.amount }])
  await db.pantry.delete(pantryId)
}

export async function saveMeal(meal: Meal): Promise<void> {
  await db.meals.put({ ...meal, updatedAt: new Date().toISOString() })
}

export async function deleteMeal(id: string): Promise<void> {
  await db.meals.delete(id)
}

/** Ändrar dagens vatten (kan inte bli negativt). Returnerar nya summan. */
export async function addWater(date: string, deltaMl: number): Promise<number> {
  return db.transaction('rw', db.water, async () => {
    const current = (await db.water.get(date))?.ml ?? 0
    const ml = Math.max(0, Math.min(20_000, Math.round(current + deltaMl)))
    await db.water.put({ id: date, date, ml, updatedAt: new Date().toISOString() })
    return ml
  })
}

export async function saveWorkout(w: Workout): Promise<void> {
  await db.workouts.put({ ...w, updatedAt: new Date().toISOString() })
}

export async function deleteWorkout(id: string): Promise<void> {
  await db.workouts.delete(id)
}

export async function exportAll(): Promise<Backup> {
  return {
    app: 'studieassistent',
    version: 8,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get('main')) ?? null,
    subjects: await db.subjects.toArray(),
    lessons: await db.lessons.toArray(),
    events: await db.events.toArray(),
    contacts: await db.contacts.toArray(),
    tasks: await db.tasks.toArray(),
    reminders: await db.reminders.toArray(),
    pantry: await db.pantry.toArray(),
    shopping: await db.shopping.toArray(),
    meals: await db.meals.toArray(),
    water: await db.water.toArray(),
    workouts: await db.workouts.toArray(),
  }
}

/** Ersätter all data med innehållet i säkerhetskopian. */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction('rw', [db.settings, db.subjects, db.lessons, db.events, db.contacts, db.tasks, db.reminders, db.pantry, db.shopping, db.meals, db.water, db.workouts], async () => {
    await Promise.all([db.workouts.clear(), db.meals.clear(), db.water.clear(), db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear(), db.tasks.clear(), db.reminders.clear(), db.pantry.clear(), db.shopping.clear()])
    if (backup.settings) await db.settings.put(backup.settings)
    await db.subjects.bulkPut(backup.subjects)
    await db.lessons.bulkPut(backup.lessons)
    await db.events.bulkPut(backup.events)
    await db.contacts.bulkPut(backup.contacts)
    await db.tasks.bulkPut(backup.tasks)
    await db.reminders.bulkPut(backup.reminders)
    await db.pantry.bulkPut(backup.pantry)
    await db.shopping.bulkPut(backup.shopping)
    await db.meals.bulkPut(backup.meals)
    await db.water.bulkPut(backup.water)
    await db.workouts.bulkPut(backup.workouts)
  })
}
