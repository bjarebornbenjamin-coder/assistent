import { foodKey } from '../domain/food'
import { describeRepeat } from '../domain/reminders'
import { WEEKDAYS_LONG } from '../domain/dates'
import type { ChatCard, Reminder } from '../domain/types'
import type { ToolContext, ToolOutcome } from './tools'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const date = { type: 'string', description: 'Datum som YYYY-MM-DD' }
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const err = (message: string): ToolOutcome => ({ result: { error: message } })
const strings = (v: unknown, max = 30): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 60)).slice(0, max) : []
const proposed = (card: ChatCard, message = 'Förslaget visas för användaren. Inget är ändrat än.'): ToolOutcome => ({
  result: { status: 'awaiting_user_confirmation', message },
  card,
})

/** Hitta en post på namn: exakt först, annars delsträng. Flera träffar = fråga användaren. */
function findByName<T>(items: T[], name: string, get: (t: T) => string): { hit?: T; error?: string } {
  const q = foodKey(name)
  if (!q) return { error: 'Inget namn angavs.' }
  const exact = items.filter((i) => foodKey(get(i)) === q)
  if (exact.length === 1) return { hit: exact[0] }
  const partial = exact.length ? exact : items.filter((i) => foodKey(get(i)).includes(q))
  if (partial.length === 1) return { hit: partial[0] }
  if (partial.length === 0) return { error: `Hittar inget som heter "${name}".` }
  return { error: `Flera träffar för "${name}": ${partial.slice(0, 6).map(get).join(', ')}. Fråga användaren vilken.` }
}

const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })

const reminderSummary = (r: Pick<Reminder, 'title' | 'time' | 'repeat'>) => `${r.title}, ${r.time}, ${describeRepeat(r.repeat)}`

export const MORE_TOOL_DEFINITIONS = [
  { name: 'list_reminders', description: 'Lista användarens fristående påminnelser (titel, tid, upprepning, på/av).', parameters: { type: 'object', properties: {} } },
  {
    name: 'propose_reminder',
    description: 'Föreslå en ny påminnelse. title kort i imperativ, t.ex. "Ring mormor", "Plugga matte". repeat: "once" (kräver date), "daily", eller "weekdays" (kräver days, 1=måndag … 7=söndag; en dag = varje vecka). Skapas INTE förrän användaren bekräftat.',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' }, time: { type: 'string', description: 'HH:mm' }, repeat: { type: 'string', enum: ['once', 'daily', 'weekdays'] }, date, days: { type: 'array', items: { type: 'integer' } } },
      required: ['title', 'time', 'repeat'],
    },
  },
  { name: 'propose_reminder_delete', description: 'Föreslå att ta bort en påminnelse (titel som i list_reminders).', parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  {
    name: 'propose_task_update',
    description: 'Föreslå ändring av en uppgift (titel som i list_tasks/get_overview): markera klar/inte klar, ny deadline, klockslag, anteckning eller ny titel. time/note "" tar bort.',
    parameters: { type: 'object', properties: { title: { type: 'string' }, done: { type: 'boolean' }, deadline: date, time: { type: 'string', description: 'HH:mm' }, note: { type: 'string' }, new_title: { type: 'string' } }, required: ['title'] },
  },
  { name: 'propose_task_delete', description: 'Föreslå att ta bort en uppgift (titel som i list_tasks).', parameters: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] } },
  {
    name: 'propose_lesson',
    description: 'Föreslå en ny lektion i veckoschemat. subject är ämnets namn (skapas om det inte finns). weekday 1=måndag … 7=söndag. week: "A"/"B" för bara den veckan vid A/B-schema, annars utelämna.',
    parameters: {
      type: 'object',
      properties: { subject: { type: 'string' }, weekday: { type: 'integer' }, start: { type: 'string' }, end: { type: 'string' }, room: { type: 'string' }, teacher: { type: 'string' }, week: { type: 'string' } },
      required: ['subject', 'weekday', 'start', 'end'],
    },
  },
  { name: 'list_subjects', description: 'Lista ämnen och deras packlistor.', parameters: { type: 'object', properties: {} } },
  {
    name: 'propose_pack_items',
    description: 'Föreslå ändringar i ett ämnes packlista: saker att lägga till och/eller ta bort.',
    parameters: { type: 'object', properties: { subject: { type: 'string' }, add: { type: 'array', items: { type: 'string' } }, remove: { type: 'array', items: { type: 'string' } } }, required: ['subject'] },
  },
  {
    name: 'propose_shopping_update',
    description: 'Föreslå att markera varor på inköpslistan som köpta och/eller ta bort varor från listan (namn som i list_shopping).',
    parameters: { type: 'object', properties: { mark_bought: { type: 'array', items: { type: 'string' } }, remove: { type: 'array', items: { type: 'string' } } } },
  },
  {
    name: 'propose_pantry_update',
    description: 'Föreslå ändring av en vara i matlagret (namn som i list_pantry): ny mängd och/eller nytt bäst före-datum ("" tar bort datumet).',
    parameters: { type: 'object', properties: { name: { type: 'string' }, amount: { type: 'string' }, expires: { type: 'string' } }, required: ['name'] },
  },
  { name: 'propose_contact', description: 'Föreslå en ny kontakt (namn och e-post).', parameters: { type: 'object', properties: { name: { type: 'string' }, email: { type: 'string' } }, required: ['name', 'email'] } },
  {
    name: 'propose_preferences',
    description: 'Föreslå ändrade inställningar: allergier/kost (fri text), antal portioner, och dagliga mål för protein, kolhydrater, fett (gram) och vatten (ml). Ange bara det som ska ändras.',
    parameters: {
      type: 'object',
      properties: { allergies: { type: 'string' }, portions: { type: 'integer' }, protein_g: { type: 'integer' }, carbs_g: { type: 'integer' }, fat_g: { type: 'integer' }, water_ml: { type: 'integer' } },
    },
  },
  {
    name: 'remember',
    description: 'Föreslå att komma ihåg en preferens eller ett faktum om användaren som ska påverka framtida svar (t.ex. "gillar inte svamp", "tränar helst på morgonen"). Sparas när användaren bekräftat.',
    parameters: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] },
  },
  { name: 'forget', description: 'Föreslå att glömma något som sparats med remember.', parameters: { type: 'object', properties: { fact: { type: 'string' } }, required: ['fact'] } },
].map((f) => ({ type: 'function' as const, function: f as { name: string; description: string; parameters: unknown } }))

export function runMoreTool(name: string, args: Record<string, unknown>, ctx: ToolContext): ToolOutcome | null {
  switch (name) {
    case 'list_reminders':
      return { result: { reminders: ctx.reminders.map((r) => ({ title: r.title, time: r.time, repeat: describeRepeat(r.repeat), on: r.enabled })) } }

    case 'propose_reminder': {
      const title = str(args.title).slice(0, 100)
      const time = str(args.time)
      if (!title) return err('Titel saknas.')
      if (!TIME.test(time)) return err('Ogiltig tid, använd HH:mm.')
      let repeat: Reminder['repeat']
      if (args.repeat === 'daily') repeat = { kind: 'daily' }
      else if (args.repeat === 'once') {
        const d = str(args.date)
        if (!DATE.test(d)) return err('En engångspåminnelse behöver date som YYYY-MM-DD.')
        repeat = { kind: 'once', date: d }
      } else if (args.repeat === 'weekdays') {
        const days = Array.isArray(args.days) ? [...new Set(args.days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : []
        if (days.length === 0) return err('Ange days (1–7) för veckodagar.')
        repeat = { kind: 'weekdays', days }
      } else return err('repeat måste vara once, daily eller weekdays.')
      return proposed({ type: 'reminder_add', reminder: { title, time, repeat } })
    }

    case 'propose_reminder_delete': {
      const f = findByName(ctx.reminders, str(args.title), (r) => r.title)
      if (!f.hit) return err(f.error!)
      return proposed({ type: 'reminder_delete', id: f.hit.id, summary: reminderSummary(f.hit) })
    }

    case 'propose_task_update': {
      const f = findByName(ctx.tasks, str(args.title), (t) => t.title)
      if (!f.hit) return err(f.error!)
      const t = f.hit
      const deadline = args.deadline === undefined ? t.deadline : str(args.deadline)
      if (!DATE.test(deadline)) return err('Ogiltig deadline, använd YYYY-MM-DD.')
      const time = args.time === undefined ? t.time ?? '' : str(args.time)
      if (time && !TIME.test(time)) return err('Ogiltigt klockslag, använd HH:mm.')
      const note = args.note === undefined ? t.note ?? '' : str(args.note).slice(0, 500)
      const after = { title: str(args.new_title).slice(0, 100) || t.title, deadline, done: typeof args.done === 'boolean' ? args.done : t.done, ...(time ? { time } : {}), ...(note ? { note } : {}) }
      if (after.title === t.title && after.deadline === t.deadline && after.done === t.done && time === (t.time ?? '') && note === (t.note ?? '')) return err('Inga ändringar jämfört med nuvarande uppgift.')
      return proposed({ type: 'task_update', id: t.id, before: `${t.title} (deadline ${short(t.deadline)}${t.time ? ` ${t.time}` : ''}${t.done ? ', klar' : ''})`, after })
    }

    case 'propose_task_delete': {
      const f = findByName(ctx.tasks, str(args.title), (t) => t.title)
      if (!f.hit) return err(f.error!)
      return proposed({ type: 'task_delete', id: f.hit.id, summary: `${f.hit.title} (deadline ${short(f.hit.deadline)})` })
    }

    case 'propose_lesson': {
      const subject = str(args.subject).slice(0, 60)
      const weekday = Number(args.weekday)
      const start = str(args.start)
      const end = str(args.end)
      if (!subject) return err('Ämne saknas.')
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return err('Ogiltig veckodag, använd 1–7.')
      if (!TIME.test(start) || !TIME.test(end) || end <= start) return err('Ogiltig tid, använd HH:mm och sluttid efter starttid.')
      let weeks: number[] | null = null
      const w = str(args.week).toUpperCase()
      if (w) {
        const i = w.charCodeAt(0) - 65
        if (!/^[A-D]$/.test(w) || i >= ctx.settings.cycleLength) return err(ctx.settings.cycleLength > 1 ? 'Ogiltig vecka.' : 'Schemat har inga A/B-veckor; utelämna week.')
        weeks = [i]
      }
      return proposed({
        type: 'lesson_add',
        subject,
        lesson: { weekday, start, end, room: str(args.room).slice(0, 30), teacher: str(args.teacher).slice(0, 60), weeks },
      })
    }

    case 'list_subjects':
      return { result: { subjects: ctx.subjects.map((s) => ({ name: s.name, packing: s.packItems.map((p) => p.text) })) } }

    case 'propose_pack_items': {
      const f = findByName(ctx.subjects, str(args.subject), (s) => s.name)
      if (!f.hit) return err(f.error!)
      const have = new Set(f.hit.packItems.map((p) => foodKey(p.text)))
      const add = strings(args.add).filter((a, i, arr) => !have.has(foodKey(a)) && arr.findIndex((x) => foodKey(x) === foodKey(a)) === i)
      const remove = strings(args.remove).map((r) => f.hit!.packItems.find((p) => foodKey(p.text) === foodKey(r))?.text).filter((x): x is string => Boolean(x))
      if (add.length === 0 && remove.length === 0) return err('Inget att ändra (det som ska läggas till finns redan, eller det som ska tas bort finns inte).')
      return proposed({ type: 'pack_update', subjectId: f.hit.id, subjectName: f.hit.name, add, remove })
    }

    case 'propose_shopping_update': {
      const open = ctx.shopping.filter((i) => !i.done)
      const pick = (names: string[]) => names.map((n) => open.find((i) => foodKey(i.name) === foodKey(n))).filter((x): x is (typeof open)[number] => Boolean(x))
      const bought = pick(strings(args.mark_bought))
      const removed = pick(strings(args.remove)).filter((i) => !bought.includes(i))
      if (bought.length === 0 && removed.length === 0) return err('Hittade inga av varorna på inköpslistan. Kontrollera namnen med list_shopping.')
      return proposed({ type: 'shopping_update', boughtIds: bought.map((i) => i.id), removeIds: removed.map((i) => i.id), bought: bought.map((i) => i.name), removed: removed.map((i) => i.name) })
    }

    case 'propose_pantry_update': {
      const f = findByName(ctx.pantry, str(args.name), (p) => p.name)
      if (!f.hit) return err(f.error!)
      const p = f.hit
      const amount = args.amount === undefined ? p.amount : str(args.amount).slice(0, 30) || undefined
      const expires = args.expires === undefined ? p.expires : str(args.expires) || undefined
      if (expires && !DATE.test(expires)) return err('Ogiltigt datum, använd YYYY-MM-DD eller "" för att ta bort.')
      if (amount === p.amount && expires === p.expires) return err('Inga ändringar jämfört med nuvarande vara.')
      return proposed({
        type: 'pantry_update',
        id: p.id,
        before: [p.name, p.amount, p.expires && `bäst före ${short(p.expires)}`].filter(Boolean).join(', '),
        after: { name: p.name, ...(amount ? { amount } : {}), ...(expires ? { expires } : {}) },
      })
    }

    case 'propose_contact': {
      const n = str(args.name).slice(0, 60)
      const email = str(args.email).slice(0, 120)
      if (!n || !/^\S+@\S+\.\S+$/.test(email)) return err('Ange namn och en giltig e-postadress.')
      if (ctx.contacts.some((c) => c.email.toLowerCase() === email.toLowerCase())) return err('Den e-postadressen finns redan bland kontakterna.')
      return proposed({ type: 'contact_add', contact: { name: n, email } })
    }

    case 'propose_preferences': {
      const food: { allergies?: string; portions?: number } = {}
      const nutrition: Record<string, number> = {}
      const summary: string[] = []
      const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null)
      if (args.allergies !== undefined) {
        food.allergies = str(args.allergies).slice(0, 500)
        summary.push(`Allergier/kost: ${food.allergies || 'inga'}`)
      }
      if (args.portions !== undefined) {
        const v = int(args.portions, 1, 12)
        if (v === null) return err('Portioner måste vara 1–12.')
        food.portions = v
        summary.push(`Portioner: ${v}`)
      }
      for (const [key, field, label, max] of [
        ['protein_g', 'proteinG', 'Protein', 1000],
        ['carbs_g', 'carbsG', 'Kolhydrater', 2000],
        ['fat_g', 'fatG', 'Fett', 1000],
        ['water_ml', 'waterMl', 'Vatten', 20000],
      ] as const) {
        if (args[key] === undefined) continue
        const v = int(args[key], 0, max)
        if (v === null) return err(`${label}: ogiltigt värde.`)
        nutrition[field] = v
        summary.push(`${label}: ${v} ${key === 'water_ml' ? 'ml' : 'g'} per dag`)
      }
      if (summary.length === 0) return err('Inget att ändra.')
      return proposed({ type: 'prefs_update', food, nutrition, summary })
    }

    case 'remember': {
      const fact = str(args.fact).slice(0, 200)
      if (!fact) return err('Inget att komma ihåg.')
      if (ctx.settings.memories.some((m) => foodKey(m) === foodKey(fact))) return err('Det kommer jag redan ihåg.')
      if (ctx.settings.memories.length >= 30) return err('Minnet är fullt (30 saker). Be användaren ta bort något först.')
      return proposed({ type: 'memory_add', fact })
    }

    case 'forget': {
      const f = findByName(ctx.settings.memories, str(args.fact), (m) => m)
      if (!f.hit) return err(f.error!)
      return proposed({ type: 'memory_delete', fact: f.hit })
    }
  }
  return null
}

export const weekdayName = (n: number) => WEEKDAYS_LONG[n - 1]
