import { useState, type FormEvent } from 'react'
import { deleteEvent, newId, saveEvent } from '../db/repo'
import type { CalendarEvent, ISODate } from '../domain/types'

interface Props {
  event: CalendarEvent | null
  defaultDate: ISODate
  onClose: () => void
}

export function EventForm({ event, defaultDate, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '')
  const [date, setDate] = useState(event?.date ?? defaultDate)
  const [allDay, setAllDay] = useState(event ? event.start === undefined : true)
  const [start, setStart] = useState(event?.start ?? '08:00')
  const [end, setEnd] = useState(event?.end ?? '')
  const [note, setNote] = useState(event?.note ?? '')
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Skriv en titel.')
    if (!date) return setError('Välj ett datum.')
    if (!allDay && end && end <= start) return setError('Sluttiden måste vara efter starttiden.')
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
    if (!event || !confirm('Ta bort händelsen?')) return
    await deleteEvent(event.id)
    onClose()
  }

  return (
    <div className="scrim" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-label={event ? 'Ändra händelse' : 'Ny händelse'}>
        <h1>{event ? 'Ändra händelse' : 'Ny händelse'}</h1>
        <label className="field">
          <span>Titel</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Datum</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="checks">
          <label><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Heldag</label>
        </div>
        {!allDay && (
          <div className="two">
            <label className="field"><span>Start</span><input type="time" value={start} onChange={(e) => setStart(e.target.value)} required /></label>
            <label className="field"><span>Slut (valfritt)</span><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
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
