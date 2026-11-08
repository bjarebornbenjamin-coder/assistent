import { Link } from 'react-router-dom'
import { EventCard } from '../components/EventCard'
import { LessonCard } from '../components/LessonCard'
import { upcomingEvents } from '../domain/calendar'
import { WEEKDAYS_LONG, addDays, toISODate, weekdayOf } from '../domain/dates'
import { setPackChecked } from '../db/repo'
import { itemKey, packingTarget } from '../domain/packing'
import { describeNext, lessonsOn, nextLesson } from '../domain/schedule'
import { useEvents, useLessons, usePackChecks, useNow, useSettings, useSubjects } from '../hooks'

function dayName(date: string, today: string): string {
  if (date === today) return 'idag'
  if (date === addDays(today, 1)) return 'imorgon'
  return WEEKDAYS_LONG[weekdayOf(date) - 1]
}

export function Home() {
  const settings = useSettings()
  const lessons = useLessons()
  const subjects = useSubjects()
  const events = useEvents()
  const now = useNow()
  const packing0 = settings && lessons && subjects ? packingTarget(now, lessons, subjects, settings) : null
  const checks = usePackChecks(packing0?.date)
  if (!settings || !lessons || !subjects || !events) return null

  const today = toISODate(now)
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const todays = lessonsOn(today, lessons, settings)
  const next = nextLesson(now, lessons, settings)
  const packing = packingTarget(now, lessons, subjects, settings)

  const upcoming = upcomingEvents(now, events)

  if (lessons.length === 0 && events.length === 0) {
    return (
      <>
        <h1>Hem</h1>
        <p className="empty">
          Du har inget schema än. <Link to="/schema">Lägg in din första lektion</Link>.
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Hem</h1>

      <h2>Nästa lektion</h2>
      {next ? (
        <>
          <LessonCard lesson={next.lesson} subject={subjectById.get(next.lesson.subjectId)} highlight={next.ongoing} />
          <p className="next-note">{describeNext(now, next)}</p>
        </>
      ) : (
        <p className="empty">Inga kommande lektioner de närmaste två veckorna.</p>
      )}

      <h2>Idag</h2>
      {todays.length === 0 ? (
        <p className="empty">Inga lektioner idag.</p>
      ) : (
        todays.map((l) => <LessonCard key={l.id} lesson={l} subject={subjectById.get(l.subjectId)} />)
      )}

      <h2>Ta med {packing ? dayName(packing.date, today) : ''}</h2>
      {!packing ? (
        <p className="empty">Inga kommande lektioner.</p>
      ) : packing.groups.length === 0 ? (
        <p className="empty">
          Inga packlistor för {dayName(packing.date, today)}s ämnen. <Link to="/amnen">Skriv en</Link>.
        </p>
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

      <h2>Kommande</h2>
      {upcoming.length === 0 ? (
        <p className="empty">Inga händelser de närmaste sju dagarna.</p>
      ) : (
        upcoming.map((e) => (
          <div key={e.id}>
            <p className="sub" style={{ margin: '8px 0 4px', textTransform: 'capitalize' }}>{dayName(e.date, today)}</p>
            <EventCard event={e} />
          </div>
        ))
      )}
    </>
  )
}
