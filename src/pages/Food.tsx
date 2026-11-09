import { useState } from 'react'
import { PantryForm } from '../components/PantryForm'
import { deletePantryItem } from '../db/repo'
import { toISODate } from '../domain/dates'
import { expiryLabel, expiryStatus, expiringWithin, sortPantry } from '../domain/food'
import type { PantryItem } from '../domain/types'
import { useNow, usePantry } from '../hooks'

function PantryTab() {
  const pantry = usePantry()
  const today = toISODate(useNow())
  const [editing, setEditing] = useState<PantryItem | 'new' | null>(null)
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
            <button type="button" className="btn" aria-label={`Slut: ${i.name}`} onClick={() => deletePantryItem(i.id)}>Slut</button>
          </div>
        )
      })}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Lägg till vara</button>
      </div>
      {editing && <PantryForm key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

export function FoodPage() {
  return (
    <>
      <h1>Mat</h1>
      <PantryTab />
    </>
  )
}
