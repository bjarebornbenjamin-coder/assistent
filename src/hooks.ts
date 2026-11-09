import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'
import { db } from './db/db'
import { getAiConfig, withDefaults } from './db/repo'
import type { Workout, AiConfig, CalendarEvent, ChatMessage, Contact, Meal, PantryItem, Reminder, ShoppingItem, Task, WaterDay, Lesson, Settings, Subject } from './domain/types'

/** undefined medan data läses från IndexedDB. */
export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => withDefaults(await db.settings.get('main')), [])
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

export function useTasks(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.orderBy('deadline').toArray(), [])
}
export function useReminders(): Reminder[] | undefined {
  return useLiveQuery(() => db.reminders.toArray(), [])
}
export function usePantry(): PantryItem[] | undefined {
  return useLiveQuery(() => db.pantry.toArray(), [])
}
export function useShopping(): ShoppingItem[] | undefined {
  return useLiveQuery(() => db.shopping.toArray(), [])
}
export function useMeals(): Meal[] | undefined {
  return useLiveQuery(() => db.meals.toArray(), [])
}
export function useWater(): WaterDay[] | undefined {
  return useLiveQuery(() => db.water.toArray(), [])
}
export function useWorkouts(): Workout[] | undefined {
  return useLiveQuery(() => db.workouts.toArray(), [])
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

/** Ett felmeddelande kopplat till ett fält; försvinner när det fältet ändras. */
export function useFieldError() {
  const [state, setState] = useState<{ field: string; message: string } | null>(null)
  const fail = useCallback((field: string, message: string) => setState({ field, message }), [])
  const touch = useCallback((field: string) => setState((e) => (e && e.field === field ? null : e)), [])
  return { error: state?.message ?? '', fail, touch }
}

/** Avbockade packsaker (nycklar) för ett datum. */
export function usePackChecks(date: string | undefined): Set<string> | undefined {
  return useLiveQuery(async () => new Set((date ? await db.packChecks.get(date) : undefined)?.checked ?? []), [date])
}
