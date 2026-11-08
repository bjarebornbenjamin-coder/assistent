import { isColor } from '../domain/colors'
import type { Backup, CalendarEvent, Contact, Lesson, Task, Settings, Subject } from '../domain/types'

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
  return { id: 'main', cycleLength, cycleAnchor, theme } as Settings
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

export function parseBackup(json: unknown): Backup {
  if (!isObj(json) || json.app !== 'studieassistent') return fail('filen kommer inte från appen')
  if (![1, 2, 3, 4].includes(json.version as number)) return fail(`okänd version (${String(json.version)})`)
  if (!Array.isArray(json.subjects) || !Array.isArray(json.lessons)) return fail('data saknas')
  const subjects = json.subjects.map(parseSubject)
  const lessons = json.lessons.map(parseLesson)
  const events = Array.isArray(json.events) ? json.events.map(parseEvent) : [] // version 1 saknar händelser
  const tasks = Array.isArray(json.tasks) ? json.tasks.map(parseTask) : []
  const contacts = Array.isArray(json.contacts) ? json.contacts.map(parseContact) : []
  const ids = new Set(subjects.map((s) => s.id))
  if (lessons.some((l) => !ids.has(l.subjectId))) fail('lektion pekar på ett ämne som inte finns')
  return {
    app: 'studieassistent',
    version: 4,
    exportedAt: isStr(json.exportedAt) ? json.exportedAt : new Date().toISOString(),
    settings: json.settings == null ? null : parseSettings(json.settings),
    subjects,
    lessons,
    events,
    contacts,
    tasks,
  }
}
