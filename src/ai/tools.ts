import { dayLabel, eventTime, eventsOn } from '../domain/calendar'
import { WEEKDAYS_LONG, addDays, daysBetween, weekdayOf } from '../domain/dates'
import { packingFor } from '../domain/packing'
import { lessonsOn } from '../domain/schedule'
import { daysLeft, foodKey } from '../domain/food'
import { goalKcal, lastDays, mealKcal, mealsOn } from '../domain/nutrition'
import { occursOn } from '../domain/reminders'
import { tasksOn } from '../domain/tasks'
import { toISODate } from '../domain/dates'
import type { CalendarEvent, ChatCard, Contact, Lesson, Meal, PantryItem, Reminder, Settings, ShoppingItem, Subject, Task, WaterDay } from '../domain/types'

export interface ToolContext {
  settings: Settings
  lessons: Lesson[]
  subjects: Subject[]
  events: CalendarEvent[]
  contacts: Contact[]
  tasks: Task[]
  pantry: PantryItem[]
  shopping: ShoppingItem[]
  reminders: Reminder[]
  meals: Meal[]
  water: WaterDay[]
  /** Dagens datum (sätts av chatten så att svaren följer appens klocka). */
  today?: string
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
    description: 'Hämta BARA användarens lektioner (ämne, tid, sal, lärare) för ett visst datum. För frågor om vad användaren har en dag eller vecka: använd get_overview i stället, som även innehåller uppgifter, händelser och påminnelser.',
    parameters: { type: 'object', properties: { date }, required: ['date'] },
  },
  {
    name: 'get_overview',
    description:
      'Helhetsbild för en dag eller ett datumintervall: lektioner, kalenderhändelser, uppgifter med deadline, påminnelser och packlista per dag, samt försenade uppgifter. Använd ALLTID denna för frågor som "vad har jag imorgon/idag/i veckan". Max 14 dagar.',
    parameters: { type: 'object', properties: { from: date, to: { ...date, description: 'Sista datum, samma som from för en enda dag' } }, required: ['from'] },
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
    name: 'list_tasks',
    description: 'Lista läxor/uppgifter med deadline från och med ett datum till och med ett annat (och försenade ej klara om include_overdue är true).',
    parameters: {
      type: 'object',
      properties: {
        from: date,
        to: date,
        include_done: { type: 'boolean', description: 'Ta med redan klara uppgifter (standard false)' },
        include_overdue: { type: 'boolean', description: 'Ta med försenade ej klara uppgifter före from (standard true)' },
      },
      required: ['from', 'to'],
    },
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
    name: 'propose_task',
    description: 'Föreslå en ny läxa/uppgift med deadline. Den läggs INTE in förrän användaren bekräftat i appen. "subject" är ämnets namn (valfritt).',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' }, deadline: date, subject: { type: 'string' } },
      required: ['title', 'deadline'],
    },
  },
  {
    name: 'propose_update_event',
    description:
      'Föreslå ändring av en befintlig händelse (id från list_events). Ange bara fält som ska ändras. start="" gör den till heldag. Ändras INTE förrän användaren bekräftat.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' }, title: { type: 'string' }, date, start: { type: 'string' }, end: { type: 'string' }, note: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'propose_delete_event',
    description: 'Föreslå borttagning av en händelse (id från list_events). Tas INTE bort förrän användaren bekräftat.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'propose_update_lesson',
    description:
      'Föreslå ändring av en lektion i schemat (id från get_schedule). Ange bara fält som ska ändras. weekday är 1=måndag … 7=söndag. Ändras INTE förrän användaren bekräftat.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        weekday: { type: 'integer' },
        start: { type: 'string', description: 'HH:mm' },
        end: { type: 'string', description: 'HH:mm' },
        room: { type: 'string' },
        teacher: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'propose_delete_lesson',
    description: 'Föreslå borttagning av en lektion ur schemat (id från get_schedule). Tas INTE bort förrän användaren bekräftat.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'list_pantry',
    description: 'Lista vad användaren har hemma i matlagret, med mängd, bäst före-datum och daysLeft (negativt = utgånget). Använd den för matfrågor.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_shopping',
    description: 'Lista användarens inköpslista (done = redan köpt).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'propose_shopping_items',
    description: 'Föreslå varor att lägga på inköpslistan. De läggs INTE dit förrän användaren bekräftat i appen. Varor som redan står på listan hoppas över.',
    parameters: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'string' } }, required: ['name'] } } },
      required: ['items'],
    },
  },
  {
    name: 'propose_pantry_add',
    description: 'Föreslå varor att lägga i matlagret (t.ex. efter inköp). Läggs INTE dit förrän användaren bekräftat. expires är bäst före-datum YYYY-MM-DD, valfritt.',
    parameters: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'string' }, expires: date }, required: ['name'] } } },
      required: ['items'],
    },
  },
  {
    name: 'propose_pantry_remove',
    description: 'Föreslå att varor tas bort ur matlagret (uppätna eller slut), angivna med namn som i list_pantry. Tas INTE bort förrän användaren bekräftat.',
    parameters: { type: 'object', properties: { names: { type: 'array', items: { type: 'string' } } }, required: ['names'] },
  },
  {
    name: 'get_nutrition',
    description:
      'Hämta loggade måltider (med protein, kolhydrater, fett, kcal), vatten och användarens mål för ett datumintervall (max 14 dagar), med dagssummor. Använd för frågor om hur mycket användaren ätit eller druckit och vad som återstår mot målen.',
    parameters: { type: 'object', properties: { from: date, to: { ...date, description: 'Sista datum, samma som from för en dag' } }, required: ['from'] },
  },
  {
    name: 'propose_meal',
    description:
      'Föreslå att logga en måltid användaren berättat att hen ätit, med din UPPSKATTNING av näringsvärden (hela måltiden, protein/kolhydrater/fett i gram, kcal valfritt). Loggas INTE förrän användaren bekräftat i appen. date är YYYY-MM-DD (standard idag).',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        date,
        time: { type: 'string', description: 'HH:mm, valfritt' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        kcal: { type: 'number' },
      },
      required: ['name', 'protein', 'carbs', 'fat'],
    },
  },
  {
    name: 'propose_water',
    description: 'Föreslå att lägga till vatten användaren druckit (ml). Läggs INTE till förrän användaren bekräftat. Ett glas är glassMl från användarens inställningar.',
    parameters: { type: 'object', properties: { ml: { type: 'number' }, date }, required: ['ml'] },
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
    id: l.id,
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

const describeEvent = (e: Pick<CalendarEvent, 'title' | 'date' | 'start' | 'end'>) =>
  `${e.title}, ${dayLabel(e.date)}, ${eventTime(e).toLowerCase()}`

function describeLesson(l: Pick<Lesson, 'weekday' | 'start' | 'end' | 'room' | 'teacher'> & { subjectId?: string }, subjects: Subject[]) {
  const name = subjects.find((s) => s.id === l.subjectId)?.name
  return [name, `${WEEKDAYS_LONG[l.weekday - 1]} ${l.start}–${l.end}`, l.room && `sal ${l.room}`, l.teacher].filter(Boolean).join(', ')
}

/** Rensar en lista med varor från modellen. */
function cleanItems(v: unknown, withExpiry = false): { list: { name: string; amount?: string; expires?: string }[] } | { error: string } {
  if (!Array.isArray(v) || v.length === 0) return { error: 'Inga varor angavs.' }
  if (v.length > 40) return { error: 'För många varor på en gång (max 40).' }
  const seen = new Set<string>()
  const list: { name: string; amount?: string; expires?: string }[] = []
  for (const raw of v) {
    const r = (raw ?? {}) as Record<string, unknown>
    const name = str(r.name).slice(0, 60)
    if (!name || seen.has(foodKey(name))) continue
    seen.add(foodKey(name))
    const amount = str(r.amount).slice(0, 30)
    const expires = withExpiry ? str(r.expires) : ''
    if (expires && !DATE.test(expires)) return { error: `Ogiltigt datum för ${name}, använd YYYY-MM-DD.` }
    list.push({ name, ...(amount ? { amount } : {}), ...(expires ? { expires } : {}) })
  }
  return list.length > 0 ? { list } : { error: 'Inga giltiga varor angavs.' }
}

export function findSubject(name: string, subjects: Subject[]): Subject | undefined {
  const q = name.trim().toLowerCase()
  return subjects.find((s) => s.name.toLowerCase() === q) ?? subjects.find((s) => s.name.toLowerCase().includes(q))
}

export function runTool(name: string, args: Args, ctx: ToolContext): ToolOutcome {
  switch (name) {
    case 'get_schedule': {
      const d = str(args.date)
      if (!DATE.test(d)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      return { result: { date: d, lessons: lessonsOn(d, ctx.lessons, ctx.settings).map((l) => lessonView(l, ctx.subjects)) } }
    }
    case 'get_overview': {
      const from = str(args.from)
      const to = str(args.to) || from
      if (!DATE.test(from) || !DATE.test(to)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      const span = daysBetween(from, to)
      if (span < 0 || span > 13) return err('Intervallet måste vara 1–14 dagar.')
      const subjectName = (id?: string) => ctx.subjects.find((x) => x.id === id)?.name
      const days = Array.from({ length: span + 1 }, (_, i) => {
        const d = addDays(from, i)
        const dayLessons = lessonsOn(d, ctx.lessons, ctx.settings)
        return {
          date: d,
          weekday: WEEKDAYS_LONG[weekdayOf(d) - 1],
          lessons: dayLessons.map((l) => lessonView(l, ctx.subjects)),
          events: eventsOn(d, ctx.events).map((e) => ({ title: e.title, start: e.start, end: e.end, note: e.note || undefined })),
          tasksDue: tasksOn(d, ctx.tasks).map((t) => ({ title: t.title, subject: subjectName(t.subjectId), done: t.done })),
          reminders: ctx.reminders.filter((r) => occursOn(r, d)).sort((a, b) => a.time.localeCompare(b.time)).map((r) => ({ title: r.title, time: r.time })),
          packing: packingFor(dayLessons, ctx.subjects).flatMap((g) => g.items.map((i) => i.text)),
        }
      })
      const overdue = ctx.tasks.filter((t) => !t.done && t.deadline < from).map((t) => ({ title: t.title, subject: subjectName(t.subjectId), deadline: t.deadline }))
      const empty = days.every((d) => !d.lessons.length && !d.events.length && !d.tasksDue.length && !d.reminders.length) && overdue.length === 0
      return { result: { days, ...(overdue.length ? { overdueTasks: overdue } : {}), ...(empty ? { note: 'Inget inplanerat under perioden.' } : {}) } }
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
      return { result: { events: events.map((e) => ({ id: e.id, title: e.title, date: e.date, start: e.start, end: e.end, note: e.note || undefined })) } }
    }
    case 'list_tasks': {
      const from = str(args.from)
      const to = str(args.to)
      if (!DATE.test(from) || !DATE.test(to) || to < from) return err('Ogiltigt datumintervall, använd YYYY-MM-DD.')
      const includeDone = args.include_done === true
      const includeOverdue = args.include_overdue !== false
      const list = ctx.tasks
        .filter((t) => (includeDone || !t.done) && t.deadline <= to && (t.deadline >= from || (includeOverdue && !t.done)))
        .sort((a, b) => a.deadline.localeCompare(b.deadline))
      return {
        result: {
          tasks: list.map((t) => ({
            title: t.title,
            deadline: t.deadline,
            subject: ctx.subjects.find((s) => s.id === t.subjectId)?.name,
            done: t.done,
            overdue: !t.done && t.deadline < from ? true : undefined,
          })),
        },
      }
    }
    case 'propose_task': {
      const title = str(args.title)
      const deadline = str(args.deadline)
      const subjectName = str(args.subject)
      if (!title) return err('Titel saknas.')
      if (!DATE.test(deadline)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      const subject = subjectName ? findSubject(subjectName, ctx.subjects) : undefined
      return {
        result: {
          status: 'awaiting_user_confirmation',
          message: 'Förslaget visas för användaren. Det är inte inlagt än.',
          ...(subjectName && !subject ? { note: `Ämnet "${subjectName}" finns inte; uppgiften föreslås utan ämne.` } : {}),
        },
        card: { type: 'task', task: { title, deadline, ...(subject ? { subjectId: subject.id } : {}) } },
      }
    }
    case 'propose_update_event': {
      const old = ctx.events.find((e) => e.id === str(args.id))
      if (!old) return err('Hittar ingen händelse med det id:t. Hämta id med list_events.')
      const date = 'date' in args ? str(args.date) : old.date
      const title = 'title' in args ? str(args.title) : old.title
      const note = 'note' in args ? str(args.note) : old.note
      let start: string | undefined = old.start
      let end: string | undefined = old.end
      if ('start' in args) {
        start = str(args.start) || undefined
        if (!start) end = undefined
      }
      if ('end' in args && start) end = str(args.end) || undefined
      if (!title) return err('Titel får inte vara tom.')
      if (!DATE.test(date)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      if (start && !TIME.test(start)) return err('Ogiltig starttid, använd HH:mm.')
      if (end && (!start || !TIME.test(end) || end <= start)) return err('Ogiltig sluttid.')
      const after = { title, date, ...(start ? { start } : {}), ...(end ? { end } : {}), note }
      if (JSON.stringify(after) === JSON.stringify({ title: old.title, date: old.date, ...(old.start ? { start: old.start } : {}), ...(old.end ? { end: old.end } : {}), note: old.note }))
        return err('Inga ändringar jämfört med nuvarande händelse.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Ändringen visas för användaren. Den är inte genomförd än.' },
        card: { type: 'event_update', id: old.id, before: describeEvent(old), afterText: describeEvent(after), after },
      }
    }
    case 'propose_delete_event': {
      const old = ctx.events.find((e) => e.id === str(args.id))
      if (!old) return err('Hittar ingen händelse med det id:t. Hämta id med list_events.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Borttagningen visas för användaren. Inget är borttaget än.' },
        card: { type: 'event_delete', id: old.id, summary: describeEvent(old) },
      }
    }
    case 'propose_update_lesson': {
      const old = ctx.lessons.find((l) => l.id === str(args.id))
      if (!old) return err('Hittar ingen lektion med det id:t. Hämta id med get_schedule.')
      const weekday = 'weekday' in args ? Number(args.weekday) : old.weekday
      const start = 'start' in args ? str(args.start) : old.start
      const end = 'end' in args ? str(args.end) : old.end
      const room = 'room' in args ? str(args.room) : old.room
      const teacher = 'teacher' in args ? str(args.teacher) : old.teacher
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return err('Ogiltig veckodag, använd 1–7.')
      if (!TIME.test(start) || !TIME.test(end) || end <= start) return err('Ogiltig tid, använd HH:mm och sluttid efter starttid.')
      const after = { weekday, start, end, room, teacher }
      if (JSON.stringify(after) === JSON.stringify({ weekday: old.weekday, start: old.start, end: old.end, room: old.room, teacher: old.teacher }))
        return err('Inga ändringar jämfört med nuvarande lektion.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Ändringen visas för användaren. Den är inte genomförd än.' },
        card: {
          type: 'lesson_update',
          id: old.id,
          before: describeLesson(old, ctx.subjects),
          afterText: describeLesson({ ...after, subjectId: old.subjectId }, ctx.subjects),
          after,
        },
      }
    }
    case 'propose_delete_lesson': {
      const old = ctx.lessons.find((l) => l.id === str(args.id))
      if (!old) return err('Hittar ingen lektion med det id:t. Hämta id med get_schedule.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Borttagningen visas för användaren. Inget är borttaget än.' },
        card: { type: 'lesson_delete', id: old.id, summary: describeLesson(old, ctx.subjects) },
      }
    }
    case 'list_pantry': {
      const today = ctx.today ?? toISODate(new Date())
      return {
        result: {
          today,
          items: ctx.pantry
            .slice()
            .sort((a, b) => (a.expires ?? '9999').localeCompare(b.expires ?? '9999') || a.name.localeCompare(b.name, 'sv'))
            .map((p) => ({
              name: p.name,
              amount: p.amount,
              expires: p.expires,
              daysLeft: p.expires ? daysLeft(p.expires, today) : undefined,
            })),
        },
      }
    }
    case 'list_shopping':
      return { result: { items: ctx.shopping.map((i) => ({ name: i.name, amount: i.amount, done: i.done })) } }
    case 'propose_shopping_items': {
      const items = cleanItems(args.items)
      if ('error' in items) return err(items.error)
      const onList = new Set(ctx.shopping.filter((i) => !i.done).map((i) => foodKey(i.name)))
      const fresh = items.list.filter((i) => !onList.has(foodKey(i.name)))
      if (fresh.length === 0) return err('Allt det här står redan på inköpslistan.')
      return {
        result: {
          status: 'awaiting_user_confirmation',
          message: 'Förslaget visas för användaren. Inget är tillagt än.',
          ...(fresh.length < items.list.length ? { note: 'Några varor stod redan på listan och utelämnades.' } : {}),
        },
        card: { type: 'shopping_add', items: fresh },
      }
    }
    case 'propose_pantry_add': {
      const items = cleanItems(args.items, true)
      if ('error' in items) return err(items.error)
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Förslaget visas för användaren. Inget är tillagt än.' },
        card: { type: 'pantry_add', items: items.list },
      }
    }
    case 'propose_pantry_remove': {
      const names = Array.isArray(args.names) ? args.names.filter((n): n is string => typeof n === 'string' && n.trim() !== '').slice(0, 30) : []
      if (names.length === 0) return err('Inga varor angavs.')
      const found: PantryItem[] = []
      const unknown: string[] = []
      for (const n of names) {
        const hit = ctx.pantry.find((p) => foodKey(p.name) === foodKey(n) && !found.includes(p)) ?? ctx.pantry.find((p) => foodKey(p.name).includes(foodKey(n)) && !found.includes(p))
        if (hit) found.push(hit)
        else unknown.push(n)
      }
      if (found.length === 0) return err(`Hittar ingen av varorna i lagret: ${unknown.join(', ')}. Kontrollera namnen med list_pantry.`)
      return {
        result: {
          status: 'awaiting_user_confirmation',
          message: 'Borttagningen visas för användaren. Inget är borttaget än.',
          ...(unknown.length ? { note: `Hittade inte: ${unknown.join(', ')}` } : {}),
        },
        card: { type: 'pantry_remove', ids: found.map((p) => p.id), names: found.map((p) => p.name) },
      }
    }
    case 'get_nutrition': {
      const from = str(args.from)
      const to = str(args.to) || from
      if (!DATE.test(from) || !DATE.test(to)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      const span = daysBetween(from, to)
      if (span < 0 || span > 13) return err('Intervallet måste vara 1–14 dagar.')
      const goals = ctx.settings.nutrition
      const days = lastDays(to, span + 1, ctx.meals, ctx.water).map((p) => ({
        date: p.date,
        totals: { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat },
        waterMl: p.waterMl,
        meals: mealsOn(p.date, ctx.meals).map((m) => ({ name: m.name, time: m.time, kcal: mealKcal(m), protein: m.protein, carbs: m.carbs, fat: m.fat })),
      }))
      return {
        result: {
          goals: { kcal: goalKcal(goals), protein: goals.proteinG, carbs: goals.carbsG, fat: goals.fatG, waterMl: goals.waterMl, glassMl: goals.glassMl },
          days,
          ...(days.every((d) => d.meals.length === 0 && d.waterMl === 0) ? { note: 'Inget loggat under perioden.' } : {}),
        },
      }
    }
    case 'propose_meal': {
      const name = str(args.name).slice(0, 100)
      const today = ctx.today ?? toISODate(new Date())
      const date = str(args.date) || today
      const time = str(args.time)
      const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.round(v * 10) / 10 : null)
      const protein = n(args.protein, 1000)
      const carbs = n(args.carbs, 2000)
      const fat = n(args.fat, 1000)
      const kcal = args.kcal === undefined ? undefined : n(args.kcal, 10000)
      if (!name) return err('Namn på måltiden saknas.')
      if (!DATE.test(date)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      if (time && !TIME.test(time)) return err('Ogiltig tid, använd HH:mm.')
      if (protein === null || carbs === null || fat === null || kcal === null) return err('Protein, kolhydrater och fett måste vara tal (gram) mellan 0 och rimliga gränser.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Förslaget visas för användaren. Inget är loggat än. Säg att näringsvärdena är en uppskattning.' },
        card: { type: 'meal_add', meal: { date, name, protein, carbs, fat, ...(time ? { time } : {}), ...(kcal !== undefined ? { kcal: Math.round(kcal) } : {}) } },
      }
    }
    case 'propose_water': {
      const ml = typeof args.ml === 'number' ? Math.round(args.ml) : NaN
      const date = str(args.date) || (ctx.today ?? toISODate(new Date()))
      if (!Number.isFinite(ml) || ml < 1 || ml > 5000) return err('Mängden måste vara 1–5000 ml.')
      if (!DATE.test(date)) return err('Ogiltigt datum, använd YYYY-MM-DD.')
      return {
        result: { status: 'awaiting_user_confirmation', message: 'Förslaget visas för användaren. Inget är tillagt än.' },
        card: { type: 'water_add', date, ml },
      }
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
