import { eventsOn } from '../domain/calendar'
import { addDays, daysBetween } from '../domain/dates'
import { packingFor } from '../domain/packing'
import { lessonsOn } from '../domain/schedule'
import type { CalendarEvent, ChatCard, Contact, Lesson, Settings, Subject } from '../domain/types'

export interface ToolContext {
  settings: Settings
  lessons: Lesson[]
  subjects: Subject[]
  events: CalendarEvent[]
  contacts: Contact[]
}

export interface ToolOutcome {
  result: unknown
  /** Förslag som användaren måste bekräfta innan något händer. */
  card?: ChatCard
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const date = { type: 'string', description: 'Datum som YYYY-MM-DD' }

export const TOOL_DEFINITIONS = [
  {
    name: 'get_schedule',
    description: 'Hämta användarens lektioner (ämne, tid, sal, lärare) för ett visst datum.',
    parameters: { type: 'object', properties: { date }, required: ['date'] },
  },
  {
    name: 'get_packing_list',
    description: 'Hämta vad användaren ska ta med till skolan ett visst datum, utifrån dagens lektioner.',
    parameters: { type: 'object', properties: { date }, required: ['date'] },
  },
  {
    name: 'list_events',
    description: 'Lista kalenderhändelser (prov, inlämningar, aktiviteter) från och med ett datum till och med ett annat. Max 62 dagar.',
    parameters: { type: 'object', properties: { from: date, to: date }, required: ['from', 'to'] },
  },
  {
    name: 'find_contact',
    description: 'Slå upp kontakter på namn (delsträng räcker). Returnerar namn och e-postadress.',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
  {
    name: 'propose_event',
    description:
      'Föreslå en ny kalenderhändelse. Den läggs INTE in förrän användaren bekräftat i appen. Utelämna start för heldag.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date,
        start: { type: 'string', description: 'HH:mm, utelämna för heldag' },
        end: { type: 'string', description: 'HH:mm, kräver start' },
        note: { type: 'string' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'draft_email',
    description:
      'Skriv ett mejlutkast. Mejlet SKICKAS INTE av dig; användaren granskar utkastet och öppnar det i sitt mejlprogram. "to" är en kontakts namn eller en e-postadress.',
    parameters: {
      type: 'object',
      properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
      required: ['to', 'subject', 'body'],
    },
  },
].map((f) => ({ type: 'function' as const, function: f }))

type Args = Record<string, unknown>
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const err = (message: string): ToolOutcome => ({ result: { error: message } })

function lessonView(l: Lesson, subjects: Subject[]) {
  return {
    subject: subjects.find((s) => s.id === l.subjectId)?.name ?? 'Okänt ämne',
    start: l.start,
    end: l.end,
    room: l.room || undefined,
    teacher: l.teacher || undefined,
  }
}

export function findContacts(name: string, contacts: Contact[]): Contact[] {
  const q = name.toLowerCase()
  const exact = contacts.filter((c) => c.name.toLowerCase() === q)
  return exact.length > 0 ? exact : contacts.filter((c) => c.name.toLowerCase().includes(q))
}

export function runTool(name: string, args: Args, ctx: ToolContext): ToolOutcome {
  switch (name) {
    case 'get_schedule': {
      const d = str(args.date)
      if (!DATE.test(d)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      return { result: { date: d, lessons: lessonsOn(d, ctx.lessons, ctx.settings).map((l) => lessonView(l, ctx.subjects)) } }
    }
    case 'get_packing_list': {
      const d = str(args.date)
      if (!DATE.test(d)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      const groups = packingFor(lessonsOn(d, ctx.lessons, ctx.settings), ctx.subjects)
      return { result: { date: d, packing: groups.map((g) => ({ subject: g.subject.name, items: g.items.map((i) => i.text) })) } }
    }
    case 'list_events': {
      const from = str(args.from)
      const to = str(args.to)
      if (!DATE.test(from) || !DATE.test(to)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      const span = daysBetween(from, to)
      if (span < 0 || span > 62) return err('Intervallet måste vara 0–62 dagar.')
      const events = Array.from({ length: span + 1 }, (_, i) => eventsOn(addDays(from, i), ctx.events)).flat()
      return { result: { events: events.map((e) => ({ title: e.title, date: e.date, start: e.start, end: e.end, note: e.note || undefined })) } }
    }
    case 'find_contact': {
      const found = findContacts(str(args.name), ctx.contacts)
      return { result: { contacts: found.map((c) => ({ name: c.name, email: c.email })) } }
    }
    case 'propose_event': {
      const title = str(args.title)
      const d = str(args.date)
      const start = str(args.start)
      const end = str(args.end)
      if (!title) return err('Titel saknas.')
      if (!DATE.test(d)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      if (start && !TIME.test(start)) return err('Ogiltig starttid, använd HH:mm.')
      if (end && (!start || !TIME.test(end) || end <= start)) return err('Ogiltig sluttid.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Förslaget visas för användaren. Det är inte inlagt än.' },
        card: { type: 'event', event: { title, date: d, ...(start ? { start } : {}), ...(end ? { end } : {}), note: str(args.note) } },
      }
    }
    case 'draft_email': {
      const to = str(args.to)
      const subject = str(args.subject)
      const body = str(args.body)
      if (!to || !subject || !body) return err('Mottagare, ämne och text krävs.')
      let email = to
      let toName: string | undefined
      if (!to.includes('@')) {
        const found = findContacts(to, ctx.contacts)
        if (found.length === 0) return err(`Ingen kontakt som matchar "${to}". Be användaren ange e-postadress eller lägga till kontakten i Inställningar.`)
        if (found.length > 1) return err(`Flera kontakter matchar: ${found.map((c) => `${c.name} <${c.email}>`).join(', ')}. Fråga användaren vilken som avses.`)
        email = found[0].email
        toName = found[0].name
      }
      return {
        result: { status: 'draft_shown_to_user', message: 'Utkastet visas för användaren. Inget mejl har skickats.' },
        card: { type: 'email', to: email, toName, subject, body },
      }
    }
    default:
      return err(`Okänt verktyg: ${name}`)
  }
}
