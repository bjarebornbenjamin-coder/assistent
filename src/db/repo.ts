import { mondayOf, toISODate } from '../domain/dates'
import type { AiConfig, Backup, CalendarEvent, ChatMessage, Contact, Lesson, Settings, Subject } from '../domain/types'
import { db } from './db'

export const newId = () => crypto.randomUUID()

export function defaultSettings(): Settings {
  return { id: 'main', cycleLength: 1, cycleAnchor: mondayOf(toISODate(new Date())), theme: 'system' }
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('main')) ?? defaultSettings()
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
  const subject: Subject = { id: newId(), name: name.trim(), packItems: [] }
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

export const DEFAULT_MODEL = 'gpt-4o-mini'

export async function getAiConfig(): Promise<AiConfig> {
  return (await db.aiConfig.get('main')) ?? { id: 'main', apiKey: '', model: DEFAULT_MODEL }
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
  await db.chat.add({ ...m, id, createdAt: new Date().toISOString() })
  return id
}

export async function setCardStatus(id: string, cardStatus: NonNullable<ChatMessage['cardStatus']>): Promise<void> {
  await db.chat.update(id, { cardStatus })
}

export async function clearChat(): Promise<void> {
  await db.chat.clear()
}

export async function exportAll(): Promise<Backup> {
  return {
    app: 'studieassistent',
    version: 3,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get('main')) ?? null,
    subjects: await db.subjects.toArray(),
    lessons: await db.lessons.toArray(),
    events: await db.events.toArray(),
    contacts: await db.contacts.toArray(),
  }
}

/** Ersätter all data med innehållet i säkerhetskopian. */
export async function importAll(backup: Backup): Promise<void> {
  await db.transaction('rw', db.settings, db.subjects, db.lessons, db.events, db.contacts, async () => {
    await Promise.all([db.settings.clear(), db.subjects.clear(), db.lessons.clear(), db.events.clear(), db.contacts.clear()])
    if (backup.settings) await db.settings.put(backup.settings)
    await db.subjects.bulkPut(backup.subjects)
    await db.lessons.bulkPut(backup.lessons)
    await db.events.bulkPut(backup.events)
    await db.contacts.bulkPut(backup.contacts)
  })
}
