import { newId, saveEvent, saveTask } from '../db/repo'
import { dayLabel, eventTime } from '../domain/calendar'
import type { ChatCard, Subject } from '../domain/types'

export interface CardView {
  kicker: string
  title: string
  lines: string[]
  confirmLabel: string
  doneText: string
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
    case 'email':
      return 'done'
  }
}
