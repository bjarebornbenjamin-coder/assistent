import { useState, type FormEvent } from 'react'
import { estimateMeal } from '../ai/nutritionEstimate'
import { deleteMeal, newId, saveMeal } from '../db/repo'
import { mealKcal } from '../domain/nutrition'
import type { ISODate, Meal } from '../domain/types'
import { undoable } from '../lib/undo'
import { useAiConfig, useFieldError } from '../hooks'
import { authHeaders } from '../lib/auth'

/** Tolkar ett tal med komma eller punkt. Tomt = fallback. null = ogiltigt. */
export function parseNumber(text: string, fallback: number | undefined): number | undefined | null {
  const t = text.trim().replace(',', '.')
  if (t === '') return fallback
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}

interface Props {
  meal: Meal | null
  date: ISODate
  /** Förifyllda värden, t.ex. från en AI-uppskattning eller ett recept. */
  draft?: Partial<Pick<Meal, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'source'>>
  onClose: () => void
}

const show = (n: number | undefined) => (n === undefined ? '' : String(n))

export function MealForm({ meal, date, draft, onClose }: Props) {
  const init = meal ?? draft
  const [name, setName] = useState(init?.name ?? '')
  const [time, setTime] = useState(meal?.time ?? '')
  const [protein, setProtein] = useState(show(init?.protein))
  const [carbs, setCarbs] = useState(show(init?.carbs))
  const [fat, setFat] = useState(show(init?.fat))
  const [kcal, setKcal] = useState(show(init?.kcal))
  const [usedAi, setUsedAi] = useState(false)
  const [assumptions, setAssumptions] = useState('')
  const [estimating, setEstimating] = useState(false)
  const config = useAiConfig()
  const { error, fail, touch } = useFieldError()

  const p = parseNumber(protein, 0)
  const c = parseNumber(carbs, 0)
  const f = parseNumber(fat, 0)
  const computed = p !== null && c !== null && f !== null ? mealKcal({ protein: p ?? 0, carbs: c ?? 0, fat: f ?? 0 }) : null

  async function estimate() {
    if (!name.trim()) return fail('name', 'Beskriv först vad du åt, t.ex. "2 ägg och 2 skivor bröd med smör".')
    setEstimating(true)
    setAssumptions('')
    try {
      const est = await estimateMeal(name, config?.model ?? 'gpt-4o-mini', await authHeaders())
      setProtein(String(est.protein))
      setCarbs(String(est.carbs))
      setFat(String(est.fat))
      setKcal('') // räknas från makrona (4/4/9), så att kalorier och makron alltid stämmer överens
      setAssumptions(est.assumptions || 'AI-uppskattning utan förklaring.')
      setUsedAi(true)
      touch('numbers')
      touch('ai')
    } catch (e) {
      fail('ai', e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setEstimating(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return fail('name', 'Skriv vad du åt.')
    const k = parseNumber(kcal, undefined)
    if (p === null || c === null || f === null || k === null) return fail('numbers', 'Skriv siffror (0 eller mer) för näringsvärdena.')
    if ((p ?? 0) > 1000 || (c ?? 0) > 2000 || (f ?? 0) > 1000 || (k ?? 0) > 10000) return fail('numbers', 'Värdena ser orimligt höga ut.')
    await saveMeal({
      id: meal?.id ?? newId(),
      date: meal?.date ?? date,
      ...(time ? { time } : {}),
      name: name.trim(),
      ...(k !== undefined ? { kcal: Math.round(k) } : {}),
      protein: Math.round((p ?? 0) * 10) / 10,
      carbs: Math.round((c ?? 0) * 10) / 10,
      fat: Math.round((f ?? 0) * 10) / 10,
      source: usedAi ? 'ai' : (meal?.source ?? draft?.source ?? 'manual'),
      updatedAt: '',
    })
    onClose()
  }

  async function remove() {
    if (!meal) return
    await undoable('Måltiden är borttagen', ['meals'], () => deleteMeal(meal.id))
    onClose()
  }

  const num = (label: string, value: string, set: (v: string) => void, placeholder = '0') => (
    <label className="field">
      <span>{label}</span>
      <input type="text" inputMode="decimal" placeholder={placeholder} value={value} onChange={(e) => { set(e.target.value); touch('numbers') }} />
    </label>
  )

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={meal ? 'Ändra måltid' : 'Ny måltid'}>
        <h1>{meal ? 'Ändra måltid' : 'Ny måltid'}</h1>
        <label className="field">
          <span>Vad åt du?</span>
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); touch('name') }} autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
        <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
          <button type="button" className="btn" disabled={estimating} onClick={estimate}>{estimating ? 'Uppskattar…' : 'Uppskatta näring med AI'}</button>
        </div>
        {assumptions && <p className="muted" role="status">AI-uppskattning: {assumptions} Kontrollera och ändra vid behov.</p>}
        <label className="field">
          <span>Tid (valfritt)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <div className="two">
          {num('Protein (g)', protein, setProtein)}
          {num('Kolhydrater (g)', carbs, setCarbs)}
          {num('Fett (g)', fat, setFat)}
          {num('Kalorier (valfritt)', kcal, setKcal, computed !== null ? `${computed} (beräknas)` : '')}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Spara</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {meal && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
