import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EventCard } from '../components/EventCard'
import { TaskForm } from '../components/TaskForm'
import { TaskRow } from '../components/TaskRow'
import { LessonCard } from '../components/LessonCard'
import { upcomingEvents } from '../domain/calendar'
import { remainingToday } from '../domain/reminders'
import { upcomingTasks } from '../domain/tasks'
import { mealsOn, totalsOf } from '../domain/nutrition'
import type { Task } from '../domain/types'
import { toHHmm, toISODate } from '../domain/dates'
import { setPackChecked } from '../db/repo'
import { itemKey, packingTarget } from '../domain/packing'
import { describeNext, findConflicts, lessonsOn, nextLesson, relativeDay } from '../domain/schedule'
import { useEvents, useLessons, useMeals, usePackChecks, useReminders, useTasks, useWater, useNow, useSettings, useSubjects } from '../hooks'

function dayName(date: string, today: string): string {
  return relativeDay(date, today).replace(/^på /, '')
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function HomeHeader() {
  const today = new Date()
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{today.toLocaleDateString('sv-SE', { weekday: 'long' })}</div>
        <h1>{today.toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' })}</h1>
      </div>
      <Link to="/installningar" className="btn text">Inställningar</Link>
    </div>
  )
}

export function Home() {
  const settings = useSettings()
  const lessons = useLessons()
  const subjects = useSubjects()
  const events = useEvents()
  const tasks = useTasks()
  const reminders = useReminders()
  const meals = useMeals()
  const water = useWater()
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const now = useNow()
  const packing0 = settings && lessons && subjects ? packingTarget(now, lessons, subjects, settings) : null
  const checks = usePackChecks(packing0?.date)
  if (!settings || !lessons || !subjects || !events || !tasks || !reminders || !meals || !water) return null

  const today = toISODate(now)
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const todays = lessonsOn(today, lessons, settings)
  const next = nextLesson(now, lessons, settings)
  const packing = packingTarget(now, lessons, subjects, settings)

  const upcoming = upcomingEvents(now, events)
  const dueTasks = upcomingTasks(now, tasks)
  const todayReminders = remainingToday(now, reminders)

  if (lessons.length === 0 && events.length === 0 && tasks.length === 0 && reminders.length === 0) {
    return (
      <>
        <HomeHeader />
        <p className="empty">
          Du har inget schema än.
        </p>
        <div className="actions"><Link to="/schema" className="btn primary">Lägg in din första lektion</Link></div>
      </>
    )
  }

  return (
    <>
      <HomeHeader />

      <h2>Nästa lektion</h2>
      {next ? (
        <>
          <LessonCard lesson={next.lesson} subject={subjectById.get(next.lesson.subjectId)} highlight={next.ongoing} size="large" />
          <p className="next-note">{capitalize(describeNext(now, next).replace(/^Nästa lektion /, ''))}</p>
        </>
      ) : (
        <p className="empty">Inga kommande lektioner de närmaste två veckorna.</p>
      )}

      <h2>Dagens lektioner</h2>
      {todays.length === 0 ? (
        <p className="empty">Inga lektioner idag.</p>
      ) : (
        todays.map((l) => (
          <LessonCard
            key={l.id}
            lesson={l}
            subject={subjectById.get(l.subjectId)}
            past={l.end <= toHHmm(now)}
            conflict={findConflicts(l, todays, 1).length > 0}
          />
        ))
      )}

      <h2>Ta med {packing ? dayName(packing.date, today) : ''}</h2>
      {!packing ? (
        <p className="empty">Inga kommande lektioner.</p>
      ) : packing.groups.length === 0 ? (
        <>
          <p className="empty">Inga packlistor för {dayName(packing.date, today)}s ämnen.</p>
          <div className="actions" style={{ marginTop: 0 }}><Link to="/amnen" className="btn">Skriv packlistor</Link></div>
        </>
      ) : (
        <div className="card pack">
          {packing.groups.map((g) => (
            <div key={g.subject.id}>
              <h3>{g.subject.name}</h3>
              <ul className="checklist">
                {g.items.map((i) => {
                  const key = itemKey(i.text)
                  const done = checks?.has(key) ?? false
                  return (
                    <li key={i.id}>
                      <label className={done ? 'done' : ''}>
                        <input type="checkbox" checked={done} onChange={(e) => setPackChecked(packing.date, key, e.target.checked)} />
                        {i.text}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2>Händelser närmaste veckan</h2>
      {upcoming.length === 0 ? (
        <p className="empty">Inga händelser de närmaste sju dagarna.</p>
      ) : (
        upcoming.map((e) => (
          <div key={e.id}>
            <p className="sub" style={{ margin: '8px 0 4px' }}>{capitalize(dayName(e.date, today))}</p>
            <EventCard event={e} />
          </div>
        ))
      )}

      <h2>Uppgifter som ska in snart</h2>
      {dueTasks.length === 0 ? (
        <p className="empty">Inga uppgifter de närmaste sju dagarna.</p>
      ) : (
        dueTasks.map((t) => (
          <TaskRow key={t.id} task={t} subject={subjectById.get(t.subjectId ?? '')} today={today} onEdit={() => setEditingTask(t)} />
        ))
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={() => setEditingTask('new')}>Ny uppgift</button>
        <Link to="/uppgifter" className="btn">Alla uppgifter</Link>
      </div>

      <h2>Mat och vatten idag</h2>
      {(() => {
        const t = totalsOf(mealsOn(today, meals))
        const ml = water.find((w) => w.date === today)?.ml ?? 0
        const g = settings.nutrition
        const n = (v: number) => v.toLocaleString('sv-SE', { maximumFractionDigits: 1 })
        return (
          <Link to="/mat?v=kost" className="card kost-row">
            <span><strong>{t.kcal}</strong> kcal</span>
            <span>protein <strong>{n(t.protein)}</strong>/{g.proteinG} g</span>
            <span>vatten <strong>{n(ml / 1000)}</strong>/{n(g.waterMl / 1000)} l</span>
          </Link>
        )
      })()}

      <h2>Påminnelser idag</h2>
      {todayReminders.length === 0 ? (
        <p className="empty">Inga fler påminnelser idag.</p>
      ) : (
        todayReminders.map((r) => (
          <div key={r.id} className="card">
            <div className="row">
              <span className="time" style={{ minWidth: '3.5em' }}>{r.time}</span>
              <span className="title">{r.title}</span>
            </div>
          </div>
        ))
      )}
      <div className="actions">
        <Link to="/paminnelser" className="btn">Alla påminnelser</Link>
      </div>
      {editingTask && (
        <TaskForm
          key={editingTask === 'new' ? 'new' : editingTask.id}
          task={editingTask === 'new' ? null : editingTask}
          defaultDeadline={today}
          subjects={subjects}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  )
}
