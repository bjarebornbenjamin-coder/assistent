import { useState, type ReactNode } from 'react'
import { EventCard } from '../components/EventCard'
import { EventForm } from '../components/EventForm'
import { TaskForm } from '../components/TaskForm'
import { TaskRow } from '../components/TaskRow'
import { tasksOn } from '../domain/tasks'
import { LessonCard } from '../components/LessonCard'
import { agenda, dayLabel, eventsOn, monthGrid, monthLabel, weekDays, type AgendaItem } from '../domain/calendar'
import { WEEKDAYS_SHORT, addDays, isoWeek, parseISODate, toISODate, weekdayOf } from '../domain/dates'
import { lessonsOn } from '../domain/schedule'
import type { CalendarEvent, Task } from '../domain/types'
import { cycleLabel, weekIndex } from '../domain/weekCycle'
import { useEvents, useLessons, useNow, useSettings, useSubjects, useTasks } from '../hooks'

type View = 'month' | 'week' | 'list'

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
  const [query, setQuery] = useState('')

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

      {view !== 'list' && (
      <div className="cal-head">
        <button type="button" className="btn" onClick={() => setFocus(today)}>Idag</button>
        <button type="button" className="btn" aria-label={view === 'month' ? 'Föregående månad' : 'Föregående vecka'} onClick={() => step(-1)}>‹</button>
        <button type="button" className="btn" aria-label={view === 'month' ? 'Nästa månad' : 'Nästa vecka'} onClick={() => step(1)}>›</button>
        <span className="cal-title" aria-live="polite">{title}</span>
      </div>
      )}

      <div className="seg" role="group" aria-label="Vy">
        <button type="button" className="tab" aria-pressed={view === 'month'} onClick={() => showView('month')}>Månad</button>
        <button type="button" className="tab" aria-pressed={view === 'week'} onClick={() => showView('week')}>Vecka</button>
        <button type="button" className="tab" aria-pressed={view === 'list'} onClick={() => showView('list')}>Lista</button>
      </div>

      {view === 'list' ? (
        <AgendaList
          query={query}
          onQuery={setQuery}
          items={agenda(query, events, tasks, today, { subjectName: (id) => subjectById.get(id ?? '')?.name })}
          today={today}
          renderItem={(i) =>
            i.kind === 'event' ? (
              <EventCard key={i.event.id} event={i.event} onClick={() => setEditing(i.event)} />
            ) : (
              <TaskRow key={i.task.id} task={i.task} subject={subjectById.get(i.task.subjectId ?? '')} today={today} showDeadline={false} onEdit={() => setEditingTask(i.task)} />
            )
          }
        />
      ) : view === 'month' ? (
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

function AgendaList({ query, onQuery, items, today, renderItem }: { query: string; onQuery: (q: string) => void; items: AgendaItem[]; today: string; renderItem: (i: AgendaItem) => ReactNode }) {
  const year = today.slice(0, 4)
  const label = (date: string) => `${dayLabel(date)}${date.slice(0, 4) !== year ? ` ${date.slice(0, 4)}` : ''}`
  const groups: { date: string; items: AgendaItem[]; pastStart: boolean }[] = []
  for (const i of items) {
    const last = groups[groups.length - 1]
    if (last && last.date === i.date) last.items.push(i)
    else groups.push({ date: i.date, items: [i], pastStart: i.date < today && (!last || last.date >= today) })
  }
  return (
    <>
      <input type="search" className="search" aria-label="Sök i kalendern" placeholder="Sök, t.ex. matteprov" value={query} onChange={(e) => onQuery(e.target.value)} />
      {!query.trim() && <p className="muted">Kommande 60 dagar. Sök för att hitta äldre.</p>}
      {items.length === 0 && <p className="empty">{query.trim() ? `Inget hittades för "${query.trim()}".` : 'Inget inplanerat.'}</p>}
      {groups.map((g) => (
        <section key={g.date} aria-label={label(g.date)}>
          {g.pastStart && <p className="muted section-note">Tidigare</p>}
          <h2 className={g.date === today ? 'today-h' : ''}>{label(g.date)}</h2>
          {g.items.map(renderItem)}
        </section>
      ))}
    </>
  )
}
