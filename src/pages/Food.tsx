import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { NutritionTab } from './Nutrition'
import { MealForm } from '../components/MealForm'
import { PantryForm } from '../components/PantryForm'
import { fetchRecipes, type Recipe } from '../ai/recipes'
import { addShoppingItems, clearBought, deleteShoppingItem, moveBoughtToPantry, runOut, saveSettings, saveShoppingItem } from '../db/repo'
import { toISODate } from '../domain/dates'
import { expiryLabel, expiryStatus, expiringWithin, sortPantry } from '../domain/food'
import type { PantryItem } from '../domain/types'
import { useAiConfig, useFieldError, useNow, usePantry, useSettings, useShopping } from '../hooks'
import { authHeaders } from '../lib/auth'

type Tab = 'lager' | 'inkop' | 'recept' | 'kost'

function RunOutDialog({ item, onClose }: { item: PantryItem; onClose: () => void }) {
  const done = async (addToList: boolean) => {
    await runOut(item.id, addToList)
    onClose()
  }
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="runout-title" onClick={(e) => e.stopPropagation()}>
        <h1 id="runout-title" style={{ fontSize: 20 }}>{item.name} är slut?</h1>
        <div className="actions">
          <button type="button" className="btn primary" onClick={() => done(true)}>Lägg på inköpslistan</button>
          <button type="button" className="btn" onClick={() => done(false)}>Bara ta bort</button>
          <button type="button" className="btn" onClick={onClose} autoFocus>Avbryt</button>
        </div>
      </div>
    </div>
  )
}

function PantryTab() {
  const pantry = usePantry()
  const today = toISODate(useNow())
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null)
  const [runningOut, setRunningOut] = useState<PantryItem | null>(null)
  if (!pantry) return null

  const sorted = sortPantry(pantry)
  const soon = expiringWithin(pantry, today).length

  return (
    <>
      <p className="muted">
        {pantry.length === 0 ? 'Lagret är tomt.' : `${pantry.length} varor`}
        {soon > 0 ? ` · ${soon} går ut snart eller har gått ut` : ''}
      </p>
      {sorted.map((i) => {
        const status = expiryStatus(i.expires, today)
        return (
          <div key={i.id} className="card task">
            <button type="button" className="task-main" onClick={() => setEditing(i)}>
              <span className="title">{i.name}{i.amount ? ` · ${i.amount}` : ''}</span>
              {i.expires && <span className={`sub${status === 'expired' || status === 'today' || status === 'soon' ? ' overdue' : ''}`}>{expiryLabel(i.expires, today)}</span>}
            </button>
            <button type="button" className="btn" aria-label={`Slut: ${i.name}`} onClick={() => setRunningOut(i)}>Slut</button>
          </div>
        )
      })}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Lägg till vara</button>
        <Link to="/mat/skanna?typ=kvitto" className="btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Skanna kvitto</Link>
        <Link to="/mat/skanna?typ=kylskap" className="btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Skanna kylskåp</Link>
      </div>
      {editing && <PantryForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {runningOut && <RunOutDialog item={runningOut} onClose={() => setRunningOut(null)} />}
    </>
  )
}

function ShoppingTab() {
  const shopping = useShopping()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const { error, fail, touch } = useFieldError()
  if (!shopping) return null

  const open = shopping.filter((i) => !i.done).sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.name.localeCompare(b.name, 'sv'))
  const bought = shopping.filter((i) => i.done)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return fail('name', 'Skriv vad du ska köpa.')
    const res = await addShoppingItems([{ name, amount }])
    if (res.added === 0) return fail('name', `${name.trim()} står redan på listan.`)
    setName('')
    setAmount('')
    setMessage('')
  }

  async function toPantry() {
    const n = await moveBoughtToPantry()
    setMessage(`${n} ${n === 1 ? 'vara' : 'varor'} lades i lagret.`)
  }

  const row = (i: (typeof shopping)[number]) => (
    <div key={i.id} className={`card task${i.done ? ' done' : ''}`}>
      <input type="checkbox" aria-label={`Köpt: ${i.name}`} checked={i.done} onChange={(e) => saveShoppingItem({ ...i, done: e.target.checked })} />
      <div className="task-main" style={{ cursor: 'default' }}>
        <span className="title">{i.name}{i.amount ? ` · ${i.amount}` : ''}</span>
        {i.note && <span className="sub">{i.note}</span>}
      </div>
      <button type="button" className="btn" aria-label={`Ta bort ${i.name}`} onClick={() => deleteShoppingItem(i.id)}>Ta bort</button>
    </div>
  )

  return (
    <>
      <form className="item" onSubmit={add}>
        <input type="text" aria-label="Vara att köpa" placeholder="Vara" value={name} onChange={(e) => { setName(e.target.value); touch('name') }} />
        <input type="text" aria-label="Mängd" placeholder="Mängd" style={{ maxWidth: 110 }} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button type="submit" className="btn primary">Lägg till</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      <p className="muted" style={{ marginTop: 12 }}>{open.length === 0 ? 'Inköpslistan är tom.' : `${open.length} att köpa`}</p>
      {open.map(row)}

      {bought.length > 0 && (
        <>
          <h2>Köpt ({bought.length})</h2>
          {bought.map(row)}
          <div className="actions">
            <button type="button" className="btn primary" onClick={toPantry}>Lägg köpta varor i lagret</button>
            <button type="button" className="btn" onClick={() => clearBought()}>Rensa köpta</button>
          </div>
        </>
      )}
      {message && <p className="muted" role="status">{message}</p>}
    </>
  )
}

function RecipesTab() {
  const pantry = usePantry()
  const settings = useSettings()
  const config = useAiConfig()
  const today = toISODate(useNow())
  const [recipes, setRecipes] = useState<Recipe[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [allergies, setAllergies] = useState<string | null>(null)
  const [eating, setEating] = useState<Recipe | null>(null)
  if (!pantry || !settings || !config) return null
  const food = settings.food
  const usable = pantry.filter((p) => !p.expires || p.expires >= today)

  async function suggest() {
    setBusy(true)
    setError('')
    setNotes({})
    try {
      setRecipes(await fetchRecipes(usable, food, today, config!.model, await authHeaders()))
    } catch (e) {
      setRecipes(null)
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
    }
  }

  async function addMissing(r: Recipe) {
    const res = await addShoppingItems(r.missing.map((m) => ({ name: m.name, amount: m.amount, note: r.title })))
    setNotes((n) => ({ ...n, [r.title]: `${res.added} ${res.added === 1 ? 'vara' : 'varor'} lades på inköpslistan${res.skipped ? ` (${res.skipped} fanns redan)` : ''}.` }))
  }

  const expiring = new Set(expiringWithin(pantry, today).map((p) => p.name))

  return (
    <>
      <div className="two">
        <label className="field">
          <span>Portioner</span>
          <select value={food.portions} onChange={(e) => saveSettings({ food: { ...food, portions: Number(e.target.value) } })}>
            {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Allergier / kost</span>
          <input
            type="text"
            placeholder="t.ex. nötter, vegetariskt"
            value={allergies ?? food.allergies}
            onChange={(e) => setAllergies(e.target.value)}
            onBlur={() => {
              if (allergies !== null) void saveSettings({ food: { ...food, allergies: allergies.trim() } })
              setAllergies(null)
            }}
          />
        </label>
      </div>
      <p className="muted">
        {usable.length === 0
          ? 'Lägg först in varor i lagret.'
          : `Utgår från ${usable.length} varor, det som går ut först. AI-genererat: kolla allergier.`}
      </p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary" disabled={busy || usable.length === 0} onClick={suggest}>
          {busy ? 'Tänker…' : recipes ? 'Föreslå nya recept' : 'Föreslå recept'}
        </button>
      </div>
      {error && <p className="error" role="alert">{error} <Link to="/installningar">Testa anslutningen i Inställningar.</Link></p>}

      {recipes?.map((r) => (
        <div key={r.title} className="card recipe">
          <div className="title">{r.title}</div>
          <div className="sub">
            {[
              `${r.portions} portioner`,
              r.prepMinutes !== null ? `förberedelse ${r.prepMinutes} min` : null,
              r.cookMinutes !== null ? `tillagning ${r.cookMinutes} min` : null,
            ].filter(Boolean).join(' · ')}
          </div>
          {r.nutrition && (
            <div className="sub">
              Per portion (uppskattat): {r.nutrition.kcal} kcal · protein {r.nutrition.protein} g · kolhydrater {r.nutrition.carbs} g · fett {r.nutrition.fat} g
            </div>
          )}

          <h3 className="recipe-h">Ingredienser</h3>
          <ul className="ingredients">
            {r.ingredients.map((i) => (
              <li key={i.name} className={i.status === 'missing' ? 'missing' : ''}>
                <span>{i.amount ? `${i.amount} ` : ''}{i.name}</span>
                <span className="sub">
                  {i.status === 'pantry' && (expiring.has(i.pantryName ?? '') ? 'har hemma, snart ute' : 'har hemma')}
                  {i.status === 'staple' && 'basvara'}
                  {i.status === 'missing' && 'saknas'}
                </span>
              </li>
            ))}
          </ul>
          {r.equipment.length > 0 && <p className="sub">Du behöver: {r.equipment.join(', ')}</p>}

          <details style={{ marginTop: 8 }} open>
            <summary style={{ cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center', color: 'var(--primary)' }}>Gör så här ({r.steps.length} steg)</summary>
            <ol className="steps">{r.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>
            {r.tip && <p className="sub">Tips: {r.tip}</p>}
          </details>

          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn primary" onClick={() => setEating(r)}>Jag åt detta (1 portion)</button>
            {r.missing.length > 0 && <button type="button" className="btn" onClick={() => addMissing(r)}>Lägg saknade på inköpslistan ({r.missing.length})</button>}
          </div>
          {notes[r.title] && <p className="muted" role="status">{notes[r.title]}</p>}
        </div>
      ))}
      {eating && (
        <MealForm
          key={eating.title}
          meal={null}
          date={today}
          draft={{ name: eating.title, source: 'recipe', ...(eating.nutrition ?? {}) }}
          onClose={() => setEating(null)}
        />
      )}
    </>
  )
}

export function FoodPage() {
  const [params, setParams] = useSearchParams()
  const v = params.get('v')
  const tab: Tab = v === 'inkop' ? 'inkop' : v === 'recept' ? 'recept' : v === 'kost' ? 'kost' : 'lager'
  const select = (t: Tab) => setParams(t === 'lager' ? {} : { v: t }, { replace: true })

  return (
    <>
      <h1>Mat</h1>
      <div className="seg" role="group" aria-label="Avsnitt">
        <button type="button" className="tab" aria-pressed={tab === 'lager'} onClick={() => select('lager')}>Lager</button>
        <button type="button" className="tab" aria-pressed={tab === 'inkop'} onClick={() => select('inkop')}>Inköp</button>
        <button type="button" className="tab" aria-pressed={tab === 'recept'} onClick={() => select('recept')}>Recept</button>
        <button type="button" className="tab" aria-pressed={tab === 'kost'} onClick={() => select('kost')}>Kost</button>
      </div>
      {tab === 'lager' ? <PantryTab /> : tab === 'inkop' ? <ShoppingTab /> : tab === 'recept' ? <RecipesTab /> : <NutritionTab />}
    </>
  )
}
