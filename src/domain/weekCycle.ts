import { addDays, daysBetween, mondayOf } from './dates'
import type { ISODate } from './types'

/** Vilken vecka i cykeln (0-baserat) som datumet ligger i. */
export function weekIndex(date: ISODate, anchor: ISODate, cycleLength: number): number {
  if (cycleLength <= 1) return 0
  const weeks = Math.round(daysBetween(mondayOf(anchor), mondayOf(date)) / 7)
  return ((weeks % cycleLength) + cycleLength) % cycleLength
}

export function cycleLabel(index: number): string {
  return String.fromCharCode(65 + index)
}

/** Ankare (måndag) så att veckan som innehåller `date` får index `index`. */
export function anchorFor(date: ISODate, index: number): ISODate {
  return addDays(mondayOf(date), -7 * index)
}
