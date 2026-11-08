import { useState } from 'react'
import { EventCard } from '../components/EventCard'
import { EventForm } from '../components/EventForm'
import { TaskForm } from '../components/TaskForm'
import { TaskRow } from '../components/TaskRow'
import { tasksOn } from '../domain/tasks'
import { LessonCard } from '../components/LessonCard'
import { dayLabel, eventsOn, monthGrid, monthLabel, weekDays } from '../domain/calendar'
import { WEEKDAYS_SHORT, addDays, isoWeek, parseISODate, toISODate, weekdayOf } from '../domain/dates'
import { lessonsOn } from '../domain/schedule'
import type { CalendarEvent, Task } from '../domain/types'
import { cycleLabel, weekIndex } from '../domain/weekCycle'
import { useEvents, useLessons, useNow, useSettings, useSubjects, useTasks } from '../hooks'

type View = 'month' | 'week'

export function CalendarPage() {
  const settings = useSettings()
  const events = useEvents()
  const tasks = useTasks()
  const lessons = useLessons()
  const subjects = useSubjects()
  const today = toISODate(useNow())

  const [view, setView] = useState<View>('month')
  const [focus, setFocus] = useState(today) // datum som vyn är centrerad på
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  if (!settings || !events || !lessons || !subjects || !tasks) return null
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const f = parseISODate(focus)

  /** På söndagar är veckan i princip slut, så veckovyn öppnas på kommande vecka. */
  function showView(next: View) {
    setView(next)
    if (next === 'week' && focus === today && weekdayOf(today) === 7) setFocus(addDays(today, 1))
  }

  function step(dir: -1 | 1) {
    if (view === 'week') return setFocus(addDays(focus, 7 * dir))
    const d = new Date(f.getFullYear(), f.getMonth() + dir, 1)
    // behåll samma dag i månaden om den finns, annars månadens sista
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    setFocus(toISODate(new Date(d.getFullYear(), d.getMonth(), Math.min(f.getDate(), last))))
  }

  const week = weekDays(focus)
  const title =
    view === 'month'
      ? monthLabel(f.getFullYear(), f.getMonth())
      : `Vecka ${isoWeek(focus)}${settings.cycleLength > 1 ? ` · ${cycleLabel(weekIndex(focus, settings.cycleAnchor, settings.cycleLength))}` : ''}`

  const dayContent = (date: string) => (
    <>
      {lessonsOn(date, lessons, settings).map((l) => (
        <LessonCard key={l.id} lesson={l} subject={subjectById.get(l.subjectId)} />
      ))}
      {eventsOn(date, events).map((e) => <EventCard key={e.id} event={e} onClick={() => setEditing(e)} />)}
      {tasksOn(date, tasks).map((t) => (
        <TaskRow key={t.id} task={t} subject={subjectById.get(t.subjectId ?? '')} today={today} showDeadline={false} onEdit={() => setEditingTask(t)} />
      ))}
    </>
  )
  const isEmpty = (date: string) =>
    lessonsOn(date, lessons, settings).length === 0 && eventsOn(date, events).length === 0 && tasksOn(date, tasks).length === 0

  return (
    <>
      <h1>Kalender</h1>

      <div className="cal-head">
        <button type="button" className="btn" onClick={() => setFocus(today)}>Idag</button>
        <button type="button" className="btn" aria-label={view === 'month' ? 'Föregående månad' : 'Föregående vecka'} onClick={() => step(-1)}>‹</button>
        <button type="button" className="btn" aria-label={view === 'month' ? 'Nästa månad' : 'Nästa vecka'} onClick={() => step(1)}>›</button>
        <span className="cal-title" aria-live="polite">{title}</span>
      </div>

      <div className="seg" role="group" aria-label="Vy">
        <button type="button" className="tab" aria-pressed={view === 'month'} onClick={() => showView('month')}>Månad</button>
        <button type="button" className="tab" aria-pressed={view === 'week'} onClick={() => showView('week')}>Vecka</button>
      </div>

      {view === 'month' ? (
        <>
          <div className="month" role="grid" aria-label={title}>
            <div className="month-row head" role="row">
              {WEEKDAYS_SHORT.map((d) => <span key={d} role="columnheader">{d[0]}</span>)}
            </div>
            {monthGrid(f.getFullYear(), f.getMonth()).map((w) => (
              <div className="month-row" role="row" key={w[0]}>
                {w.map((date) => {
                  const n = eventsOn(date, events).length
                  const openTasks = tasksOn(date, tasks).filter((t) => !t.done).length
                  const hasLessons = lessonsOn(date, lessons, settings).length > 0
                  const other = parseISODate(date).getMonth() !== f.getMonth()
                  return (
                    <button
                      key={date}
                      type="button"
                      role="gridcell"
                      className={`day${other ? ' other' : ''}${date === today ? ' today' : ''}`}
                      aria-pressed={date === focus}
                      aria-label={`${dayLabel(date)}${hasLessons ? ', lektioner' : ''}${openTasks ? `, ${openTasks} uppgift${openTasks > 1 ? 'er' : ''}` : ''}${n ? `, ${n} händelse${n > 1 ? 'r' : ''}` : ''}`}
                      onClick={() => setFocus(date)}
                    >
                      <span className="num">{parseISODate(date).getDate()}</span>
                      <span className="dots" aria-hidden="true">
                        {hasLessons && <i className="lesson" />}
                        {openTasks > 0 && <i className="task" />}
                        {Array.from({ length: Math.min(n, 3) }, (_, i) => <i key={i} />)}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <h2>{dayLabel(focus)}</h2>
          {isEmpty(focus) ? <p className="empty">Inget inplanerat.</p> : dayContent(focus)}
        </>
      ) : (
        week.map((date) => (
          <section key={date} aria-label={dayLabel(date)}>
            <h2 className={date === today ? 'today-h' : ''}>{dayLabel(date)}</h2>
            {isEmpty(date) ? <p className="sub">Inget inplanerat.</p> : dayContent(date)}
          </section>
        ))
      )}

      <div className="actions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>Ny händelse</button>
      </div>

      {editingTask && (
        <TaskForm key={editingTask.id} task={editingTask} defaultDeadline={focus} subjects={subjects} onClose={() => setEditingTask(null)} />
      )}
      {editing && (
        <EventForm
          key={editing === 'new' ? 'new' : editing.id}
          event={editing === 'new' ? null : editing}
          defaultDate={focus}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}
