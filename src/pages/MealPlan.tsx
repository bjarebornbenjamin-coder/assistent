import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dayContext, fetchMealPlan, missingForPlan, planStart } from '../ai/mealPlan'
import { withPantryStatus } from '../ai/recipes'
import { IngredientList } from '../components/IngredientList'
import { MealForm } from '../components/MealForm'
import { db } from '../db/db'
import { addShoppingItems, getSettings } from '../db/repo'
import { dayLabel } from '../domain/calendar'
import { addDays, toHHmm, toISODate } from '../domain/dates'
import { expiringWithin } from '../domain/food'
import { recipeSearchUrl } from '../domain/recipeLink'
import type { PlannedDinner } from '../domain/types'
import { useAiConfig, useEvents, useLessons, useMealPlan, useNow, usePantry, useSettings } from '../hooks'
import { authHeaders } from '../lib/auth'
import { undoable } from '../lib/undo'

export function MealPlanTab() {
  const plan = useMealPlan()
  const pantry = usePantry()
  const lessons = useLessons()
  const events = useEvents()
  const settings = useSettings()
  const config = useAiConfig()
  const now = useNow()
  const today = toISODate(now)
  const [days, setDays] = useState(7)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [eating, setEating] = useState<PlannedDinner | null>(null)
  const [message, setMessage] = useState('')
  if (!plan || !pantry || !lessons || !events || !settings) return null

  const upcoming = plan.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))
  const missing = missingForPlan(upcoming, pantry)
  const expiring = new Set(expiringWithin(pantry, today).map((p) => p.name))

  async function generate() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const s = await getSettings()
      const from = planStart(today, toHHmm(now))
      const dates = Array.from({ length: days }, (_, i) => addDays(from, i))
      const recent = plan!.filter((d) => d.date < from && d.date >= addDays(from, -14)).map((d) => d.title)
      const usable = pantry!.filter((p) => !p.expires || p.expires >= today)
      const result = await fetchMealPlan(
        { days: dates.map((d) => dayContext(d, lessons!, events!, s)), pantry: usable, food: s.food, goals: s.nutrition, memories: s.memories, recent, today },
        config?.model ?? 'gpt-4o-mini',
        await authHeaders(),
      )
      await undoable(`Veckomeny för ${result.length} dagar`, ['mealPlan'], async () => {
        await db.mealPlan.bulkDelete(dates)
        await db.mealPlan.bulkPut(result.map((d) => ({ ...d, updatedAt: new Date().toISOString() })))
      })
      if (result.length < dates.length) setMessage(`AI:n gav bara ${result.length} av ${dates.length} dagar. Gör om för att fylla resten.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
    }
  }

  async function shop() {
    const { added, skipped } = await addShoppingItems(missing)
    setMessage(added ? `${added} varor på inköpslistan${skipped ? ` (${skipped} fanns redan)` : ''}.` : 'Allt fanns redan på inköpslistan.')
  }

  return (
    <>
      <p className="muted">
        Middagar för de kommande dagarna, utifrån lagret, dina mål och hur dagarna ser ut (snabbt när du har mycket, proteinrikt när du tränar). AI-genererat: kolla allergier.
      </p>
      <div className="actions" style={{ marginTop: 8 }}>
        <label className="inline-field">
          <span>Dagar</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[3, 5, 7].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="btn primary" disabled={busy} onClick={generate}>
          {busy ? 'Planerar… (kan ta en halv minut)' : upcoming.length ? 'Gör ny meny' : 'Gör veckomeny'}
        </button>
      </div>
      {busy && <p className="muted" role="status" aria-busy="true">Planerar middagarna…</p>}
      {error && (
        <>
          <p className="error" role="alert">{error}</p>
          <div className="actions" style={{ marginTop: 0 }}><Link to="/installningar" className="btn">Testa anslutningen</Link></div>
        </>
      )}

      {missing.length > 0 && (
        <div className="actions">
          <button type="button" className="btn" onClick={shop}>Lägg det som saknas på inköpslistan ({missing.length})</button>
        </div>
      )}
      {message && <p className="muted" role="status">{message}</p>}

      {upcoming.length === 0 && !busy && <p className="empty">Ingen meny än.</p>}
      {upcoming.map((d) => {
        const ingredients = withPantryStatus(d.ingredients, pantry)
        const lacking = ingredients.filter((i) => i.status === 'missing').length
        return (
          <section key={d.id} className="card recipe" aria-label={`${dayLabel(d.date)}: ${d.title}`}>
            <div className="sub">{d.date === today ? 'Idag' : d.date === addDays(today, 1) ? 'Imorgon' : dayLabel(d.date)}</div>
            <div className="title">{d.title}</div>
            {d.reason && <div className="sub">{d.reason}</div>}
            <div className="sub num">
              {[d.minutes !== null ? `${d.minutes} min` : null, d.nutrition ? `${d.nutrition.kcal} kcal, protein ${d.nutrition.protein} g per portion` : null, lacking ? `${lacking} saknas` : 'allt finns hemma'].filter(Boolean).join(' · ')}
            </div>
            <details style={{ marginTop: 8 }}>
              <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>Ingredienser och steg ({d.portions} portioner)</summary>
              <IngredientList items={ingredients} expiring={expiring} />
              <ol className="steps">{d.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
            </details>
            <div className="actions" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={() => setEating(d)}>Jag åt detta</button>
              <a className="btn text" href={recipeSearchUrl(d.title)} target="_blank" rel="noreferrer">Hitta receptet på nätet</a>
              <button type="button" className="btn text" onClick={() => undoable(`${d.title} är borttagen ur menyn`, ['mealPlan'], () => db.mealPlan.delete(d.id))}>Ta bort</button>
            </div>
          </section>
        )
      })}
      {eating && (
        <MealForm key={eating.id} meal={null} date={today} draft={{ name: eating.title, source: 'recipe', ...(eating.nutrition ?? {}) }} onClose={() => setEating(null)} />
      )}
    </>
  )
}
