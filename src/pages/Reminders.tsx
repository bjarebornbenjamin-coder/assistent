import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ReminderForm } from '../components/ReminderForm'
import { setReminderEnabled } from '../db/repo'
import { toISODate } from '../domain/dates'
import { describeRepeat } from '../domain/reminders'
import type { Reminder } from '../domain/types'
import { useNow, useReminders } from '../hooks'

export function RemindersPage() {
  const reminders = useReminders()
  const today = toISODate(useNow())
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null)
  if (!reminders) return null

  const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, 'sv'))

  return (
    <>
      <Link to="/" className="back">‹ Tillbaka till Hem</Link>
      <h1>Påminnelser</h1>
      <p className="muted">Fristående påminnelser skickas som notis. Slå på notiser under Inställningar, och logga in så att servern kan skicka dem.</p>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Ny påminnelse</button>
      </div>
      {sorted.length === 0 ? (
        <p className="empty">Inga påminnelser än.</p>
      ) : (
        sorted.map((r) => {
          const past = r.repeat.kind === 'once' && r.repeat.date < today
          return (
            <div key={r.id} className={`card task${r.enabled && !past ? '' : ' done'}`}>
              <input type="checkbox" aria-label={`På: ${r.title}`} checked={r.enabled} onChange={(e) => setReminderEnabled(r.id, e.target.checked)} />
              <button type="button" className="task-main" onClick={() => setEditing(r)}>
                <span className="title">{r.title}</span>
                <span className="sub">{r.time} · {describeRepeat(r.repeat)}{past ? ' · Passerad' : ''}</span>
              </button>
            </div>
          )
        })
      )}
      {editing && (
        <ReminderForm
          key={editing === 'new' ? 'new' : editing.id}
          reminder={editing === 'new' ? null : editing}
          defaultDate={today}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
