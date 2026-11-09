import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PantryForm } from '../components/PantryForm'
import { addShoppingItems, clearBought, deleteShoppingItem, moveBoughtToPantry, runOut, saveShoppingItem } from '../db/repo'
import { toISODate } from '../domain/dates'
import { expiryLabel, expiryStatus, expiringWithin, sortPantry } from '../domain/food'
import type { PantryItem } from '../domain/types'
import { useFieldError, useNow, usePantry, useShopping } from '../hooks'

type Tab = 'lager' | 'inkop'

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

export function FoodPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('v') === 'inkop' ? 'inkop' : 'lager'
  const select = (t: Tab) => setParams(t === 'lager' ? {} : { v: t }, { replace: true })

  return (
    <>
      <h1>Mat</h1>
      <div className="seg" role="group" aria-label="Avsnitt">
        <button type="button" className="tab" aria-pressed={tab === 'lager'} onClick={() => select('lager')}>Lager</button>
        <button type="button" className="tab" aria-pressed={tab === 'inkop'} onClick={() => select('inkop')}>Inköpslista</button>
      </div>
      {tab === 'lager' ? <PantryTab /> : <ShoppingTab />}
    </>
  )
}
