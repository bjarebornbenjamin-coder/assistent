import { db } from '../db/db'
import { deleteEvent, deleteLesson, newId, saveEvent, saveLesson, saveTask } from '../db/repo'
import { dayLabel, eventTime } from '../domain/calendar'
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
    case 'email':
      return 'done'
  }
}
