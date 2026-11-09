import { useState } from 'react'
import { MealForm } from '../components/MealForm'
import { addWater } from '../db/repo'
import { addDays, parseISODate, toISODate } from '../domain/dates'
import { mealKcal, mealsOn, totalsOf } from '../domain/nutrition'
import type { Meal } from '../domain/types'
import { useMeals, useNow, useSettings, useWater } from '../hooks'

/** Gram med svenskt decimaltecken. */
const g = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} g`

const dayTitle = (date: string, today: string) =>
  date === today ? 'Idag' : date === addDays(today, -1) ? 'Igår' : parseISODate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

export function NutritionTab() {
  const meals = useMeals()
  const water = useWater()
  const settings = useSettings()
  const today = toISODate(useNow())
  const [date, setDate] = useState(today)
  const [editing, setEditing] = useState<Meal | 'new' | null>(null)
  const [customMl, setCustomMl] = useState('')
  if (!meals || !water || !settings) return null

  const goals = settings.nutrition
  const dayMeals = mealsOn(date, meals)
  const totals = totalsOf(dayMeals)
  const ml = water.find((w) => w.date === date)?.ml ?? 0

  async function addCustom() {
    const n = Number(customMl.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    await addWater(date, n)
    setCustomMl('')
  }

  return (
    <>
      <div className="cal-head">
        <button type="button" className="btn" aria-label="Föregående dag" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <button type="button" className="btn" aria-label="Nästa dag" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>›</button>
        <span className="cal-title" aria-live="polite">{dayTitle(date, today)}</span>
        {date !== today && <button type="button" className="btn" onClick={() => setDate(today)}>Idag</button>}
      </div>

      <h2>Dagens summa</h2>
      <div className="card">
        <div className="macro-grid">
          <div><div className="sub">Kalorier</div><div className="big">{totals.kcal}</div></div>
          <div><div className="sub">Protein</div><div className="big">{g(totals.protein)}</div><div className="sub">mål {g(goals.proteinG)}</div></div>
          <div><div className="sub">Kolhydrater</div><div className="big">{g(totals.carbs)}</div><div className="sub">mål {g(goals.carbsG)}</div></div>
          <div><div className="sub">Fett</div><div className="big">{g(totals.fat)}</div><div className="sub">mål {g(goals.fatG)}</div></div>
        </div>
      </div>

      <h2>Vatten</h2>
      <div className="card">
        <div className="big" aria-live="polite">{(ml / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} l <span className="sub">av {(goals.waterMl / 1000).toLocaleString('sv-SE')} l</span></div>
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="button" className="btn primary" onClick={() => addWater(date, goals.glassMl)}>+ Glas ({goals.glassMl} ml)</button>
          <button type="button" className="btn" disabled={ml === 0} onClick={() => addWater(date, -goals.glassMl)}>− Glas</button>
        </div>
        <div className="item" style={{ marginTop: 8, marginBottom: 0 }}>
          <input type="text" inputMode="decimal" aria-label="Egen mängd i ml" placeholder="Annan mängd (ml)" value={customMl} onChange={(e) => setCustomMl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <button type="button" className="btn" onClick={addCustom}>Lägg till</button>
        </div>
      </div>

      <h2>Måltider</h2>
      {dayMeals.length === 0 ? <p className="empty">Inga måltider loggade.</p> : dayMeals.map((m) => (
        <button key={m.id} type="button" className="card meal" onClick={() => setEditing(m)}>
          <div className="row">
            <span className="time" style={{ minWidth: '3.5em' }}>{m.time ?? ''}</span>
            <div>
              <div className="title">{m.name}</div>
              <div className="sub">{mealKcal(m)} kcal · P {g(m.protein)} · K {g(m.carbs)} · F {g(m.fat)}</div>
            </div>
          </div>
        </button>
      ))}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Lägg till måltid</button>
      </div>
      {editing && <MealForm key={editing === 'new' ? 'new' : editing.id} meal={editing === 'new' ? null : editing} date={date} onClose={() => setEditing(null)} />}
    </>
  )
}
