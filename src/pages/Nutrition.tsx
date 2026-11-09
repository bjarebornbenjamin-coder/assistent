import { useState } from 'react'
import { MealForm } from '../components/MealForm'
import { Columns, type Column } from '../components/charts/Columns'
import { addWater, saveSettings } from '../db/repo'
import { addDays, parseISODate, toISODate } from '../domain/dates'
import { averageOverLogged, goalKcal, lastDays, mealKcal, mealsOn, progress, totalsOf } from '../domain/nutrition'
import type { Meal, NutritionSettings } from '../domain/types'
import { useMeals, useNow, useSettings, useWater } from '../hooks'

/** Gram med svenskt decimaltecken. */
const g = (n: number) => `${n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} g`

function MacroStat({ label, value, goal, color, unit = 'g' }: { label: string; value: number; goal: number; color: string; unit?: 'g' | 'kcal' }) {
  const pct = goal > 0 ? Math.round((value / goal) * 100) : 0
  return (
    <div>
      <div className="sub">{label}</div>
      <div className="big">{unit === 'kcal' ? value : g(value)}</div>
      <div className={pct > 105 ? 'sub over' : 'sub'}>mål {unit === 'kcal' ? goal : g(goal)} · {pct} %{pct > 105 ? ' (över målet)' : ''}</div>
      <div className="viz-meter" role="meter" aria-label={`${label}: ${pct} % av målet`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pct)}>
        <span style={{ width: `${progress(value, goal) * 100}%`, background: pct > 105 ? 'var(--warn-text)' : color }} />
      </div>
    </div>
  )
}

const dayTitle = (date: string, today: string) =>
  date === today ? 'Idag' : date === addDays(today, -1) ? 'Igår' : parseISODate(date).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

function DayView() {
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
          <MacroStat label="Kalorier" value={totals.kcal} goal={goalKcal(goals)} color="var(--primary)" unit="kcal" />
          <MacroStat label="Protein" value={totals.protein} goal={goals.proteinG} color="var(--viz-protein)" />
          <MacroStat label="Kolhydrater" value={totals.carbs} goal={goals.carbsG} color="var(--viz-carbs)" />
          <MacroStat label="Fett" value={totals.fat} goal={goals.fatG} color="var(--viz-fat)" />
        </div>
      </div>

      <h2>Vatten</h2>
      <div className="card">
        <div className="big" aria-live="polite">{(ml / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} l <span className="sub">av {(goals.waterMl / 1000).toLocaleString('sv-SE')} l</span></div>
        <div className="viz-meter" role="meter" aria-label="Vatten, andel av målet" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress(ml, goals.waterMl) * 100)}>
          <span style={{ width: `${progress(ml, goals.waterMl) * 100}%`, background: 'var(--viz-water)' }} />
        </div>
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
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Lägg till måltid</button>
      </div>
      {dayMeals.length === 0 ? <p className="empty">Inga måltider loggade.</p> : dayMeals.map((m) => (
        <button key={m.id} type="button" className="card meal" onClick={() => setEditing(m)}>
          <div className="row">
            {m.time && <span className="time" style={{ minWidth: '3.5em' }}>{m.time}</span>}
            <div>
              <div className="title">{m.name}</div>
              <div className="sub">{mealKcal(m)} kcal · P {g(m.protein)} · K {g(m.carbs)} · F {g(m.fat)}</div>
            </div>
          </div>
        </button>
      ))}
      {editing && <MealForm key={editing === 'new' ? 'new' : editing.id} meal={editing === 'new' ? null : editing} date={date} onClose={() => setEditing(null)} />}
    </>
  )
}

const num = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 })
const liters = (ml: number) => `${(ml / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} l`

function TrendView() {
  const meals = useMeals()
  const water = useWater()
  const settings = useSettings()
  const today = toISODate(useNow())
  const [days, setDays] = useState<7 | 30>(7)
  if (!meals || !water || !settings) return null

  const goals = settings.nutrition
  const points = lastDays(today, days, meals, water)
  const avg = averageOverLogged(points)
  const waterDays = points.filter((p) => p.waterMl > 0)
  const waterAvg = waterDays.length ? waterDays.reduce((s, p) => s + p.waterMl, 0) / waterDays.length : null
  const loggedDays = points.filter((p) => p.meals > 0).length

  const label = (d: string, i: number) => {
    const date = parseISODate(d)
    return days === 7 ? date.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '') : String(date.getDate()) + (i === 0 ? '/' + (date.getMonth() + 1) : '')
  }
  const title = (d: string) => parseISODate(d).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })
  const cols = (f: (p: (typeof points)[number]) => Column['segments']): Column[] => points.map((p, i) => ({ key: p.date, label: label(p.date, i), title: title(p.date), segments: f(p) }))
  const labelEvery = days === 7 ? 1 : 5

  const macroCol = (id: string, name: string, color: string, pick: (p: (typeof points)[number]) => number) => cols((p) => [{ id, label: name, color, value: pick(p) }])
  const g1 = (v: number) => `${num(v)} g`

  return (
    <>
      <div className="seg" role="group" aria-label="Period">
        <button type="button" className="tab" aria-pressed={days === 7} onClick={() => setDays(7)}>7 dagar</button>
        <button type="button" className="tab" aria-pressed={days === 30} onClick={() => setDays(30)}>30 dagar</button>
      </div>

      <p className="muted">
        {loggedDays === 0 ? `Inga måltider loggade de senaste ${days} dagarna.` : loggedDays === 1 ? 'Snitt för den enda dag du loggat måltider.' : `Snitt över de ${loggedDays} dagar du loggat måltider (tomma dagar räknas inte).`}
      </p>
      {avg && (
        <div className="stat-grid">
          <div className="stat"><div className="sub">Kalorier</div><div className="big">{avg.kcal}</div></div>
          <div className="stat"><div className="sub">Protein</div><div className="big">{num(avg.protein)} g</div></div>
          <div className="stat"><div className="sub">Kolhydrater</div><div className="big">{num(avg.carbs)} g</div></div>
          <div className="stat"><div className="sub">Fett</div><div className="big">{num(avg.fat)} g</div></div>
          <div className="stat"><div className="sub">Vatten</div><div className="big">{waterAvg === null ? '–' : liters(waterAvg)}</div></div>
        </div>
      )}

      <Columns
        title="Kalorier per dag"
        subtitle="Fördelade på protein, kolhydrater och fett (4, 4 och 9 kcal per gram)"
        columns={cols((p) => [
          { id: 'p', label: 'Protein', color: 'var(--viz-protein)', value: Math.round(p.protein * 4) },
          { id: 'c', label: 'Kolhydrater', color: 'var(--viz-carbs)', value: Math.round(p.carbs * 4) },
          { id: 'f', label: 'Fett', color: 'var(--viz-fat)', value: Math.round(p.fat * 9) },
        ])}
        labelEvery={labelEvery}
        goal={{ value: goalKcal(goals), label: `Mål ${goalKcal(goals)}` }}
        format={(v) => `${v} kcal`}
        formatTick={(v) => String(v)}
        totalLabel="Totalt"
      />
      <Columns title="Protein" subtitle="Gram per dag" columns={macroCol('p', 'Protein', 'var(--viz-protein)', (p) => p.protein)} labelEvery={labelEvery} goal={{ value: goals.proteinG, label: `Mål ${goals.proteinG} g` }} format={g1} formatTick={(v) => String(v)} height={150} />
      <Columns title="Kolhydrater" subtitle="Gram per dag" columns={macroCol('c', 'Kolhydrater', 'var(--viz-carbs)', (p) => p.carbs)} labelEvery={labelEvery} goal={{ value: goals.carbsG, label: `Mål ${goals.carbsG} g` }} format={g1} formatTick={(v) => String(v)} height={150} />
      <Columns title="Fett" subtitle="Gram per dag" columns={macroCol('f', 'Fett', 'var(--viz-fat)', (p) => p.fat)} labelEvery={labelEvery} goal={{ value: goals.fatG, label: `Mål ${goals.fatG} g` }} format={g1} formatTick={(v) => String(v)} height={150} />
      <Columns
        title="Vatten"
        subtitle="Liter per dag"
        columns={macroCol('w', 'Vatten', 'var(--viz-water)', (p) => p.waterMl)}
        labelEvery={labelEvery}
        goal={{ value: goals.waterMl, label: `Mål ${liters(goals.waterMl)}` }}
        format={liters}
        formatTick={(v) => (v / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })}
        height={150}
      />
    </>
  )
}

function GoalsView() {
  const settings = useSettings()
  const [draft, setDraft] = useState<Partial<Record<keyof NutritionSettings, string>>>({})
  const [saved, setSaved] = useState('')
  if (!settings) return null
  const goals = settings.nutrition

  const field = (key: keyof NutritionSettings, label: string, unit: string, min: number, max: number) => (
    <label className="field">
      <span>{label} ({unit})</span>
      <input
        type="text"
        inputMode="numeric"
        value={draft[key] ?? String(goals[key])}
        onChange={(e) => { setDraft((d) => ({ ...d, [key]: e.target.value })); setSaved('') }}
        onBlur={() => {
          const raw = draft[key]
          if (raw === undefined) return
          const n = Math.round(Number(raw.replace(',', '.')))
          setDraft((d) => { const { [key]: _drop, ...rest } = d; void _drop; return rest })
          if (Number.isFinite(n) && n >= min && n <= max && n !== goals[key]) void saveSettings({ nutrition: { ...goals, [key]: n } }).then(() => setSaved('Sparat.'))
        }}
      />
    </label>
  )

  return (
    <>
      <p className="muted">Mål per dag. Kalorimålet räknas ut från makromålen ({goalKcal(goals)} kcal just nu). Det här är bara dina egna riktvärden, inte medicinska råd.</p>
      <div className="two">
        {field('proteinG', 'Protein', 'g', 0, 1000)}
        {field('carbsG', 'Kolhydrater', 'g', 0, 2000)}
        {field('fatG', 'Fett', 'g', 0, 1000)}
        {field('waterMl', 'Vatten', 'ml', 0, 20000)}
        {field('glassMl', 'Ett glas vatten', 'ml', 50, 2000)}
      </div>
      <div className="actions" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            const next = { ...goals }
            for (const [key, raw] of Object.entries(draft) as [keyof NutritionSettings, string][]) {
              const n = Math.round(Number(raw.replace(',', '.')))
              if (Number.isFinite(n) && n >= 0) next[key] = n
            }
            await saveSettings({ nutrition: next })
            setDraft({})
            setSaved('Målen är sparade.')
          }}
        >
          Spara mål
        </button>
      </div>
      {saved && <p className="muted" role="status">{saved}</p>}
    </>
  )
}

export function NutritionTab() {
  const [view, setView] = useState<'dag' | 'utveckling' | 'mal'>('dag')
  return (
    <>
      <div className="seg" role="group" aria-label="Kostvy">
        <button type="button" className="tab" aria-pressed={view === 'dag'} onClick={() => setView('dag')}>Dag</button>
        <button type="button" className="tab" aria-pressed={view === 'utveckling'} onClick={() => setView('utveckling')}>Utveckling</button>
        <button type="button" className="tab" aria-pressed={view === 'mal'} onClick={() => setView('mal')}>Mål</button>
      </div>
      {view === 'dag' ? <DayView /> : view === 'utveckling' ? <TrendView /> : <GoalsView />}
    </>
  )
}
