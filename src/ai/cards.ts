import { db } from '../db/db'
import { addPantryItems, addShoppingItems, addWater, saveMeal, changePackItems, deleteReminder, deleteShoppingItem, deleteTask, getSettings, saveContact, savePantryItem, saveReminder, saveSettings, saveShoppingItem, addSubject, deleteEvent, deleteLesson, newId, saveEvent, saveLesson, saveTask } from '../db/repo'
import { dayLabel, eventTime } from '../domain/calendar'
import { parseISODate } from '../domain/dates'
const shortDate = (d: string) => parseISODate(d).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
import { mealKcal } from '../domain/nutrition'
import { foodKey } from '../domain/food'
import { describeRepeat } from '../domain/reminders'
import { WEEKDAYS_LONG } from '../domain/dates'
import type { ChatCard, Subject } from '../domain/types'

export interface CardView {
  kicker: string
  title: string
  lines: string[]
  confirmLabel: string
  doneText: string
  danger?: boolean
}

export function cardView(card: ChatCard, subjects: Subject[]): CardView {
  switch (card.type) {
    case 'event':
      return {
        kicker: 'Förslag: ny händelse',
        title: card.event.title,
        lines: [`${dayLabel(card.event.date)} · ${eventTime(card.event)}`, ...(card.event.note ? [card.event.note] : [])],
        confirmLabel: 'Lägg in',
        doneText: 'Inlagd i kalendern.',
      }
    case 'reminder_add':
      return { kicker: 'Förslag: ny påminnelse', title: card.reminder.title, lines: [`${card.reminder.time} · ${describeRepeat(card.reminder.repeat)}`], confirmLabel: 'Skapa', doneText: 'Påminnelsen är skapad.' }
    case 'reminder_delete':
      return { kicker: 'Förslag: ta bort påminnelse', title: card.summary, lines: [], confirmLabel: 'Ta bort', doneText: 'Påminnelsen är borttagen.', danger: true }
    case 'task_update':
      return {
        kicker: 'Förslag: ändra uppgift',
        title: card.before,
        lines: [`Blir: ${card.after.title} (deadline ${shortDate(card.after.deadline)}${card.after.time ? ` ${card.after.time}` : ''}${card.after.done ? ', klar' : ''})`, ...(card.after.note ? [card.after.note] : [])],
        confirmLabel: 'Ändra',
        doneText: 'Uppgiften är ändrad.',
      }
    case 'task_delete':
      return { kicker: 'Förslag: ta bort uppgift', title: card.summary, lines: [], confirmLabel: 'Ta bort', doneText: 'Uppgiften är borttagen.', danger: true }
    case 'lesson_add': {
      const l = card.lesson
      return {
        kicker: 'Förslag: ny lektion',
        title: card.subject,
        lines: [[`${WEEKDAYS_LONG[l.weekday - 1]} ${l.start}–${l.end}`, l.room && `sal ${l.room}`, l.teacher, l.weeks ? `bara vecka ${String.fromCharCode(65 + l.weeks[0])}` : null].filter(Boolean).join(', ')],
        confirmLabel: 'Lägg in',
        doneText: 'Lektionen är inlagd i schemat.',
      }
    }
    case 'pack_update':
      return {
        kicker: `Förslag: packlista för ${card.subjectName}`,
        title: [card.add.length && `Lägg till: ${card.add.join(', ')}`, card.remove.length && `Ta bort: ${card.remove.join(', ')}`].filter(Boolean).join(' · '),
        lines: [],
        confirmLabel: 'Ändra packlistan',
        doneText: 'Packlistan är ändrad.',
      }
    case 'shopping_update':
      return {
        kicker: 'Förslag: inköpslistan',
        title: [card.bought.length && `Köpt: ${card.bought.join(', ')}`, card.removed.length && `Ta bort: ${card.removed.join(', ')}`].filter(Boolean).join(' · '),
        lines: [],
        confirmLabel: 'Uppdatera listan',
        doneText: 'Inköpslistan är uppdaterad.',
      }
    case 'pantry_update':
      return {
        kicker: 'Förslag: ändra vara i lagret',
        title: card.before,
        lines: [`Blir: ${[card.after.name, card.after.amount, card.after.expires && `bäst före ${shortDate(card.after.expires)}`].filter(Boolean).join(', ')}`],
        confirmLabel: 'Ändra',
        doneText: 'Varan är ändrad.',
      }
    case 'contact_add':
      return { kicker: 'Förslag: ny kontakt', title: `${card.contact.name} <${card.contact.email}>`, lines: [], confirmLabel: 'Spara kontakt', doneText: 'Kontakten är sparad.' }
    case 'prefs_update':
      return { kicker: 'Förslag: ändra inställningar', title: card.summary.join(' · '), lines: [], confirmLabel: 'Spara', doneText: 'Inställningarna är sparade.' }
    case 'memory_add':
      return { kicker: 'Förslag: kom ihåg', title: card.fact, lines: ['Används i framtida svar. Visas och kan tas bort under Inställningar.'], confirmLabel: 'Kom ihåg', doneText: 'Sparat i minnet.' }
    case 'memory_delete':
      return { kicker: 'Förslag: glöm', title: card.fact, lines: [], confirmLabel: 'Glöm', doneText: 'Borttaget ur minnet.', danger: true }
    case 'events_add':
      return {
        kicker: `Förslag: ${card.events.length} händelser`,
        title: card.events.map((e) => e.title).join(', ').slice(0, 80),
        lines: card.events.map((e) => `${dayLabel(e.date)} · ${eventTime(e)} · ${e.title}`),
        confirmLabel: `Lägg in ${card.events.length}`,
        doneText: 'Inlagda i kalendern.',
      }
    case 'task': {
      const subject = subjects.find((s) => s.id === card.task.subjectId)?.name
      return {
        kicker: 'Förslag: ny uppgift',
        title: card.task.title,
        lines: [`Deadline ${dayLabel(card.task.deadline)}${card.task.time ? ` kl ${card.task.time}` : ''}`, ...(subject ? [`Ämne: ${subject}`] : []), ...(card.task.note ? [card.task.note] : [])],
        confirmLabel: 'Lägg in',
        doneText: 'Inlagd bland uppgifterna.',
      }
    }
    case 'event_update':
      return { kicker: 'Förslag: ändra händelse', title: card.before, lines: [`Blir: ${card.afterText}`], confirmLabel: 'Ändra', doneText: 'Händelsen är ändrad.' }
    case 'event_delete':
      return { kicker: 'Förslag: ta bort händelse', title: card.summary, lines: [], confirmLabel: 'Ta bort', doneText: 'Händelsen är borttagen.', danger: true }
    case 'lesson_update':
      return { kicker: 'Förslag: ändra lektion', title: card.before, lines: [`Blir: ${card.afterText}`], confirmLabel: 'Ändra', doneText: 'Lektionen är ändrad.' }
    case 'lesson_delete':
      return { kicker: 'Förslag: ta bort lektion', title: card.summary, lines: [], confirmLabel: 'Ta bort', doneText: 'Lektionen är borttagen.', danger: true }
    case 'meal_add': {
      const m = card.meal
      return {
        kicker: 'Förslag: logga måltid (uppskattning)',
        title: m.name,
        lines: [`${dayLabel(m.date)}${m.time ? ` kl ${m.time}` : ''}`, `${mealKcal(m)} kcal · protein ${m.protein} g · kolhydrater ${m.carbs} g · fett ${m.fat} g`],
        confirmLabel: 'Logga måltiden',
        doneText: 'Måltiden är loggad. Du kan ändra värdena under Mat → Kost.',
      }
    }
    case 'water_add':
      return { kicker: 'Förslag: vatten', title: `+${card.ml} ml vatten`, lines: [dayLabel(card.date)], confirmLabel: 'Lägg till', doneText: 'Vattnet är tillagt.' }
    case 'shopping_add':
      return { kicker: 'Förslag: inköpslistan', title: `Lägg på listan: ${card.items.map((i) => (i.amount ? `${i.name} (${i.amount})` : i.name)).join(', ')}`, lines: [], confirmLabel: 'Lägg på listan', doneText: 'Lagt på inköpslistan.' }
    case 'pantry_add':
      return { kicker: 'Förslag: matlagret', title: `Lägg i lagret: ${card.items.map((i) => (i.amount ? `${i.name} (${i.amount})` : i.name)).join(', ')}`, lines: [], confirmLabel: 'Lägg i lagret', doneText: 'Lagt i matlagret.' }
    case 'pantry_remove':
      return { kicker: 'Förslag: matlagret', title: `Ta bort ur lagret: ${card.names.join(', ')}`, lines: [], confirmLabel: 'Ta bort', doneText: 'Borttaget ur lagret.', danger: true }
    case 'email':
      return {
        kicker: 'Utkast, inte skickat',
        title: `Till: ${card.toName ? `${card.toName} <${card.to}>` : card.to}`,
        lines: [`Ämne: ${card.subject}`],
        confirmLabel: 'Öppna i mejlprogram',
        doneText: 'Öppnat i mejlprogrammet. Du skickar själv.',
      }
  }
}

/** Genomför ett förslag som användaren bekräftat. Mejl hanteras i gränssnittet. */
export async function applyCard(card: ChatCard): Promise<'done' | 'missing'> {
  switch (card.type) {
    case 'event':
      await saveEvent({ ...card.event, id: newId(), updatedAt: '' })
      return 'done'
    case 'reminder_add':
      await saveReminder({ ...card.reminder, id: newId(), enabled: true, updatedAt: '' })
      return 'done'
    case 'reminder_delete':
      if (!(await db.reminders.get(card.id))) return 'missing'
      await deleteReminder(card.id)
      return 'done'
    case 'task_update': {
      const t = await db.tasks.get(card.id)
      if (!t) return 'missing'
      const { time: _t, note: _n, ...rest } = t
      void _t
      void _n
      await saveTask({ ...rest, ...card.after })
      return 'done'
    }
    case 'task_delete':
      if (!(await db.tasks.get(card.id))) return 'missing'
      await deleteTask(card.id)
      return 'done'
    case 'lesson_add': {
      const existing = (await db.subjects.toArray()).find((x) => foodKey(x.name) === foodKey(card.subject))
      const subjectId = existing?.id ?? (await addSubject(card.subject)).id
      await saveLesson({ ...card.lesson, id: newId(), subjectId })
      return 'done'
    }
    case 'pack_update': {
      if (!(await db.subjects.get(card.subjectId))) return 'missing'
      const remove = new Set(card.remove.map(foodKey))
      await changePackItems(card.subjectId, (items) => {
        const kept = items.filter((i) => !remove.has(foodKey(i.text)))
        const have = new Set(kept.map((i) => foodKey(i.text)))
        return [...kept, ...card.add.filter((a) => !have.has(foodKey(a))).map((text) => ({ id: newId(), text }))]
      })
      return 'done'
    }
    case 'shopping_update': {
      const items = (await db.shopping.bulkGet([...card.boughtIds, ...card.removeIds])).filter(Boolean)
      if (items.length === 0) return 'missing'
      for (const id of card.boughtIds) {
        const i = await db.shopping.get(id)
        if (i) await saveShoppingItem({ ...i, done: true })
      }
      for (const id of card.removeIds) await deleteShoppingItem(id)
      return 'done'
    }
    case 'pantry_update': {
      const p = await db.pantry.get(card.id)
      if (!p) return 'missing'
      const { amount: _a, expires: _e, ...rest } = p
      void _a
      void _e
      await savePantryItem({ ...rest, ...card.after })
      return 'done'
    }
    case 'contact_add':
      await saveContact({ ...card.contact, id: newId() })
      return 'done'
    case 'prefs_update': {
      const s = await getSettings()
      await saveSettings({ food: { ...s.food, ...card.food }, nutrition: { ...s.nutrition, ...card.nutrition } })
      return 'done'
    }
    case 'memory_add': {
      const s = await getSettings()
      if (!s.memories.some((m) => foodKey(m) === foodKey(card.fact))) await saveSettings({ memories: [...s.memories, card.fact].slice(-30) })
      return 'done'
    }
    case 'memory_delete': {
      const s = await getSettings()
      if (!s.memories.includes(card.fact)) return 'missing'
      await saveSettings({ memories: s.memories.filter((m) => m !== card.fact) })
      return 'done'
    }
    case 'events_add':
      for (const e of card.events) await saveEvent({ ...e, id: newId(), updatedAt: '' })
      return 'done'
    case 'task':
      await saveTask({ ...card.task, id: newId(), done: false, updatedAt: '' })
      return 'done'
    case 'event_update': {
      const old = await db.events.get(card.id)
      if (!old) return 'missing'
      const { start: _s, end: _e, ...rest } = old
      void _s
      void _e
      await saveEvent({ ...rest, ...card.after })
      return 'done'
    }
    case 'event_delete':
      if (!(await db.events.get(card.id))) return 'missing'
      await deleteEvent(card.id)
      return 'done'
    case 'lesson_update': {
      const old = await db.lessons.get(card.id)
      if (!old) return 'missing'
      await saveLesson({ ...old, ...card.after })
      return 'done'
    }
    case 'lesson_delete':
      if (!(await db.lessons.get(card.id))) return 'missing'
      await deleteLesson(card.id)
      return 'done'
    case 'meal_add':
      await saveMeal({ ...card.meal, id: newId(), source: 'ai', updatedAt: '' })
      return 'done'
    case 'water_add':
      await addWater(card.date, card.ml)
      return 'done'
    case 'shopping_add':
      await addShoppingItems(card.items)
      return 'done'
    case 'pantry_add':
      await addPantryItems(card.items, 'manual')
      return 'done'
    case 'pantry_remove': {
      const existing = (await db.pantry.bulkGet(card.ids)).filter(Boolean)
      if (existing.length === 0) return 'missing'
      await db.pantry.bulkDelete(existing.map((p) => p!.id))
      return 'done'
    }
    case 'email':
      return 'done'
  }
}
