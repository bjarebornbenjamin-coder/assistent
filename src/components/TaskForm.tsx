import { useState, type FormEvent } from 'react'
import { deleteTask, newId, saveTask } from '../db/repo'
import type { ISODate, Subject, Task } from '../domain/types'
import { useFieldError } from '../hooks'
import { undoable } from '../lib/undo'

interface Props {
  task: Task | null
  defaultDeadline: ISODate
  subjects: Subject[]
  onClose: () => void
}

export function TaskForm({ task, defaultDeadline, subjects, onClose }: Props) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? '')
  const [deadline, setDeadline] = useState(task?.deadline ?? defaultDeadline)
  const [time, setTime] = useState(task?.time ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [done, setDone] = useState(task?.done ?? false)
  const { error, fail, touch } = useFieldError()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail('title', 'Skriv en titel.')
    if (!deadline) return fail('deadline', 'Välj en deadline.')
    await saveTask({
      id: task?.id ?? newId(),
      title: title.trim(),
      ...(subjectId ? { subjectId } : {}),
      deadline,
      ...(time ? { time } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      done,
      updatedAt: '',
    })
    onClose()
  }

  async function remove() {
    if (!task) return
    await undoable('Uppgiften är borttagen', ['tasks'], () => deleteTask(task.id))
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={task ? 'Ändra uppgift' : 'Ny uppgift'}>
        <h1>{task ? 'Ändra uppgift' : 'Ny uppgift'}</h1>
        <label className="field">
          <span>Titel</span>
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); touch('title') }} autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
        <label className="field">
          <span>Ämne (valfritt)</span>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Inget ämne</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Deadline</span>
          <input type="date" value={deadline} onChange={(e) => { setDeadline(e.target.value); touch('deadline') }} required />
        </label>
        <label className="field">
          <span>Klockslag (valfritt)</span>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
        <label className="field">
          <span>Anteckning (valfritt)</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="t.ex. lämnas in på Classroom, sidorna 40–52" />
        </label>
        {task && (
          <div className="checks">
            <label><input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} /> Klar</label>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Spara</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {task && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
