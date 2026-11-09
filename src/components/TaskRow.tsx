import type { CSSProperties } from 'react'
import { setTaskDone } from '../db/repo'
import { undoable } from '../lib/undo'
import { deadlineLabel, isOverdue } from '../domain/tasks'
import type { Subject, Task } from '../domain/types'

interface Props {
  task: Task
  subject?: Subject
  today: string
  /** Visa deadline-datum (utelämnas när dagen redan framgår). */
  showDeadline?: boolean
  onEdit: () => void
}

export function TaskRow({ task, subject, today, showDeadline = true, onEdit }: Props) {
  const overdue = isOverdue(task, today)
  const meta = [subject?.name, showDeadline ? deadlineLabel(task.deadline, today) : null].filter(Boolean).join(' · ')
  return (
    <div className={`card task${task.done ? ' done' : ''}${subject?.color ? ' colored' : ''}`} style={subject?.color ? ({ '--subject': subject.color } as CSSProperties) : undefined}>
      <input
        type="checkbox"
        aria-label={`Klar: ${task.title}`}
        checked={task.done}
        onChange={(e) => {
          const done = e.target.checked
          void undoable(done ? `"${task.title}" är klar` : `"${task.title}" är inte klar`, ['tasks'], () => setTaskDone(task.id, done))
        }}
      />
      <button type="button" className="task-main" onClick={onEdit}>
        <span className="title">{task.title}</span>
        <span className={`sub${overdue ? ' overdue' : ''}`}>
          {overdue && 'Försenad · '}
          {meta}
        </span>
      </button>
    </div>
  )
}
