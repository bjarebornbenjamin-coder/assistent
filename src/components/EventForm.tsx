import { useState, type FormEvent } from 'react'
import { useFieldError } from '../hooks'
import { undoable } from '../lib/undo'
import { deleteEvent, newId, saveEvent } from '../db/repo'
import type { CalendarEvent, ISODate } from '../domain/types'
import { dayLabel, eventTime } from '../domain/calendar'

interface Props {
  event: CalendarEvent | null
  defaultDate: ISODate
  onClose: () => void
}

export function EventForm(props: Props) {
  return props.event?.source === 'google' ? <GoogleEventView event={props.event} onClose={props.onClose} /> : <EditableEventForm {...props} />
}

/** Händelser från Google går inte att ändra här, bara visa och öppna i Google. */
function GoogleEventView({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={event.title}>
        <h1>{event.title}</h1>
        <p>{dayLabel(event.date)} · {eventTime(event)}</p>
        {event.note && <p className="muted" style={{ whiteSpace: 'pre-line' }}>{event.note}</p>}
        <p className="muted">Från Google Kalender. Ändra eller ta bort den där.</p>
        <div className="actions">
          {event.link && <a className="btn primary" href={event.link} target="_blank" rel="noreferrer">Öppna i Google Kalender</a>}
          <button type="button" className="btn" onClick={onClose}>Stäng</button>
        </div>
      </div>
    </div>
  )
}

function EditableEventForm({ event, defaultDate, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? defaultDate)
  const [allDay, setAllDay] = useState(event ? event.start === undefined : true)
  const [start, setStart] = useState(event?.start ?? '08:00')
  const [end, setEnd] = useState(event?.end ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const { error, fail, touch } = useFieldError()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return fail('title', 'Skriv en titel.')
    if (!date) return fail('date', 'Välj ett datum.')
    if (!allDay && end && end <= start) return fail('time', 'Sluttiden måste vara efter starttiden.')
    await saveEvent({
      id: event?.id ?? newId(),
      title: title.trim(),
      date,
      ...(allDay ? {} : { start, ...(end ? { end } : {}) }),
      note: note.trim(),
      updatedAt: '',
    })
    onClose()
  }

  async function remove() {
    if (!event) return
    await undoable('Händelsen är borttagen', ['events'], () => deleteEvent(event.id))
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={event ? 'Ändra händelse' : 'Ny händelse'}>
        <h1>{event ? 'Ändra händelse' : 'Ny händelse'}</h1>
        <label className="field">
          <span>Titel</span>
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); touch('title') }} autoFocus onFocus={(e) => e.currentTarget.select()} />
        </label>
        <label className="field">
          <span>Datum</span>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); touch('date') }} required />
        </label>
        <div className="checks">
          <label><input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); touch('time') }} /> Heldag</label>
        </div>
        {!allDay && (
          <div className="two">
            <label className="field"><span>Start</span><input type="time" value={start} onChange={(e) => { setStart(e.target.value); touch('time') }} required /></label>
            <label className="field"><span>Slut (valfritt)</span><input type="time" value={end} onChange={(e) => { setEnd(e.target.value); touch('time') }} /></label>
          </div>
        )}
        <label className="field">
          <span>Anteckning (valfritt)</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn primary">Spara</button>
          <button type="button" className="btn" onClick={onClose}>Avbryt</button>
          <span className="spacer" />
          {event && <button type="button" className="btn danger" onClick={remove}>Ta bort</button>}
        </div>
      </form>
    </div>
  )
}
