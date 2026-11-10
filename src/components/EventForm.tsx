import { useState, type FormEvent } from 'react'
import { AiProgress } from './AiProgress'
import { useAiConfig, useFieldError, useSettings } from '../hooks'
import { suggestPackItems } from '../ai/packSuggest'
import { authHeaders } from '../lib/auth'
import { itemKey } from '../domain/packing'
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
  const [pack, setPack] = useState<string[]>(event?.packItems ?? [])
  const [newItem, setNewItem] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestNote, setSuggestNote] = useState('')
  const [askedFor, setAskedFor] = useState('')
  const config = useAiConfig()
  const settings = useSettings()
  const { error, fail, touch } = useFieldError()

  const addItems = (items: string[]) => {
    setPack((list) => {
      const keys = new Set(list.map(itemKey))
      return [...list, ...items.map((t) => t.trim()).filter((t) => t && !keys.has(itemKey(t)) && keys.add(itemKey(t)))]
    })
    setSuggestions((s) => s.filter((x) => !items.some((t) => itemKey(t) === itemKey(x))))
  }

  async function suggest() {
    const t = title.trim()
    if (!t) return fail('title', 'Skriv först vad det är för händelse.')
    setAskedFor(t)
    setSuggesting(true)
    setSuggestNote('')
    try {
      const list = await suggestPackItems({ title: t, date, ...(allDay ? {} : { start, ...(end ? { end } : {}) }), note }, pack, settings?.memories ?? [], config?.model ?? 'gpt-4o-mini', await authHeaders())
      setSuggestions(list)
      if (list.length === 0) setSuggestNote('AI:n tycker inte att du behöver ta med något särskilt.')
    } catch (e) {
      setSuggestNote(e instanceof Error ? e.message : 'Kunde inte hämta förslag.')
    } finally {
      setSuggesting(false)
    }
  }

  /** Nya händelser får förslag direkt när titeln är ifylld, en gång per titel. */
  function autoSuggest() {
    const t = title.trim()
    if (!event && t.length >= 3 && pack.length === 0 && t !== askedFor && !suggesting) void suggest()
  }

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
      ...(pack.length ? { packItems: pack } : {}),
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
          <input type="text" value={title} onChange={(e) => { setTitle(e.target.value); touch('title') }} onBlur={autoSuggest} autoFocus onFocus={(e) => e.currentTarget.select()} />
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
        <fieldset className="pack-edit">
          <legend>Ta med</legend>
          {pack.length > 0 && (
            <div className="chips">
              {pack.map((t) => (
                <span key={itemKey(t)} className="chip on">
                  {t}
                  <button type="button" aria-label={`Ta bort ${t}`} onClick={() => setPack((l) => l.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
          )}
          <div className="add-row">
            <input
              type="text"
              aria-label="Sak att ta med"
              placeholder="Lägg till sak"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addItems([newItem])
                  setNewItem('')
                }
              }}
            />
            <button type="button" className="btn" onClick={() => { addItems([newItem]); setNewItem('') }}>Lägg till</button>
          </div>
          {suggestions.length > 0 && (
            <div className="suggest">
              <span className="sub">Förslag från AI, tryck för att lägga till:</span>
              <div className="chips">
                {suggestions.map((t) => (
                  <button key={t} type="button" className="chip" onClick={() => addItems([t])}>+ {t}</button>
                ))}
                {suggestions.length > 1 && <button type="button" className="chip" onClick={() => addItems(suggestions)}>Lägg till alla</button>}
              </div>
            </div>
          )}
          <button type="button" className="btn text" disabled={suggesting} onClick={suggest}>
            {suggesting ? 'Tänker…' : suggestions.length || askedFor ? 'Nya förslag från AI' : 'Föreslå vad jag ska ta med'}
          </button>
          <AiProgress active={suggesting} expected={6} label="Tar fram förslag" />
          {suggestNote && <p className="sub" role="status">{suggestNote}</p>}
        </fieldset>
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
