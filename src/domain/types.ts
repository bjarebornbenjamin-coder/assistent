export type ISODate = string // "YYYY-MM-DD", lokal tid
export type HHmm = string // "HH:mm", lokal tid

export type Theme = 'system' | 'light' | 'dark'

export interface NotifySettings {
  /** Kvällsnotis om morgondagens lektioner och vad du ska ta med. */
  evening: boolean
  eveningTime: HHmm
  /** Notis en stund före varje lektion. */
  before: boolean
  beforeMinutes: number
  /** Morgonöversikt: dagens lektioner, packlista, deadlines, händelser och mat som går ut. */
  morning: boolean
  morningTime: HHmm
}

export interface FoodSettings {
  /** Allergier och kostönskemål i fri text, skickas med när recept föreslås. */
  allergies: string
  portions: number
  /** Notis med inköpslistan en viss veckodag (1 = måndag … 7 = söndag). */
  shopping: { enabled: boolean; weekday: number; time: HHmm }
  /** Notis när mat snart går ut. */
  expiry: { enabled: boolean; time: HHmm }
}

export interface NutritionSettings {
  proteinG: number
  carbsG: number
  fatG: number
  waterMl: number
  /** Storlek på ett glas vatten för snabbknappen. */
  glassMl: number
}

export interface Settings {
  id: 'main'
  /** Antal veckor i cykeln: 1 = samma varje vecka, 2 = A/B, osv. */
  cycleLength: number
  /** En måndag som tillhör vecka 0 (A) i cykeln. */
  cycleAnchor: ISODate
  theme: Theme
  notify: NotifySettings
  food: FoodSettings
  nutrition: NutritionSettings
  /** Saker användaren bett assistenten komma ihåg (preferenser). */
  memories: string[]
}

export interface PackItem {
  id: string
  text: string
}

export interface Subject {
  id: string
  name: string
  /** Hex-färg, t.ex. #1a73e8. Saknas för äldre ämnen. */
  color?: string
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

export type ReminderRepeat =
  | { kind: 'once'; date: ISODate }
  | { kind: 'daily' }
  /** Valda veckodagar, 1 = måndag … 7 = söndag. En enda dag = varje vecka. */
  | { kind: 'weekdays'; days: number[] }

export interface Reminder {
  id: string
  title: string
  time: HHmm
  repeat: ReminderRepeat
  enabled: boolean
  updatedAt: string
}

export interface PantryItem {
  id: string
  name: string
  /** Fri text, t.ex. "2 st" eller "500 g". */
  amount?: string
  expires?: ISODate
  addedAt: ISODate
  source: 'manual' | 'receipt' | 'fridge' | 'shopping'
  updatedAt: string
}

export interface ShoppingItem {
  id: string
  name: string
  amount?: string
  done: boolean
  /** Varifrån varan kom, t.ex. receptets namn. */
  note?: string
  addedAt: ISODate
  updatedAt: string
}

export interface Meal {
  id: string
  date: ISODate
  time?: HHmm
  name: string
  /** Utelämnas = beräknas från makron (4/4/9 kcal per gram). */
  kcal?: number
  protein: number
  carbs: number
  fat: number
  source: 'manual' | 'ai' | 'recipe'
  updatedAt: string
}

/** Dagens vatten. id = datum, så en rad per dag. */
export interface WaterDay {
  id: ISODate
  date: ISODate
  ml: number
  updatedAt: string
}

export interface Task {
  id: string
  title: string
  subjectId?: string
  deadline: ISODate
  /** Klockslag då uppgiften ska vara inne, t.ex. 23:59. */
  time?: HHmm
  note?: string
  done: boolean
  updatedAt: string
}

/** Avbockade packsaker för en viss dag (nycklar enligt itemKey). Sparas inte i export. */
export interface PackChecks {
  date: ISODate
  checked: string[]
}

export interface Contact {
  id: string
  name: string
  email: string
}

/** Sparas bara lokalt och ingår aldrig i export. OpenAI-nyckeln finns bara på servern. */
export interface AiConfig {
  id: 'main'
  /** Lösenord till appens server (api/chat). */
  password: string
  model: string
  /** Senast hämtade modelllista från OpenAI. */
  models?: string[]
}

export type ChatCard =
  | { type: 'event'; event: Omit<CalendarEvent, 'id' | 'updatedAt'> }
  | { type: 'reminder_add'; reminder: Omit<Reminder, 'id' | 'updatedAt' | 'enabled'> }
  | { type: 'reminder_delete'; id: string; summary: string }
  | { type: 'task_update'; id: string; before: string; after: Pick<Task, 'title' | 'deadline' | 'done' | 'time' | 'note'> }
  | { type: 'task_delete'; id: string; summary: string }
  | { type: 'lesson_add'; subject: string; lesson: Pick<Lesson, 'weekday' | 'start' | 'end' | 'room' | 'teacher' | 'weeks'> }
  | { type: 'pack_update'; subjectId: string; subjectName: string; add: string[]; remove: string[] }
  | { type: 'shopping_update'; boughtIds: string[]; removeIds: string[]; bought: string[]; removed: string[] }
  | { type: 'pantry_update'; id: string; before: string; after: Pick<PantryItem, 'name'> & Partial<Pick<PantryItem, 'amount' | 'expires'>> }
  | { type: 'contact_add'; contact: Omit<Contact, 'id'> }
  | { type: 'prefs_update'; food: Partial<Pick<FoodSettings, 'allergies' | 'portions'>>; nutrition: Partial<NutritionSettings>; summary: string[] }
  | { type: 'memory_add'; fact: string }
  | { type: 'memory_delete'; fact: string }
  | { type: 'events_add'; events: Omit<CalendarEvent, 'id' | 'updatedAt'>[] }
  | { type: 'task'; task: Pick<Task, 'title' | 'subjectId' | 'deadline' | 'time' | 'note'> }
  | { type: 'event_update'; id: string; before: string; afterText: string; after: Omit<CalendarEvent, 'id' | 'updatedAt'> }
  | { type: 'meal_add'; meal: Pick<Meal, 'date' | 'name' | 'protein' | 'carbs' | 'fat'> & Partial<Pick<Meal, 'time' | 'kcal'>> }
  | { type: 'water_add'; date: ISODate; ml: number }
  | { type: 'shopping_add'; items: { name: string; amount?: string }[] }
  | { type: 'pantry_add'; items: { name: string; amount?: string; expires?: ISODate }[] }
  | { type: 'pantry_remove'; ids: string[]; names: string[] }
  | { type: 'event_delete'; id: string; summary: string }
  | { type: 'lesson_update'; id: string; before: string; afterText: string; after: Pick<Lesson, 'weekday' | 'start' | 'end' | 'room' | 'teacher'> }
  | { type: 'lesson_delete'; id: string; summary: string }
  | { type: 'email'; to: string; toName?: string; subject: string; body: string }

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  card?: ChatCard
  /** Status för kortet: väntar på ditt svar, genomfört eller avvisat. */
  cardStatus?: 'pending' | 'done' | 'dismissed' | 'missing'
}

export interface Backup {
  app: 'studieassistent'
  version: 7
  exportedAt: string
  settings: Settings | null
  subjects: Subject[]
  lessons: Lesson[]
  events: CalendarEvent[]
  contacts: Contact[]
  tasks: Task[]
  reminders: Reminder[]
  pantry: PantryItem[]
  shopping: ShoppingItem[]
  meals: Meal[]
  water: WaterDay[]
}
