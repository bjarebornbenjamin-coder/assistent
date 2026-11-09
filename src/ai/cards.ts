import { db } from '../db/db'
import { addPantryItems, addShoppingItems, addWater, saveMeal, deleteEvent, deleteLesson, newId, saveEvent, saveLesson, saveTask } from '../db/repo'
import { dayLabel, eventTime } from '../domain/calendar'
import { mealKcal } from '../domain/nutrition'
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
    case 'task': {
      const subject = subjects.find((s) => s.id === card.task.subjectId)?.name
      return {
        kicker: 'Förslag: ny uppgift',
        title: card.task.title,
        lines: [`Deadline ${dayLabel(card.task.deadline)}`, ...(subject ? [`Ämne: ${subject}`] : [])],
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
