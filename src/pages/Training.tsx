import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Columns } from '../components/charts/Columns'
import { WorkoutForm } from '../components/WorkoutForm'
import { dayLabel } from '../domain/calendar'
import { addDays, isoWeek, toISODate } from '../domain/dates'
import { workoutTypeOf } from '../domain/training'
import type { CalendarEvent, Workout } from '../domain/types'
import { byNewest, exerciseHistory, unloggedPlanned, weeklyCounts, workoutSummary } from '../domain/workouts'
import { useEvents, useNow, useWorkouts } from '../hooks'

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

type Editing = { workout: Workout | null; draft?: Pick<Workout, 'date' | 'type' | 'title'> & Partial<Pick<Workout, 'minutes'>> }

export function TrainingPage() {
  const workouts = useWorkouts()
  const events = useEvents()
  const today = toISODate(useNow())
  const [editing, setEditing] = useState<Editing | null>(null)
  const [showAll, setShowAll] = useState(false)
  if (!workouts || !events) return null

  const sorted = [...workouts].sort(byNewest)
  const planned = unloggedPlanned(events, workouts, addDays(today, -7), today)
  const weeks = weeklyCounts(workouts, today, 8)
  const thisWeek = weeks[weeks.length - 1]
  const history = exerciseHistory(workouts).slice(0, 8)
  const fromEvent = (e: CalendarEvent): Editing => ({
    workout: null,
    draft: { date: e.date, type: workoutTypeOf(e.title) ?? 'annat', title: e.title, ...(e.start && e.end ? { minutes: toMin(e.end) - toMin(e.start) } : {}) },
  })

  return (
    <>
      <Link to="/" className="back">‹ Tillbaka till Hem</Link>
      <h1>Träning</h1>
      <div className="actions" style={{ marginTop: 0, marginBottom: 12 }}>
        <button type="button" className="btn primary" onClick={() => setEditing({ workout: null })}>Logga pass</button>
      </div>

      {planned.length > 0 && (
        <>
          <h2>Planerat att logga</h2>
          {planned.map((e) => (
            <div key={e.id} className="card row-between">
              <div>
                <div className="title">{e.title}</div>
                <div className="sub">{dayLabel(e.date)}{e.start ? ` · ${e.start}` : ''}</div>
              </div>
              <button type="button" className="btn" onClick={() => setEditing(fromEvent(e))}>Logga</button>
            </div>
          ))}
        </>
      )}

      <h2>Den här veckan</h2>
      <p className="stat-line">
        <span><strong>{thisWeek.count}</strong> pass</span>
        <span><strong>{thisWeek.minutes}</strong> min</span>
        {thisWeek.km > 0 && <span><strong>{thisWeek.km.toLocaleString('sv-SE')}</strong> km</span>}
      </p>
      {workouts.length > 0 && (
        <Columns
          title="Träningsminuter per vecka"
          subtitle="Minuter, de senaste 8 veckorna"
          columns={weeks.map((w) => ({
            key: w.monday,
            label: `v${isoWeek(w.monday)}`,
            title: `Vecka ${isoWeek(w.monday)}: ${w.count} pass`,
            segments: [{ id: 'm', label: 'Minuter', color: 'var(--viz-protein)', value: w.minutes }],
          }))}
          format={(v) => `${v} min`}
          formatTick={(v) => String(v)}
          height={150}
        />
      )}

      {history.length > 0 && (
        <>
          <h2>Senaste resultat</h2>
          {history.map((h) => (
            <div key={h.name} className="card row-between">
              <span className="title">{h.name}</span>
              <span className="sub num">{h.label} · {dayLabel(h.date).split(' ').slice(1).join(' ')}</span>
            </div>
          ))}
        </>
      )}

      <h2>Logg</h2>
      {sorted.length === 0 && <p className="empty">Inga pass loggade än. Logga här, eller skriv till chatten, t.ex. "sprang 5 km på 27 min".</p>}
      {(showAll ? sorted : sorted.slice(0, 15)).map((w) => (
        <button key={w.id} type="button" className="card" onClick={() => setEditing({ workout: w })}>
          <div className="title">{w.title}</div>
          <div className="sub">{[dayLabel(w.date), workoutSummary(w)].filter(Boolean).join(' · ')}</div>
        </button>
      ))}
      {!showAll && sorted.length > 15 && (
        <div className="actions"><button type="button" className="btn" onClick={() => setShowAll(true)}>Visa alla ({sorted.length})</button></div>
      )}

      {editing && <WorkoutForm key={editing.workout?.id ?? editing.draft?.date ?? 'new'} workout={editing.workout} draft={editing.draft} date={today} history={workouts} onClose={() => setEditing(null)} />}
    </>
  )
}
