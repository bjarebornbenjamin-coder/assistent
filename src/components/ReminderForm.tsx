import { useState, type FormEvent } from 'react'
import { deleteReminder, newId, saveReminder } from '../db/repo'
import { WEEKDAYS_LONG, WEEKDAYS_SHORT, weekdayOf } from '../domain/dates'
import { useNotifyStatus } from '../push/useNotifyStatus'
import type { ISODate, Reminder } from '../domain/types'
import { useFieldError } from '../hooks'
import { undoable } from '../lib/undo'

type Kind = Reminder['repeat']['kind'] | 'weekly'

interface Props {
  reminder: Reminder | null
  defaultDate: ISODate
  onClose: () => void
}

export function ReminderForm({ reminder, defaultDate, onClose }: Props) {
  const [title, setTitle] = useState(reminder?.title ?? '')
  const [time, setTime] = useState(reminder?.time ?? '08:00')
  const initialKind: Kind = reminder?.repeat.kind === 'weekdays' && reminder.repeat.days.length === 1 ? 'weekly' : reminder?.repeat.kind ?? 'once'
  const [kind, setKind] = useState<Kind>(initialKind)
  const [weekday, setWeekday] = useState<number>(reminder?.repeat.kind === 'weekdays' && reminder.repeat.days.length === 1 ? reminder.repeat.days[0] : weekdayOf(defaultDate))
  const status = useNotifyStatus()
  const [date, setDate] = useState(reminder?.repeat.kind === 'once' ? reminder.repeat.date : defaultDate)
  const [days, setDays] = useState<number[]>(reminder?.repeat.kind === 'weekdays' ? reminder.repeat.days : [1, 2, 3, 4, 5])
  const { error, fail, touch } = useFieldError()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail('title', 'Skriv vad du vill bli påmind om.')
    if (!time) return fail('time', 'Välj en tid.')
    if (kind === 'once' && !date) return fail('date', 'Välj ett datum.')
    if (kind === 'weekdays' && days.length === 0) return fail('days', 'Välj minst en veckodag.')
    await saveReminder({
      id: reminder?.id ?? newId(),
      title: title.trim(),
      time,
      repeat: kind === 'daily' ? { kind: 'daily' } : kind === 'once' ? { kind: 'once', date } : kind === 'weekly' ? { kind: 'weekdays', days: [weekday] } : { kind: 'weekdays', days: [...days].sort() },
      enabled: reminder?.enabled ?? true,
      updatedAt: '',
    })
    onClose()
  }

  async function remove() {
    if (!reminder) return
    await undoable('Påminnelsen är borttagen', ['reminders'], () => deleteReminder(reminder.id))
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={reminder ? 'Ändra påminnelse' : 'Ny påminnelse'}>
        <h1>{reminder ? 'Ändra påminnelse' : 'Ny påminnelse'}</h1>
        <label className="field">
          <span>Påminn mig om</span>
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); touch('title') }} autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
        <label className="field">
          <span>Tid</span>
          <input type="time" value={time} onChange={(e) => { setTime(e.target.value); touch('time') }} required />
        </label>
        <label className="field">
          <span>Upprepning</span>
          <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); touch('date'); touch('days') }}>
            <option value="once">En gång</option>
            <option value="daily">Varje dag</option>
            <option value="weekly">Varje vecka</option>
            <option value="weekdays">Vissa veckodagar</option>
          </select>
        </label>
        {kind === 'once' && (
          <label className="field">
            <span>Datum</span>
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); touch('date') }} required />
          </label>
        )}
        {kind === 'weekly' && (
          <label className="field">
            <span>Dag</span>
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAYS_LONG.map((d, i) => <option key={d} value={i + 1}>{`Varje ${d}`}</option>)}
            </select>
          </label>
        )}
        {kind === 'weekdays' && (
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Veckodagar</legend>
            <div className="checks">
              {WEEKDAYS_SHORT.map((d, i) => (
                <label key={d}>
                  <input
                    type="checkbox"
                    checked={days.includes(i + 1)}
                    onChange={(e) => { setDays(e.target.checked ? [...days, i + 1] : days.filter((x) => x !== i + 1)); touch('days') }}
                  />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {status && !status.on && <p className="warning">{status.reason}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Spara</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {reminder && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
