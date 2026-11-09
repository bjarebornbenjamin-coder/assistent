import { useState, type FormEvent } from 'react'
import { deleteWorkout, newId, saveWorkout } from '../db/repo'
import { normalizeType } from '../domain/training'
import type { ISODate, Workout } from '../domain/types'
import { lastOfType, pace, setLabel } from '../domain/workouts'
import { useFieldError } from '../hooks'
import { undoable } from '../lib/undo'
import { parseNumber } from './MealForm'

interface Props {
  workout: Workout | null
  /** Förifyllt, t.ex. från ett planerat pass i kalendern. */
  draft?: Pick<Workout, 'date' | 'type' | 'title'> & Partial<Pick<Workout, 'minutes'>>
  date: ISODate
  history: Workout[]
  onClose: () => void
}

interface Row {
  key: string
  name: string
  sets: string
  reps: string
  kg: string
}

const TYPES = [
  { value: 'gym', label: 'Gym' },
  { value: 'löpning', label: 'Löpning' },
  { value: 'annat', label: 'Annat' },
]

const rowOf = (e: Workout['exercises'][number]): Row => ({ key: newId(), name: e.name, sets: String(e.sets), reps: String(e.reps), kg: e.weightKg ? String(e.weightKg).replace('.', ',') : '' })
const emptyRow = (): Row => ({ key: newId(), name: '', sets: '3', reps: '10', kg: '' })

export function WorkoutForm({ workout, draft, date, history, onClose }: Props) {
  const init = workout ?? draft
  const initType = init ? (['gym', 'löpning'].includes(normalizeType(init.type)) ? normalizeType(init.type) : 'annat') : 'gym'
  const [type, setType] = useState(initType)
  const [title, setTitle] = useState(init?.title ?? '')
  const [day, setDay] = useState(init?.date ?? date)
  const [minutes, setMinutes] = useState(init?.minutes ? String(init.minutes) : '')
  const [km, setKm] = useState(workout?.distanceKm ? String(workout.distanceKm).replace('.', ',') : '')
  const [rows, setRows] = useState<Row[]>(workout?.exercises.map(rowOf) ?? [])
  const [note, setNote] = useState(workout?.note ?? '')
  const { error, fail, touch } = useFieldError()

  const previous = lastOfType('gym', history.filter((w) => w.id !== workout?.id))
  const m = parseNumber(minutes, undefined)
  const d = parseNumber(km, undefined)
  const livePace = typeof m === 'number' && typeof d === 'number' ? pace(m, d) : null
  const setRow = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (m === null || (m !== undefined && (m < 1 || m > 600))) return fail('minutes', 'Ange minuter som ett tal, t.ex. 45.')
    if (d === null) return fail('km', 'Ange distansen som ett tal, t.ex. 5,2.')
    const exercises: Workout['exercises'] = []
    for (const r of type === 'gym' ? rows : []) {
      if (!r.name.trim()) continue
      const sets = parseNumber(r.sets, undefined)
      const reps = parseNumber(r.reps, undefined)
      const kg = parseNumber(r.kg, undefined)
      if (!sets || !reps || kg === null) return fail('rows', `Fyll i set och reps som tal för "${r.name.trim()}".`)
      exercises.push({ name: r.name.trim(), sets: Math.round(sets), reps: Math.round(reps), ...(kg ? { weightKg: kg } : {}) })
    }
    const label = TYPES.find((t) => t.value === type)!.label
    await saveWorkout({
      id: workout?.id ?? newId(),
      date: day,
      type,
      title: title.trim() || label,
      ...(m ? { minutes: Math.round(m) } : {}),
      ...(d && type !== 'gym' ? { distanceKm: Math.round(d * 100) / 100 } : {}),
      exercises,
      note: note.trim(),
      updatedAt: '',
    })
    onClose()
  }

  async function remove() {
    if (!workout) return
    await undoable('Passet är borttaget', ['workouts'], () => deleteWorkout(workout.id))
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={workout ? 'Ändra pass' : 'Logga pass'}>
        <h1>{workout ? 'Ändra pass' : 'Logga pass'}</h1>
        <div className="seg" role="group" aria-label="Sort">
          {TYPES.map((t) => (
            <button key={t.value} type="button" className="tab" aria-pressed={type === t.value} onClick={() => setType(t.value)}>{t.label}</button>
          ))}
        </div>
        <label className="field">
          <span>Namn (valfritt)</span>
          <input type="text" value={title} placeholder={type === 'gym' ? 't.ex. Gym ben' : type === 'löpning' ? 't.ex. Intervaller' : 't.ex. Fotboll'} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="two">
          <label className="field">
            <span>Datum</span>
            <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
          <label className="field">
            <span>Minuter</span>
            <input type="text" inputMode="numeric" value={minutes} onChange={(e) => { setMinutes(e.target.value); touch('minutes') }} />
          </label>
        </div>
        {type !== 'gym' && (
          <label className="field">
            <span>Distans i km (valfritt){livePace ? ` · ${livePace}` : ''}</span>
            <input type="text" inputMode="decimal" value={km} onChange={(e) => { setKm(e.target.value); touch('km') }} />
          </label>
        )}
        {type === 'gym' && (
          <fieldset className="exercises">
            <legend>Övningar</legend>
            {rows.length === 0 && previous && previous.exercises.length > 0 && (
              <button type="button" className="btn" onClick={() => setRows(previous.exercises.map(rowOf))}>
                Samma övningar som förra gympasset ({previous.exercises.length})
              </button>
            )}
            {rows.map((r) => {
              const before = previous?.exercises.find((x) => x.name.trim().toLowerCase() === r.name.trim().toLowerCase())
              return (
                <div key={r.key} className="ex-row">
                  <input type="text" aria-label="Övning" placeholder="Övning" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} />
                  <div className="ex-nums">
                    <label><span>Set</span><input type="text" inputMode="numeric" value={r.sets} onChange={(e) => setRow(r.key, { sets: e.target.value })} /></label>
                    <label><span>Reps</span><input type="text" inputMode="numeric" value={r.reps} onChange={(e) => setRow(r.key, { reps: e.target.value })} /></label>
                    <label><span>Kg</span><input type="text" inputMode="decimal" value={r.kg} onChange={(e) => setRow(r.key, { kg: e.target.value })} /></label>
                    <button type="button" className="btn text" aria-label={`Ta bort ${r.name || 'övningen'}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>Ta bort</button>
                  </div>
                  {before && workout === null && <p className="sub">Förra gången: {setLabel(before)}</p>}
                </div>
              )
            })}
            <button type="button" className="btn" onClick={() => setRows((rs) => [...rs, emptyRow()])}>Lägg till övning</button>
          </fieldset>
        )}
        <label className="field">
          <span>Anteckning (valfritt)</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Spara</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {workout && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
