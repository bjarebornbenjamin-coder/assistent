import type { CSSProperties } from 'react'
import type { Lesson, Subject } from '../domain/types'

export function lessonMeta(l: Lesson): string {
  return [l.room && `Sal ${l.room}`, l.teacher].filter(Boolean).join(' · ')
}

interface Props {
  lesson: Lesson
  subject?: Subject
  highlight?: boolean
  onClick?: () => void
  /** Större variant för det viktigaste kortet på en sida. */
  size?: 'large'
  /** Lektionen är redan slut idag. */
  past?: boolean
  /** Lektionen krockar med en annan. */
  conflict?: boolean
}

export function LessonCard({ lesson, subject, highlight, onClick, size, past, conflict }: Props) {
  const body = (
    <div className="row">
      <span className="time">{lesson.start}–{lesson.end}</span>
      <div>
        <div className="title">{subject?.name ?? 'Okänt ämne'}</div>
        {lessonMeta(lesson) && <div className="sub">{lessonMeta(lesson)}</div>}
        {conflict && <div className="tag-warn">Krockar med en annan lektion</div>}
        {past && <span className="visually-hidden"> (slut)</span>}
      </div>
    </div>
  )
  const cls = `card${highlight ? ' now' : ''}${subject?.color ? ' colored' : ''}${size === 'large' ? ' hero' : ''}${past ? ' past' : ''}`
  // Ämnets färg används som tonad fyllning (som händelser i Google Kalender), inte som kant.
  const style = subject?.color ? ({ '--subject': subject.color } as CSSProperties) : undefined
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  )
}
