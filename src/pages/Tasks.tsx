import { useState } from 'react'
import { Link } from 'react-router-dom'
import { TaskForm } from '../components/TaskForm'
import { TaskRow } from '../components/TaskRow'
import { toISODate } from '../domain/dates'
import type { Task } from '../domain/types'
import { useNow, useSubjects, useTasks } from '../hooks'

export function TasksPage() {
  const tasks = useTasks()
  const subjects = useSubjects()
  const today = toISODate(useNow())
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  if (!tasks || !subjects) return null

  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done).sort((a, b) => b.deadline.localeCompare(a.deadline))
  const row = (t: Task) => <TaskRow key={t.id} task={t} subject={subjectById.get(t.subjectId ?? '')} today={today} onEdit={() => setEditing(t)} />

  return (
    <>
      <Link to="/" className="back">← Tillbaka till Hem</Link>
      <h1>Uppgifter</h1>
      {open.length === 0 ? <p className="empty">Inga uppgifter att göra.</p> : open.map(row)}
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Ny uppgift</button>
      </div>

      {done.length > 0 && (
        <details style={{ marginTop: 24 }}>
          <summary className="muted" style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Klara ({done.length})</summary>
          {done.map(row)}
        </details>
      )}

      {editing && (
        <TaskForm
          key={editing === 'new' ? 'new' : editing.id}
          task={editing === 'new' ? null : editing}
          defaultDeadline={today}
          subjects={subjects}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
