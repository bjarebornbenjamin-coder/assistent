import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { addSubject, changePackItems, deleteSubject, newId, updateSubject } from '../db/repo'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SUBJECT_COLORS } from '../domain/colors'
import { itemKey } from '../domain/packing'
import type { Subject } from '../domain/types'
import { useLessons, useSubjects } from '../hooks'

/** Textfält som sparas när man lämnar det. */
function CommitInput({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void | false }) {
  const [draft, setDraft] = useState(value)
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    setDraft(value)
  }
  return (
    <input
      type="text"
      aria-label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== value && onCommit(draft.trim()) === false) setDraft(value)
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

function SubjectCard({ subject, lessonCount }: { subject: Subject; lessonCount: number }) {
  const [newItem, setNewItem] = useState('')
  const [dupError, setDupError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    const text = newItem.trim()
    if (subject.packItems.some((p) => itemKey(p.text) === itemKey(text))) {
      return setDupError(`"${text}" finns redan i ${subject.name}.`)
    }
    setNewItem('')
    await changePackItems(subject.id, (items) => [...items, { id: newId(), text }])
  }

  return (
    <details className="card">
      <summary>
        <span className="title"><i className="dot" style={{ background: subject.color ?? 'transparent', borderColor: subject.color ?? 'var(--outline)' }} aria-hidden="true" />{subject.name}</span>
        <span className="sub">{subject.packItems.length} att ta med</span>
      </summary>

      <label className="field">
        <span>Namn</span>
        <CommitInput
          label="Namn"
          value={subject.name}
          onCommit={(name) => {
            if (name) void updateSubject({ ...subject, name })
          }}
        />
      </label>

      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Färg</div>
      <div className="swatches" role="radiogroup" aria-label={`Färg för ${subject.name}`}>
        {SUBJECT_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={subject.color === c.value}
            aria-label={c.name}
            className="swatch"
            style={{ background: c.value }}
            onClick={() => updateSubject({ ...subject, color: c.value })}
          />
        ))}
        <button type="button" role="radio" aria-checked={!subject.color} className="btn swatch-none" onClick={() => updateSubject({ ...subject, color: undefined })}>Ingen</button>
      </div>

      <div className="muted" style={{ fontSize: 13, margin: '12px 0 4px' }}>Ta med</div>
      {subject.packItems.map((item) => (
        <div className="item" key={item.id}>
          <CommitInput
            label={`Sak: ${item.text}`}
            value={item.text}
            onCommit={(text) => {
              if (text && subject.packItems.some((p) => p.id !== item.id && itemKey(p.text) === itemKey(text))) {
                setDupError(`"${text}" finns redan i ${subject.name}.`)
                return false
              }
              setDupError('')
              void changePackItems(subject.id, (items) =>
                text ? items.map((p) => (p.id === item.id ? { ...p, text } : p)) : items.filter((p) => p.id !== item.id),
              )
            }
            }
          />
          <button type="button" className="btn danger" aria-label={`Ta bort ${item.text}`} onClick={() => changePackItems(subject.id, (items) => items.filter((p) => p.id !== item.id))}>
            Ta bort
          </button>
        </div>
      ))}
      <form className="item" onSubmit={add}>
        <input type="text" aria-label="Ny sak att ta med" placeholder="t.ex. miniräknare" value={newItem} onChange={(e) => { setNewItem(e.target.value); setDupError('') }} />
        <button type="submit" className="btn">Lägg till</button>
      </form>
      {dupError && <p className="error" role="alert">{dupError}</p>}

      <div className="actions">
        <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>Ta bort ämne</button>
      </div>
      {confirmDelete && (
        <ConfirmDialog
          title={`Ta bort ${subject.name}?`}
          message={
            lessonCount > 0
              ? `${lessonCount} lektion${lessonCount > 1 ? 'er' : ''} i schemat tas också bort.`
              : 'Ämnet och dess packlista tas bort.'
          }
          confirmLabel="Ta bort"
          onConfirm={() => deleteSubject(subject.id)}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </details>
  )
}

export function SubjectsPage() {
  const subjects = useSubjects()
  const lessons = useLessons()
  const [name, setName] = useState('')
  if (!subjects || !lessons) return null

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await addSubject(name)
    setName('')
  }

  return (
    <>
      <Link to="/schema" className="back">‹ Tillbaka till Schema</Link>
      <h1>Ämnen och packlistor</h1>
      <form className="item" onSubmit={add}>
        <input type="text" aria-label="Nytt ämne" placeholder="Nytt ämne, t.ex. Matte" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn primary">Lägg till</button>
      </form>
      <div style={{ height: 8 }} />
      {subjects.length === 0 ? (
        <p className="empty">Inga ämnen än. Lägg till ett ovan, eller skapa det när du lägger in en lektion.</p>
      ) : (
        subjects.map((s) => (
          <SubjectCard key={s.id} subject={s} lessonCount={lessons.filter((l) => l.subjectId === s.id).length} />
        ))
      )}
    </>
  )
}
