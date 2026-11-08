import { useState, type FormEvent } from 'react'
import { addSubject, changePackItems, deleteSubject, newId, updateSubject } from '../db/repo'
import type { Subject } from '../domain/types'
import { useLessons, useSubjects } from '../hooks'

/** Textfält som sparas när man lämnar det. */
function CommitInput({ value, label, onCommit }: { value: string; label: string; onCommit: (v: string) => void }) {
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
      onBlur={() => draft.trim() !== value && onCommit(draft.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  )
}

function SubjectCard({ subject, lessonCount }: { subject: Subject; lessonCount: number }) {
  const [newItem, setNewItem] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    const text = newItem.trim()
    setNewItem('')
    await changePackItems(subject.id, (items) => [...items, { id: newId(), text }])
  }

  async function remove() {
    const extra = lessonCount > 0 ? ` Det tar också bort ${lessonCount} lektion${lessonCount > 1 ? 'er' : ''} i schemat.` : ''
    if (confirm(`Ta bort ${subject.name}?${extra}`)) await deleteSubject(subject.id)
  }

  return (
    <details className="card">
      <summary>
        <span className="title">{subject.name}</span>
        <span className="sub">{subject.packItems.length} att ta med</span>
      </summary>

      <label className="field">
        <span>Namn</span>
        <CommitInput
          label="Namn"
          value={subject.name}
          onCommit={(name) => name && updateSubject({ ...subject, name })}
        />
      </label>

      <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Ta med</div>
      {subject.packItems.map((item) => (
        <div className="item" key={item.id}>
          <CommitInput
            label={`Sak: ${item.text}`}
            value={item.text}
            onCommit={(text) =>
              changePackItems(subject.id, (items) =>
                text ? items.map((p) => (p.id === item.id ? { ...p, text } : p)) : items.filter((p) => p.id !== item.id),
              )
            }
          />
          <button type="button" className="btn danger" aria-label={`Ta bort ${item.text}`} onClick={() => changePackItems(subject.id, (items) => items.filter((p) => p.id !== item.id))}>
            Ta bort
          </button>
        </div>
      ))}
      <form className="item" onSubmit={add}>
        <input type="text" aria-label="Ny sak att ta med" placeholder="t.ex. miniräknare" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
        <button type="submit" className="btn">Lägg till</button>
      </form>

      <div className="actions">
        <button type="button" className="btn danger" onClick={remove}>Ta bort ämne</button>
      </div>
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
