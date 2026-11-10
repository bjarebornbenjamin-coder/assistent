import { useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TaskForm } from '../components/TaskForm'
import { LessonCard } from '../components/LessonCard'
import { eventTime, upcomingEvents } from '../domain/calendar'
import { dayTimeline, share, sv1 } from '../domain/dashboard'
import { expiringWithin } from '../domain/food'
import { remainingToday } from '../domain/reminders'
import { isOverdue, upcomingTasks } from '../domain/tasks'
import { goalKcal, mealsOn, totalsOf } from '../domain/nutrition'
import type { Task } from '../domain/types'
import { addDays, parseISODate, toHHmm, toISODate } from '../domain/dates'
import { setPackChecked } from '../db/repo'
import { itemKey, packingTarget } from '../domain/packing'
import { describeNext, lessonsOn, nextLesson, relativeDay } from '../domain/schedule'
import { useEvents, useLessons, useMeals, usePackChecks, usePantry, useReminders, useTasks, useWater, useWorkouts, useNow, useSettings, useSubjects } from '../hooks'
import { unloggedPlanned, weeklyCounts } from '../domain/workouts'

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
      <Link to="/installningar" className="icon-btn" aria-label="Inställningar" title="Inställningar">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>
    </div>
  )
}

function Tile({ to, label, value, sub, bar, tone }: { to: string; label: string; value: ReactNode; sub?: string; bar?: number; tone?: 'warn' | 'ok' }) {
  return (
    <Link to={to} className={`tile${tone ? ` ${tone}` : ''}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {bar !== undefined && (
        <span className="tile-bar" aria-hidden="true"><span style={{ transform: `scaleX(${bar})` }} /></span>
      )}
      {sub && <span className="tile-sub">{sub}</span>}
    </Link>
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
  const workouts = useWorkouts()
  const pantry = usePantry()
  const [editingTask, setEditingTask] = useState<Task | 'new' | null>(null)
  const now = useNow()
  const packing0 = settings && lessons && subjects && events ? packingTarget(now, lessons, subjects, settings, events) : null
  const checks = usePackChecks(packing0?.date)
  if (!settings || !lessons || !subjects || !events || !tasks || !reminders || !meals || !water || !workouts || !pantry) return null

  const today = toISODate(now)
  const nowTime = toHHmm(now)
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const todays = lessonsOn(today, lessons, settings)
  const next = nextLesson(now, lessons, settings)
  const packing = packingTarget(now, lessons, subjects, settings, events)
  const timeline = dayTimeline(today, nowTime, { lessons, events, tasks, reminders, subjects, settings })
  const schoolOver = todays.length > 0 && todays.every((l) => l.end <= nowTime)

  if (lessons.length === 0 && events.length === 0 && tasks.length === 0 && reminders.length === 0) {
    return (
      <>
        <HomeHeader />
        <p className="empty">Du har inget schema än.</p>
        <div className="actions"><Link to="/schema" className="btn primary">Lägg in din första lektion</Link></div>
      </>
    )
  }

  // Siffror till rutorna
  const open = upcomingTasks(now, tasks)
  const overdue = open.filter((t) => isOverdue(t, today))
  const dueToday = open.filter((t) => t.deadline === today)
  const eaten = totalsOf(mealsOn(today, meals))
  const goals = settings.nutrition
  const ml = water.find((w) => w.date === today)?.ml ?? 0
  const week = weeklyCounts(workouts, today, 1)[0]
  const toLog = unloggedPlanned(events, workouts, addDays(today, -2), today).length
  const expiring = expiringWithin(pantry, today)
  const nextReminder = remainingToday(now, reminders)[0]
  const coming = [
    ...upcomingEvents(now, events).filter((e) => e.date > today).map((e) => ({ key: e.id, date: e.date, time: eventTime(e), title: e.title, kind: 'Händelse' })),
    ...tasks.filter((t) => !t.done && t.deadline > today && t.deadline <= addDays(today, 7)).map((t) => ({ key: t.id, date: t.deadline, time: t.time ? `Inne ${t.time}` : 'Ska in', title: t.title, kind: subjectById.get(t.subjectId ?? '')?.name ?? 'Uppgift' })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  return (
    <>
      <HomeHeader />

      <section aria-label="Nästa lektion" className="dash-hero">
        {next ? (
          <>
            <LessonCard lesson={next.lesson} subject={subjectById.get(next.lesson.subjectId)} highlight={next.ongoing} size="large" />
            <p className="next-note">{schoolOver ? 'Skolan är slut för idag. ' : ''}{capitalize(describeNext(now, next).replace(/^Nästa lektion /, ''))}</p>
          </>
        ) : (
          <p className="empty">Inga kommande lektioner de närmaste två veckorna.</p>
        )}
      </section>

      <div className="tiles">
        <Tile
          to="/uppgifter"
          label="Uppgifter"
          value={open.length}
          sub={overdue.length ? `${overdue.length} försenad${overdue.length > 1 ? 'e' : ''}` : dueToday.length ? `${dueToday.length} ska in idag` : 'närmaste 7 dagarna'}
          tone={overdue.length ? 'warn' : undefined}
        />
        <Tile to="/mat?v=kost" label="Kalorier" value={<>{eaten.kcal}<small> / {goalKcal(goals)}</small></>} bar={share(eaten.kcal, goalKcal(goals))} sub={`protein ${sv1(eaten.protein)} / ${goals.proteinG} g`} />
        <Tile to="/mat?v=kost" label="Vatten" value={<>{sv1(ml / 1000)}<small> / {sv1(goals.waterMl / 1000)} l</small></>} bar={share(ml, goals.waterMl)} />
        <Tile to="/traning" label="Träning" value={<>{week.count}<small> pass</small></>} sub={toLog ? `${toLog} att logga` : week.minutes ? `${week.minutes} min den här veckan` : 'den här veckan'} />
        <Tile to="/mat" label="Matlager" value={expiring.length} sub={expiring.length ? `går ut snart: ${expiring.slice(0, 2).map((p) => p.name.toLowerCase()).join(', ')}` : 'inget går ut snart'} tone={expiring.length ? 'warn' : undefined} />
        <Tile to="/paminnelser" label="Påminnelse" value={nextReminder ? nextReminder.time : '–'} sub={nextReminder ? nextReminder.title : 'inga fler idag'} />
      </div>

      <h2>Idag</h2>
      {timeline.length === 0 ? (
        <p className="empty">Inget inplanerat idag.</p>
      ) : (
        <ol className="timeline">
          {timeline.map((i) => {
            const style = i.color ? ({ '--subject': i.color } as CSSProperties) : undefined
            const body = (
              <>
                <span className="tl-time">{i.timeLabel}</span>
                <span className="tl-main">
                  <span className="title">{i.title}</span>
                  {i.sub && <span className="sub">{i.sub}</span>}
                </span>
                {i.ongoing && <span className="tl-now">Nu</span>}
              </>
            )
            return (
              <li key={i.key} className={`tl-${i.kind}${i.past ? ' past' : ''}${i.ongoing ? ' ongoing' : ''}${i.color ? ' colored' : ''}`} style={style}>
                {i.task ? <button type="button" className="tl-row" onClick={() => setEditingTask(i.task!)}>{body}</button> : <div className="tl-row">{body}</div>}
              </li>
            )
          })}
        </ol>
      )}
      <div className="actions">
        <button type="button" className="btn" onClick={() => setEditingTask('new')}>Ny uppgift</button>
        <Link to="/kalender" className="btn">Kalender</Link>
      </div>

      <h2>Ta med {packing ? dayName(packing.date, today) : ''}</h2>
      {!packing ? (
        <p className="empty">Inget att packa de närmaste två veckorna.</p>
      ) : packing.groups.length === 0 && packing.events.length === 0 ? (
        <>
          <p className="empty">Inga packlistor för {dayName(packing.date, today)}s ämnen.</p>
          <div className="actions" style={{ marginTop: 0 }}><Link to="/amnen" className="btn">Skriv packlistor</Link></div>
        </>
      ) : (
        <div className="card pack">
          {[...packing.groups.map((g) => ({ key: g.subject.id, title: g.subject.name, items: g.items.map((x) => x.text) })), ...packing.events.map((g) => ({ key: g.event.id, title: `${g.event.title}${g.event.start ? ` ${g.event.start}` : ''}`, items: g.items }))].map((g) => (
            <div key={g.key}>
              <h3>{g.title}</h3>
              <ul className="checklist">
                {g.items.map((text) => {
                  const key = itemKey(text)
                  const done = checks?.has(key) ?? false
                  return (
                    <li key={key}>
                      <label className={done ? 'done' : ''}>
                        <input type="checkbox" checked={done} onChange={(e) => setPackChecked(packing.date, key, e.target.checked)} />
                        {text}
                      </label>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <h2>Kommande veckan</h2>
      {coming.length === 0 ? (
        <p className="empty">Inga händelser eller uppgifter de närmaste sju dagarna.</p>
      ) : (
        <ul className="coming">
          {coming.slice(0, 8).map((c) => (
            <li key={c.key}>
              <span className="c-day">{c.date === addDays(today, 1) ? 'Imorgon' : capitalize(parseISODate(c.date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
              <span className="c-main"><span className="title">{c.title}</span><span className="sub">{c.kind} · {c.time}</span></span>
            </li>
          ))}
        </ul>
      )}

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
