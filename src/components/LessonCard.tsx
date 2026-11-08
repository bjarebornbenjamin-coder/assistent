import type { Lesson, Subject } from '../domain/types'

export function lessonMeta(l: Lesson): string {
  return [l.room && `Sal ${l.room}`, l.teacher].filter(Boolean).join(' · ')
}

interface Props {
  lesson: Lesson
  subject?: Subject
  highlight?: boolean
  onClick?: () => void
}

export function LessonCard({ lesson, subject, highlight, onClick }: Props) {
  const body = (
    <div className="row">
      <span className="time">{lesson.start}–{lesson.end}</span>
      <div>
        <div className="title">{subject?.name ?? 'Okänt ämne'}</div>
        {lessonMeta(lesson) && <div className="sub">{lessonMeta(lesson)}</div>}
      </div>
    </div>
  )
  const cls = `card${highlight ? ' now' : ''}${subject?.color ? ' colored' : ''}`
  const style = subject?.color ? { borderLeftColor: subject.color } : undefined
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick}>{body}</button>
  ) : (
    <div className={cls} style={style}>{body}</div>
  )
}
