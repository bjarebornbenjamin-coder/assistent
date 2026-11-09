import { addDays, daysBetween, parseISODate } from './dates'
import type { ISODate, PantryItem } from './types'

export type ExpiryStatus = 'expired' | 'today' | 'soon' | 'ok' | 'none'

/** Hela dagar till datumet (negativt om det passerat). */
export const daysLeft = (expires: ISODate, today: ISODate): number => daysBetween(today, expires)

export function expiryStatus(expires: ISODate | undefined, today: ISODate): ExpiryStatus {
  if (!expires) return 'none'
  const d = daysLeft(expires, today)
  if (d < 0) return 'expired'
  if (d === 0) return 'today'
  return d <= 2 ? 'soon' : 'ok'
}

export function expiryLabel(expires: ISODate | undefined, today: ISODate): string {
  if (!expires) return ''
  const d = daysLeft(expires, today)
  if (d < -1) return `Gick ut för ${-d} dagar sedan`
  if (d === -1) return 'Gick ut igår'
  if (d === 0) return 'Går ut idag'
  if (d === 1) return 'Går ut imorgon'
  if (d <= 6) return `Går ut om ${d} dagar`
  return `Bäst före ${parseISODate(expires).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`
}

/** Det som går ut först överst, varor utan datum sist. */
export function sortPantry(items: PantryItem[]): PantryItem[] {
  return [...items].sort((a, b) => {
    if (a.expires && b.expires) return a.expires.localeCompare(b.expires) || a.name.localeCompare(b.name, 'sv')
    if (a.expires) return -1
    if (b.expires) return 1
    return a.name.localeCompare(b.name, 'sv')
  })
}

/** Varor som är utgångna eller går ut inom `days` dagar. */
export function expiringWithin(items: PantryItem[], today: ISODate, days = 2): PantryItem[] {
  const last = addDays(today, days)
  return sortPantry(items.filter((i) => i.expires && i.expires <= last))
}

/** Jämförelsenyckel för varunamn: trimmat och skiftlägesokänsligt. */
export const foodKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ')
