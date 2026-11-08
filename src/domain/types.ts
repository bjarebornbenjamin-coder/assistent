export type ISODate = string // "YYYY-MM-DD", lokal tid
export type HHmm = string // "HH:mm", lokal tid

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  id: 'main'
  /** Antal veckor i cykeln: 1 = samma varje vecka, 2 = A/B, osv. */
  cycleLength: number
  /** En måndag som tillhör vecka 0 (A) i cykeln. */
  cycleAnchor: ISODate
  theme: Theme
}

export interface PackItem {
  id: string
  text: string
}

export interface Subject {
  id: string
  name: string
  packItems: PackItem[]
}

export interface Lesson {
  id: string
  subjectId: string
  /** 1 = måndag … 7 = söndag */
  weekday: number
  start: HHmm
  end: HHmm
  room: string
  teacher: string
  /** Index i veckocykeln som lektionen gäller; null = varje vecka. */
  weeks: number[] | null
}

export interface CalendarEvent {
  id: string
  title: string
  date: ISODate
  /** Utan starttid är händelsen heldag. */
  start?: HHmm
  end?: HHmm
  note: string
  updatedAt: string
}

export interface Contact {
  id: string
  name: string
  email: string
}

/** Sparas bara lokalt och ingår aldrig i export. */
export interface AiConfig {
  id: 'main'
  apiKey: string
  model: string
}

export type ChatCard =
  | { type: 'event'; event: Omit<CalendarEvent, 'id' | 'updatedAt'> }
  | { type: 'email'; to: string; toName?: string; subject: string; body: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  card?: ChatCard
  /** Status för kortet: väntar på ditt svar, genomfört eller avvisat. */
  cardStatus?: 'pending' | 'done' | 'dismissed'
}

export interface Backup {
  app: 'studieassistent'
  version: 3
  exportedAt: string
  settings: Settings | null
  subjects: Subject[]
  lessons: Lesson[]
  events: CalendarEvent[]
  contacts: Contact[]
}
