/**
 * Enkel begränsning per identitet i minnet. På serverless delas inte minnet mellan instanser,
 * så detta är ett skydd mot misstag och enkel misshandel, inte en exakt kvot.
 */
const hits = new Map<string, number[]>()

export function rateLimit(id: string, limit: number, now = Date.now(), windowMs = 60_000): { ok: boolean; retryAfter: number } {
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= limit) {
    hits.set(id, recent)
    return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) }
  }
  recent.push(now)
  hits.set(id, recent)
  if (hits.size > 1000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k)
  return { ok: true, retryAfter: 0 }
}

export function resetRateLimit(): void {
  hits.clear()
}
