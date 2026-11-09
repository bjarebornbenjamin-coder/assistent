import { DEFAULT_FOOD, DEFAULT_NOTIFY, DEFAULT_NUTRITION } from './repo'
import { isColor } from '../domain/colors'
import type { Backup, CalendarEvent, Contact, Lesson, Meal, PantryItem, Reminder, ShoppingItem, Task, WaterDay, Settings, Subject } from '../domain/types'

const fail = (msg: string): never => {
  throw new Error(`Ogiltig säkerhetskopia: ${msg}`)
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isStr = (v: unknown): v is string => typeof v === 'string'
const isDate = (v: unknown) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)
const isTime = (v: unknown) => isStr(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

function parseSettings(v: unknown): Settings {
  if (!isObj(v)) return fail('inställningar saknas')
  const { cycleLength, cycleAnchor, theme } = v
  if (typeof cycleLength !== 'number' || !Number.isInteger(cycleLength) || cycleLength < 1 || cycleLength > 4)
    fail('veckocykel')
  if (!isDate(cycleAnchor)) fail('ankardatum')
  if (theme !== 'system' && theme !== 'light' && theme !== 'dark') fail('tema')
  const n = isObj(v.notify) ? v.notify : {}
  const notify = {
    evening: typeof n.evening === 'boolean' ? n.evening : DEFAULT_NOTIFY.evening,
    eveningTime: isTime(n.eveningTime) ? (n.eveningTime as string) : DEFAULT_NOTIFY.eveningTime,
    before: typeof n.before === 'boolean' ? n.before : DEFAULT_NOTIFY.before,
    beforeMinutes: typeof n.beforeMinutes === 'number' && n.beforeMinutes >= 0 && n.beforeMinutes <= 240 ? n.beforeMinutes : DEFAULT_NOTIFY.beforeMinutes,
  }
  const f = isObj(v.food) ? v.food : {}
  const sh = isObj(f.shopping) ? f.shopping : {}
  const ex = isObj(f.expiry) ? f.expiry : {}
  const food = {
    allergies: isStr(f.allergies) ? f.allergies.slice(0, 500) : DEFAULT_FOOD.allergies,
    portions: typeof f.portions === 'number' && f.portions >= 1 && f.portions <= 12 ? Math.round(f.portions) : DEFAULT_FOOD.portions,
    shopping: {
      enabled: typeof sh.enabled === 'boolean' ? sh.enabled : DEFAULT_FOOD.shopping.enabled,
      weekday: typeof sh.weekday === 'number' && sh.weekday >= 1 && sh.weekday <= 7 ? sh.weekday : DEFAULT_FOOD.shopping.weekday,
      time: isTime(sh.time) ? (sh.time as string) : DEFAULT_FOOD.shopping.time,
    },
    expiry: { enabled: typeof ex.enabled === 'boolean' ? ex.enabled : DEFAULT_FOOD.expiry.enabled, time: isTime(ex.time) ? (ex.time as string) : DEFAULT_FOOD.expiry.time },
  }
  const nu = isObj(v.nutrition) ? v.nutrition : {}
  const num = (x: unknown, min: number, max: number, d: number) => (typeof x === 'number' && x >= min && x <= max ? Math.round(x) : d)
  const nutrition = {
    proteinG: num(nu.proteinG, 0, 1000, DEFAULT_NUTRITION.proteinG),
    carbsG: num(nu.carbsG, 0, 2000, DEFAULT_NUTRITION.carbsG),
    fatG: num(nu.fatG, 0, 1000, DEFAULT_NUTRITION.fatG),
    waterMl: num(nu.waterMl, 0, 20000, DEFAULT_NUTRITION.waterMl),
    glassMl: num(nu.glassMl, 50, 2000, DEFAULT_NUTRITION.glassMl),
  }
  return { id: 'main', cycleLength, cycleAnchor, theme, notify, food, nutrition } as Settings
}

function parseSubject(v: unknown): Subject {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !Array.isArray(v.packItems)) return fail('ämne')
  const packItems = v.packItems.map((p) => {
    if (!isObj(p) || !isStr(p.id) || !isStr(p.text)) return fail('packlista')
    return { id: p.id as string, text: p.text as string }
  })
  if (v.color !== undefined && !isColor(v.color)) fail('ämnesfärg')
  return { id: v.id, name: v.name, ...(v.color !== undefined ? { color: v.color as string } : {}), packItems }
}

function parseLesson(v: unknown): Lesson {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.subjectId)) return fail('lektion')
  if (typeof v.weekday !== 'number' || v.weekday < 1 || v.weekday > 7) fail('veckodag')
  if (!isTime(v.start) || !isTime(v.end)) fail('lektionstid')
  if (!isStr(v.room) || !isStr(v.teacher)) fail('sal eller lärare')
  let weeks: number[] | null = null
  if (v.weeks !== null) {
    if (!Array.isArray(v.weeks) || !v.weeks.every((w) => Number.isInteger(w) && w >= 0 && w < 4)) fail('veckor')
    weeks = v.weeks as number[]
  }
  return {
    id: v.id,
    subjectId: v.subjectId,
    weekday: v.weekday as number,
    start: v.start as string,
    end: v.end as string,
    room: v.room as string,
    teacher: v.teacher as string,
    weeks,
  }
}

function parseEvent(v: unknown): CalendarEvent {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !v.title.trim()) return fail('händelse')
  if (!isDate(v.date)) fail('händelsedatum')
  const hasStart = v.start !== undefined
  if (hasStart && !isTime(v.start)) fail('starttid')
  if (v.end !== undefined && (!hasStart || !isTime(v.end) || (v.end as string) <= (v.start as string))) fail('sluttid')
  return {
    id: v.id,
    title: v.title,
    date: v.date as string,
    ...(hasStart ? { start: v.start as string } : {}),
    ...(v.end !== undefined ? { end: v.end as string } : {}),
    note: isStr(v.note) ? v.note : '',
    updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString(),
  }
}

function parseContact(v: unknown): Contact {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !isStr(v.email)) return fail('kontakt')
  return { id: v.id, name: v.name, email: v.email }
}

function parseTask(v: unknown): Task {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !v.title.trim() || !isDate(v.deadline)) return fail('uppgift')
  if (v.subjectId !== undefined && !isStr(v.subjectId)) fail('uppgiftens ämne')
  return {
    id: v.id,
    title: v.title,
    ...(v.subjectId !== undefined ? { subjectId: v.subjectId as string } : {}),
    deadline: v.deadline as string,
    done: v.done === true,
    updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString(),
  }
}

function parseReminder(v: unknown): Reminder {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.title) || !v.title.trim() || !isTime(v.time) || !isObj(v.repeat)) return fail('påminnelse')
  const rep = v.repeat
  let repeat: Reminder['repeat']
  if (rep.kind === 'daily') repeat = { kind: 'daily' }
  else if (rep.kind === 'once' && isDate(rep.date)) repeat = { kind: 'once', date: rep.date as string }
  else if (rep.kind === 'weekdays' && Array.isArray(rep.days) && rep.days.length > 0 && rep.days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7))
    repeat = { kind: 'weekdays', days: [...new Set(rep.days as number[])].sort() }
  else return fail('påminnelsens upprepning')
  return { id: v.id, title: v.title, time: v.time as string, repeat, enabled: v.enabled !== false, updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString() }
}

const SOURCES = ['manual', 'receipt', 'fridge', 'shopping']

function parsePantry(v: unknown): PantryItem {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !v.name.trim() || !isDate(v.addedAt)) return fail('matvara')
  if (v.expires !== undefined && !isDate(v.expires)) fail('bäst före-datum')
  return {
    id: v.id,
    name: v.name,
    ...(isStr(v.amount) && v.amount ? { amount: v.amount } : {}),
    ...(v.expires !== undefined ? { expires: v.expires as string } : {}),
    addedAt: v.addedAt as string,
    source: SOURCES.includes(v.source as string) ? (v.source as PantryItem['source']) : 'manual',
    updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString(),
  }
}

function parseShopping(v: unknown): ShoppingItem {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !v.name.trim()) return fail('inköpsvara')
  return {
    id: v.id,
    name: v.name,
    ...(isStr(v.amount) && v.amount ? { amount: v.amount } : {}),
    done: v.done === true,
    ...(isStr(v.note) && v.note ? { note: v.note } : {}),
    addedAt: isDate(v.addedAt) ? (v.addedAt as string) : new Date().toISOString().slice(0, 10),
    updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString(),
  }
}

const grams = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : null)

function parseMeal(v: unknown): Meal {
  if (!isObj(v) || !isStr(v.id) || !isStr(v.name) || !v.name.trim() || !isDate(v.date)) return fail('måltid')
  const protein = grams(v.protein, 1000)
  const carbs = grams(v.carbs, 2000)
  const fat = grams(v.fat, 1000)
  if (protein === null || carbs === null || fat === null) return fail('måltidens näringsvärden')
  const kcal = v.kcal === undefined ? null : grams(v.kcal, 10000)
  if (v.kcal !== undefined && kcal === null) fail('måltidens kalorier')
  if (v.time !== undefined && !isTime(v.time)) fail('måltidens tid')
  return {
    id: v.id,
    date: v.date as string,
    ...(v.time !== undefined ? { time: v.time as string } : {}),
    name: v.name,
    ...(kcal !== null ? { kcal } : {}),
    protein,
    carbs,
    fat,
    source: v.source === 'ai' || v.source === 'recipe' ? v.source : 'manual',
    updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString(),
  }
}

function parseWater(v: unknown): WaterDay {
  if (!isObj(v) || !isDate(v.date) || v.id !== v.date) return fail('vattenrad')
  const ml = grams(v.ml, 20000)
  if (ml === null) return fail('vattenmängd')
  return { id: v.date as string, date: v.date as string, ml: Math.round(ml), updatedAt: isStr(v.updatedAt) ? v.updatedAt : new Date().toISOString() }
}

export function parseBackup(json: unknown): Backup {
  if (!isObj(json) || json.app !== 'studieassistent') return fail('filen kommer inte från appen')
  if (![1, 2, 3, 4, 5, 6, 7].includes(json.version as number)) return fail(`okänd version (${String(json.version)})`)
  if (!Array.isArray(json.subjects) || !Array.isArray(json.lessons)) return fail('data saknas')
  const subjects = json.subjects.map(parseSubject)
  const lessons = json.lessons.map(parseLesson)
  const events = Array.isArray(json.events) ? json.events.map(parseEvent) : [] // version 1 saknar händelser
  const meals = Array.isArray(json.meals) ? json.meals.map(parseMeal) : []
  const water = Array.isArray(json.water) ? json.water.map(parseWater) : []
  const pantry = Array.isArray(json.pantry) ? json.pantry.map(parsePantry) : []
  const shopping = Array.isArray(json.shopping) ? json.shopping.map(parseShopping) : []
  const reminders = Array.isArray(json.reminders) ? json.reminders.map(parseReminder) : []
  const tasks = Array.isArray(json.tasks) ? json.tasks.map(parseTask) : []
  const contacts = Array.isArray(json.contacts) ? json.contacts.map(parseContact) : []
  const ids = new Set(subjects.map((s) => s.id))
  if (lessons.some((l) => !ids.has(l.subjectId))) fail('lektion pekar på ett ämne som inte finns')
  return {
    app: 'studieassistent',
    version: 7,
    exportedAt: isStr(json.exportedAt) ? json.exportedAt : new Date().toISOString(),
    settings: json.settings == null ? null : parseSettings(json.settings),
    subjects,
    lessons,
    events,
    contacts,
    tasks,
    reminders,
    pantry,
    shopping,
    meals,
    water,
  }
}
