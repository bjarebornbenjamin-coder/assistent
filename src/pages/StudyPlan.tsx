import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { newId, saveEvent } from '../db/repo'
import { dayLabel } from '../domain/calendar'
import { addDays, toHHmm, toISODate } from '../domain/dates'
import { planStudy, type StudyPlan } from '../domain/study'
import { foodKey } from '../domain/food'
import { useEvents, useFieldError, useLessons, useNow, useSettings } from '../hooks'
import { undoable } from '../lib/undo'

const MINUTES = [30, 45, 60, 90]

export function StudyPlanPage() {
  const settings = useSettings()
  const lessons = useLessons()
  const events = useEvents()
  const now = useNow()
  const today = toISODate(now)
  const navigate = useNavigate()
  const [exam, setExam] = useState('')
  const [date, setDate] = useState(addDays(today, 7))
  const [topics, setTopics] = useState('')
  const [minutes, setMinutes] = useState(45)
  const [count, setCount] = useState(0) // 0 = automatiskt
  const [addExam, setAddExam] = useState(true)
  const [plan, setPlan] = useState<StudyPlan | null>(null)
  const { error, fail, touch } = useFieldError()
  if (!settings || !lessons || !events) return null

  const name = exam.trim()
  const examExists = name !== '' && events.some((e) => e.date === date && foodKey(e.title).includes(foodKey(name)))

  function make(e: FormEvent) {
    e.preventDefault()
    if (!name) return fail('exam', 'Skriv vilket prov det gäller.')
    if (!date || date <= today) return fail('date', 'Välj ett datum efter idag.')
    setPlan(
      planStudy({
        exam: name,
        examDate: date,
        topics: topics.split('\n').map((t) => t.trim()).filter(Boolean),
        from: today,
        nowTime: toHHmm(now),
        ...(count ? { sessions: count } : {}),
        minutes,
        lessons: lessons!,
        events: events!,
        settings: settings!,
      }),
    )
  }

  async function save() {
    if (!plan) return
    const n = plan.sessions.length
    await undoable(`${n} pluggpass inlagda`, ['events'], async () => {
      if (addExam && !examExists) await saveEvent({ id: newId(), title: name, date, note: '', updatedAt: '' })
      for (const s of plan.sessions) await saveEvent({ id: newId(), title: s.title, date: s.date, start: s.start, end: s.end, note: `Inför ${name} ${dayLabel(date)}`, updatedAt: '' })
    })
    navigate('/kalender')
  }

  // Ändrade uppgifter gör planen inaktuell.
  const edit = <T,>(set: (v: T) => void, field?: string) => (v: T) => {
    set(v)
    setPlan(null)
    if (field) touch(field)
  }

  return (
    <>
      <Link to="/kalender" className="back">‹ Tillbaka till Kalender</Link>
      <h1>Plugga inför prov</h1>
      <p className="muted">Pluggpassen sprids ut fram till dagen före provet, på lediga tider efter skolan. Sista passet är repetition.</p>
      <form onSubmit={make}>
        <label className="field">
          <span>Prov</span>
          <input type="text" value={exam} placeholder="t.ex. Matteprov kapitel 3" onChange={(e) => edit(setExam, 'exam')(e.target.value)} />
        </label>
        <label className="field">
          <span>Datum för provet</span>
          <input type="date" value={date} min={addDays(today, 1)} onChange={(e) => edit(setDate, 'date')(e.target.value)} />
        </label>
        <label className="field">
          <span>Vad ingår (ett moment per rad, valfritt)</span>
          <textarea rows={4} value={topics} placeholder={'Derivata\nIntegraler\nGränsvärden'} onChange={(e) => edit(setTopics)(e.target.value)} />
        </label>
        <div className="two">
          <label className="field">
            <span>Minuter per pass</span>
            <select value={minutes} onChange={(e) => edit(setMinutes)(Number(e.target.value))}>
              {MINUTES.map((m) => <option key={m} value={m}>{m} min</option>)}
            </select>
          </label>
          <label className="field">
            <span>Antal pass</span>
            <select value={count} onChange={(e) => edit(setCount)(Number(e.target.value))}>
              <option value={0}>Automatiskt</option>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        {!examExists && name && (
          <div className="checks">
            <label><input type="checkbox" checked={addExam} onChange={(e) => setAddExam(e.target.checked)} /> Lägg in provet i kalendern också</label>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Gör plan</button>
        </div>
      </form>

      {plan && (
        <section aria-label="Förslag">
          <h2>Förslag</h2>
          {plan.warnings.map((w) => <p key={w} className="warning" role="status">{w}</p>)}
          {plan.sessions.map((s) => (
            <div key={s.date} className="card">
              <div className="row">
                <span className="time">{s.start}–{s.end}</span>
                <div>
                  <div className="title">{s.focus}</div>
                  <div className="sub">{dayLabel(s.date)}</div>
                </div>
              </div>
            </div>
          ))}
          {plan.sessions.length > 0 && (
            <div className="actions">
              <button type="button" className="btn primary" onClick={save}>Lägg in {plan.sessions.length} pass i kalendern</button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
