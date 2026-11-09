import { useState, type FormEvent } from 'react'
import { undoable } from '../lib/undo'
import { useFieldError } from '../hooks'
import { addSubject, deleteLesson, newId, saveLesson } from '../db/repo'
import { WEEKDAYS_LONG } from '../domain/dates'
import { findConflicts } from '../domain/schedule'
import type { Lesson, Subject } from '../domain/types'
import { cycleLabel } from '../domain/weekCycle'

const NEW = '__new__'

interface Props {
  lesson: Lesson | null
  defaultWeekday: number
  subjects: Subject[]
  lessons: Lesson[]
  cycleLength: number
  onClose: () => void
}

export function LessonForm({ lesson, defaultWeekday, subjects, lessons, cycleLength, onClose }: Props) {
  const [subjectId, setSubjectId] = useState(lesson?.subjectId ?? subjects[0]?.id ?? NEW)
  const [newName, setNewName] = useState('')
  const [weekday, setWeekday] = useState(lesson?.weekday ?? defaultWeekday)
  const [start, setStart] = useState(lesson?.start ?? '08:00')
  const [end, setEnd] = useState(lesson?.end ?? '08:45')
  const [room, setRoom] = useState(lesson?.room ?? '')
  const [teacher, setTeacher] = useState(lesson?.teacher ?? '')
  const [weeks, setWeeks] = useState<number[]>(
    lesson?.weeks ?? Array.from({ length: cycleLength }, (_, i) => i),
  )
  const { error, fail, touch } = useFieldError()

  const conflicts =
    start && end && end > start && weeks.length > 0
      ? findConflicts({ id: lesson?.id ?? '', weekday, start, end, weeks: weeks.length === cycleLength ? null : weeks }, lessons, cycleLength)
      : []
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? 'Okänt ämne'
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!start || !end || end <= start) return fail('time', 'Sluttiden måste vara efter starttiden.')
    if (subjectId === NEW && !newName.trim()) return fail('subject', 'Skriv namnet på ämnet.')
    if (weeks.length === 0) return fail('weeks', 'Välj minst en vecka.')
    const id = subjectId === NEW ? (await addSubject(newName)).id : subjectId
    await saveLesson({
      id: lesson?.id ?? newId(),
      subjectId: id,
      weekday,
      start,
      end,
      room: room.trim(),
      teacher: teacher.trim(),
      weeks: weeks.length === cycleLength ? null : [...weeks].sort(),
    })
    onClose()
  }

  async function remove() {
    if (!lesson) return
    await undoable('Lektionen är borttagen', ['lessons'], () => deleteLesson(lesson.id))
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={lesson ? 'Ändra lektion' : 'Ny lektion'}>
        <h1>{lesson ? 'Ändra lektion' : 'Ny lektion'}</h1>

        <label className="field">
          <span>Ämne</span>
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); touch('subject') }}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            <option value={NEW}>Nytt ämne…</option>
          </select>
        </label>
        {subjectId === NEW && (
          <label className="field">
            <span>Namn på nytt ämne</span>
            <input type="text" value={newName} onChange={(e) => { setNewName(e.target.value); touch('subject') }} autoFocus />
          </label>
        )}

        <label className="field">
          <span>Dag</span>
          <select value={weekday} onChange={(e) => { setWeekday(Number(e.target.value)) }}>
            {WEEKDAYS_LONG.map((d, i) => <option key={d} value={i + 1}>{d[0].toUpperCase() + d.slice(1)}</option>)}
          </select>
        </label>

        <div className="two">
          <label className="field"><span>Start</span><input type="time" value={start} onChange={(e) => { setStart(e.target.value); touch('time') }} required /></label>
          <label className="field"><span>Slut</span><input type="time" value={end} onChange={(e) => { setEnd(e.target.value); touch('time') }} required /></label>
        </div>
        <div className="two">
          <label className="field"><span>Sal</span><input type="text" value={room} onChange={(e) => setRoom(e.target.value)} /></label>
          <label className="field"><span>Lärare</span><input type="text" value={teacher} onChange={(e) => setTeacher(e.target.value)} /></label>
        </div>

        {cycleLength > 1 && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Veckor</legend>
            <div className="checks">
              {Array.from({ length: cycleLength }, (_, i) => (
                <label key={i}>
                  <input
                    type="checkbox"
                    checked={weeks.includes(i)}
                    onChange={(e) => { setWeeks(e.target.checked ? [...weeks, i] : weeks.filter((w) => w !== i)); touch('weeks') }}
                  />
                  Vecka {cycleLabel(i)}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {conflicts.length > 0 && (
          <div className="warning" role="alert">
            {conflicts.map((c) => (
              <p key={c.id}>Krockar med {subjectName(c.subjectId)} {c.start}–{c.end}</p>
            ))}
            <p>Du kan spara ändå, eller ändra tid eller dag.</p>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">{conflicts.length > 0 ? 'Spara ändå' : 'Spara'}</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {lesson && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
