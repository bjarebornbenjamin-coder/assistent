import { WEEKDAYS_LONG, WEEKDAYS_SHORT } from '../domain/dates'
import { findConflicts } from '../domain/schedule'
import type { Lesson, Subject } from '../domain/types'
import { ChatError } from './chat'
import { callVision, visionMessages } from './vision'

export interface ImportRow {
  key: string
  subject: string
  weekday: number
  start: string
  end: string
  room: string
  teacher: string
  /** Vecka i cykeln (0 = A, 1 = B …), null = varje vecka. */
  week: number | null
  include: boolean
}

export const IMPORT_PROMPT = [
  'Du läser av en bild av ett skolschema och returnerar lektionerna som JSON. Svara ENDAST med JSON, ingen annan text.',
  'Format: {"lessons":[{"subject":"Spanska","weekday":1,"start":"08:20","end":"09:40","room":"A1","teacher":"Rosa","week":null}]}',
  'weekday: 1=måndag … 7=söndag. Tider som HH:mm (24 timmar). room och teacher är tomma strängar om de inte syns.',
  'week: "A" eller "B" om schemat tydligt skiljer veckor åt för just den lektionen, annars null.',
  'Ta bara med riktiga lektioner (inte raster, lunch eller tomma rutor). Hitta inte på något som inte syns i bilden. Om en cell är oläslig, hoppa över den.',
].join('\n')

export const buildMessages = (imageDataUrl: string) => visionMessages(IMPORT_PROMPT, 'Läs av det här schemat.', imageDataUrl)

const DAY_NAMES: Record<string, number> = {}
WEEKDAYS_LONG.forEach((d, i) => {
  DAY_NAMES[d] = i + 1
  DAY_NAMES[WEEKDAYS_SHORT[i].toLowerCase()] = i + 1
})
DAY_NAMES['tors'] = 4

function normalizeWeekday(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 7) return v
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase().replace(/\.$/, '')
    if (/^[1-7]$/.test(t)) return Number(t)
    return DAY_NAMES[t] ?? null
  }
  return null
}

export function normalizeTime(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d{1,2})[.:h]?(\d{2})?\s*$/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2] ?? '0')
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function normalizeWeek(v: unknown, cycleLength: number): number | null {
  if (typeof v === 'string' && /^[A-Da-d]$/.test(v.trim())) {
    const i = v.trim().toUpperCase().charCodeAt(0) - 65
    return i < cycleLength ? i : null
  }
  return null
}

/** Tolkar modellens svar. Ogiltiga lektioner räknas som överhoppade i stället för att kasta fel. */
export function parseImportResponse(text: string, cycleLength: number): { rows: ImportRow[]; skipped: number } {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(cleaned)
  } catch {
    throw new ChatError('Kunde inte tolka svaret från AI:n. Försök igen eller använd en tydligare bild.')
  }
  const list = Array.isArray(data) ? data : (data as { lessons?: unknown })?.lessons
  if (!Array.isArray(list)) throw new ChatError('Svaret innehöll inga lektioner.')
  const rows: ImportRow[] = []
  let skipped = 0
  list.forEach((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>
    const subject = typeof r.subject === 'string' ? r.subject.trim() : ''
    const weekday = normalizeWeekday(r.weekday)
    const start = normalizeTime(r.start)
    const end = normalizeTime(r.end)
    if (!subject || weekday === null || !start || !end || end <= start) return void skipped++
    rows.push({
      key: `r${i}`,
      subject,
      weekday,
      start,
      end,
      room: typeof r.room === 'string' ? r.room.trim() : '',
      teacher: typeof r.teacher === 'string' ? r.teacher.trim() : '',
      week: normalizeWeek(r.week, cycleLength),
      include: true,
    })
  })
  return { rows, skipped }
}

/** Skickar bilden via appens server till OpenAI och returnerar råtexten i svaret. */
export function readScheduleImage(
  imageDataUrl: string,
  model: string,
  headers: Record<string, string>,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  return callVision({ system: IMPORT_PROMPT, text: 'Läs av det här schemat.', image: imageDataUrl, model, headers }, fetchFn)
}

export interface RowStatus {
  valid: boolean
  duplicate: boolean
  conflicts: string[]
}

const norm = (s: string) => s.trim().toLowerCase()
const weeksOf = (week: number | null) => (week === null ? null : [week])

/** Kontrollerar rader mot varandra och mot befintligt schema. */
export function analyzeRows(rows: ImportRow[], existing: Lesson[], subjects: Subject[], cycleLength: number): Map<string, RowStatus> {
  const nameOf = (id: string) => subjects.find((s) => s.id === id)?.name ?? ''
  const asLesson = (r: ImportRow): Lesson => ({ id: r.key, subjectId: r.subject, weekday: r.weekday, start: r.start, end: r.end, room: r.room, teacher: r.teacher, weeks: weeksOf(r.week) })
  const out = new Map<string, RowStatus>()
  for (const r of rows) {
    const valid = Boolean(r.subject.trim()) && Boolean(r.start) && Boolean(r.end) && r.end > r.start
    const duplicate = existing.some(
      (l) =>
        norm(nameOf(l.subjectId)) === norm(r.subject) &&
        l.weekday === r.weekday &&
        l.start === r.start &&
        l.end === r.end &&
        JSON.stringify(l.weeks) === JSON.stringify(weeksOf(r.week)),
    )
    const conflicts: string[] = []
    if (valid && !duplicate) {
      const others = rows.filter((o) => o.key !== r.key && o.include).map(asLesson)
      for (const c of findConflicts(asLesson(r), existing, cycleLength)) conflicts.push(`${nameOf(c.subjectId)} ${c.start}–${c.end}`)
      for (const c of findConflicts(asLesson(r), others, cycleLength)) conflicts.push(`${c.subjectId} ${c.start}–${c.end} (ny)`)
    }
    out.set(r.key, { valid, duplicate, conflicts })
  }
  return out
}
