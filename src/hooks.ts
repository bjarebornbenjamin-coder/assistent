import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from './db/db'
import { defaultSettings, getAiConfig } from './db/repo'
import type { AiConfig, CalendarEvent, ChatMessage, Contact, Lesson, Settings, Subject } from './domain/types'

/** undefined medan data läses från IndexedDB. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => (await db.settings.get('main')) ?? defaultSettings(), [])
}
export function useSubjects(): Subject[] | undefined {
  return useLiveQuery(() => db.subjects.orderBy('name').toArray(), [])
}
export function useLessons(): Lesson[] | undefined {
  return useLiveQuery(() => db.lessons.toArray(), [])
}

export function useEvents(): CalendarEvent[] | undefined {
  return useLiveQuery(() => db.events.toArray(), [])
}

export function useContacts(): Contact[] | undefined {
  return useLiveQuery(() => db.contacts.orderBy('name').toArray(), [])
}
export function useAiConfig(): AiConfig | undefined {
  return useLiveQuery(() => getAiConfig(), [])
}
export function useChat(): ChatMessage[] | undefined {
  return useLiveQuery(() => db.chat.orderBy('createdAt').toArray(), [])
}

/** Aktuell tid, uppdateras varje minut. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  return now
}
