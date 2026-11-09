import Dexie, { type Table } from 'dexie'
import type { Workout, AiConfig, CalendarEvent, ChatMessage, Contact, Lesson, Meal, PackChecks, PantryItem, Reminder, ShoppingItem, Task, WaterDay, Settings, Subject } from '../domain/types'

export class AppDB extends Dexie {
  settings!: Table<Settings, string>
  subjects!: Table<Subject, string>
  lessons!: Table<Lesson, string>
  events!: Table<CalendarEvent, string>
  contacts!: Table<Contact, string>
  aiConfig!: Table<AiConfig, string>
  chat!: Table<ChatMessage, string>
  packChecks!: Table<PackChecks, string>
  tasks!: Table<Task, string>
  reminders!: Table<Reminder, string>
  pantry!: Table<PantryItem, string>
  shopping!: Table<ShoppingItem, string>
  meals!: Table<Meal, string>
  water!: Table<WaterDay, string>
  workouts!: Table<Workout, string>
  /** Lokala, osynkade inställningar per enhet (t.ex. bakgrundsbild). */
  local!: Table<{ key: string; value: string; updatedAt: string }, string>
  /** Synk: innehållets hash vid senaste synk, per post. */
  syncState!: Table<{ key: string; hash: string }, string>
  syncMeta!: Table<{ key: 'main'; userId: string; cursor: string | null }, string>

  constructor(name = 'studieassistent') {
    super(name)
    this.version(1).stores({
      settings: 'id',
      subjects: 'id, name',
      lessons: 'id, subjectId, weekday',
    })
    this.version(2).stores({ events: 'id, date' })
    this.version(3).stores({ contacts: 'id, name', aiConfig: 'id', chat: 'id, createdAt' })
    this.version(4).stores({ packChecks: 'date' })
    this.version(5).stores({ tasks: 'id, deadline' })
    this.version(6).stores({ syncState: 'key', syncMeta: 'key' })
    this.version(7).stores({ reminders: 'id' })
    this.version(8).stores({ pantry: 'id, expires', shopping: 'id' })
    this.version(9).stores({ meals: 'id, date', water: 'id' })
    this.version(10).stores({ local: 'key' })
    this.version(11).stores({ workouts: 'id, date' })
  }
}

export const db = new AppDB()
