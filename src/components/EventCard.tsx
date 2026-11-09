import { eventTime } from '../domain/calendar'
import type { CalendarEvent } from '../domain/types'

export function EventCard({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  const body = (
    <div className="row">
      <span className="time">{eventTime(event)}</span>
      <div>
        <div className="title">{event.title}</div>
        {event.note && <div className="sub note">{event.note}</div>}
        {event.source === 'google' && <div className="sub">Google Kalender</div>}
      </div>
    </div>
  )
  return onClick ? (
    <button type="button" className="card event" onClick={onClick}>{body}</button>
  ) : (
    <div className="card event">{body}</div>
  )
}
