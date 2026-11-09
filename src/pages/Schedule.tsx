import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LessonCard } from '../components/LessonCard'
import { LessonForm } from '../components/LessonForm'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, toISODate, weekdayOf } from '../domain/dates'
import { findConflicts, lessonsOnWeek } from '../domain/schedule'
import type { Lesson } from '../domain/types'
import { cycleLabel, weekIndex } from '../domain/weekCycle'
import { useLessons, useNow, useSettings, useSubjects } from '../hooks'

export function SchedulePage() {
  const settings = useSettings()
  const lessons = useLessons()
  const subjects = useSubjects()
  const now = useNow()
  const todayIso = toISODate(now)
  const todayWd = weekdayOf(todayIso)

  const [day, setDay] = useState(todayWd)
  const [weekPick, setWeekPick] = useState<number | null>(null)
  const [editing, setEditing] = useState<Lesson | 'new' | null>(null)

  if (!settings || !lessons || !subjects) return null
  const { cycleLength, cycleAnchor } = settings
  const currentWeek = weekIndex(todayIso, cycleAnchor, cycleLength)
  const week = Math.min(weekPick ?? currentWeek, cycleLength - 1)
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const dayLessons = lessonsOnWeek(day, week, lessons)

  return (
    <>
      <h1>Schema</h1>

      {cycleLength > 1 && (
        <div className="seg" role="group" aria-label="Vecka">
          {Array.from({ length: cycleLength }, (_, i) => (
            <button key={i} type="button" className="tab" aria-pressed={week === i} onClick={() => setWeekPick(i)}>
              Vecka {cycleLabel(i)}{i === currentWeek ? ' (nu)' : ''}
            </button>
          ))}
        </div>
      )}

      <div className="tabs" role="group" aria-label="Veckodag">
        {WEEKDAYS_SHORT.map((name, i) => (
          <button
            key={name}
            type="button"
            className={`tab${i + 1 === todayWd && week === currentWeek ? ' today' : ''}`}
            aria-pressed={day === i + 1}
            onClick={() => setDay(i + 1)}
          >
            {name}
          </button>
        ))}
      </div>

      {dayLessons.length === 0 ? (
        <p className="empty">Inga lektioner på {WEEKDAYS_LONG[day - 1]}.</p>
      ) : (
        dayLessons.map((l) => (
          <LessonCard key={l.id} lesson={l} subject={subjectById.get(l.subjectId)} conflict={findConflicts(l, dayLessons, cycleLength).length > 0} onClick={() => setEditing(l)} />
        ))
      )}

      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Lägg till lektion</button>
      </div>

      <div className="actions">
        <Link to="/schema/importera" className="btn">Importera från bild</Link>
        <Link to="/amnen" className="btn">Ämnen och packlistor</Link>
      </div>

      {editing && (
        <LessonForm
          key={editing === 'new' ? 'new' : editing.id}
          lesson={editing === 'new' ? null : editing}
          defaultWeekday={day}
          subjects={subjects}
          lessons={lessons}
          cycleLength={cycleLength}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
