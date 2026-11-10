import { foodKey } from '../domain/food'
import type { PantryItem } from '../domain/types'

export interface Ingredient {
  name: string
  /** Mått för receptets portioner, t.ex. "300 g" eller "2 dl". */
  amount: string
  /**
   * pantry = finns i lagret (tillräckligt), pantry-low = finns men troligen för lite,
   * pantry-check = finns men mängden går inte att jämföra, staple = basvara, missing = behöver köpas.
   */
  status: 'pantry' | 'pantry-low' | 'pantry-check' | 'staple' | 'missing'
  /** Lagrets namn när status är pantry. */
  pantryName?: string
}

/** Vi utgår från att dessa finns hemma, så de räknas inte som saknade. */
export const STAPLES = ['salt', 'peppar', 'vatten', 'olja', 'matolja', 'rapsolja', 'olivolja', 'socker']

const match = (a: string, b: string) => {
  const x = foodKey(a)
  const y = foodKey(b)
  return x === y || (x.length > 2 && y.length > 2 && (x.includes(y) || y.includes(x)))
}
const isStaple = (n: string) => STAPLES.some((s) => foodKey(n) === s)

/** Tolkar en mängd som "400 g", "2 dl", "1,5 kg", "3 st" till bas-enhet (g, ml, st). Annars null. */
export function parseQty(text: string | undefined): { value: number; unit: 'g' | 'ml' | 'st' } | null {
  if (!text) return null
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|hg|g|l|dl|cl|ml|msk|tsk|st|stycken|förp)?\b/i.exec(text.trim())
  if (!m) return null
  const n = Number(m[1].replace(',', '.'))
  const u = (m[2] ?? 'st').toLowerCase()
  const table: Record<string, [number, 'g' | 'ml' | 'st']> = { kg: [1000, 'g'], hg: [100, 'g'], g: [1, 'g'], l: [1000, 'ml'], dl: [100, 'ml'], cl: [10, 'ml'], ml: [1, 'ml'], msk: [15, 'ml'], tsk: [5, 'ml'], st: [1, 'st'], stycken: [1, 'st'] }
  const t = table[u]
  return t ? { value: n * t[0], unit: t[1] } : null
}

/** Räcker det som finns hemma? Jämförs bara när båda mängderna går att tolka i samma enhet. */
function enough(have: string | undefined, need: string): Ingredient['status'] {
  const h = parseQty(have)
  const n = parseQty(need)
  if (!n) return 'pantry'
  if (!h || h.unit !== n.unit) return 'pantry-check'
  return h.value >= n.value ? 'pantry' : 'pantry-low'
}

/** Jämför ingredienserna mot lagret: finns hemma, kanske för lite, basvara eller saknas. */
export function withPantryStatus(list: { name: string; amount: string }[], pantry: PantryItem[]): Ingredient[] {
  return list.map(({ name, amount }) => {
    const hit = pantry.find((p) => match(p.name, name))
    return hit ? { name, amount, status: enough(hit.amount, amount), pantryName: hit.name } : { name, amount, status: isStaple(name) ? 'staple' : 'missing' }
  })
}
