import Dexie, { type Table } from 'dexie'
import type { AiConfig, CalendarEvent, ChatMessage, Contact, Lesson, PackChecks, Settings, Subject } from '../domain/types'

export class AppDB extends Dexie {
  settings!: Table<Settings, string>
  subjects!: Table<Subject, string>
  lessons!: Table<Lesson, string>
  events!: Table<CalendarEvent, string>
  contacts!: Table<Contact, string>
  aiConfig!: Table<AiConfig, string>
  chat!: Table<ChatMessage, string>
  packChecks!: Table<PackChecks, string>

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
  }
}

export const db = new AppDB()
