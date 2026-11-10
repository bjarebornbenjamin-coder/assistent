import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  onClick: () => Promise<unknown> | unknown
  children: ReactNode
  /** Text efter bocken när det är gjort, t.ex. "På inköpslistan". */
  doneText: string
  className?: string
  disabled?: boolean
  /** Ändras värdet (t.ex. vad som saknas) blir knappen tryckbar igen. */
  resetKey?: string | number
}

/** Knapp som visar en bock när åtgärden är gjord, så att man ser att trycket gick fram. */
export function DoneButton({ onClick, children, doneText, className = 'btn', disabled, resetKey }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  useEffect(() => setState('idle'), [resetKey])
  return (
    <button
      type="button"
      className={`${className}${state === 'done' ? ' done-check' : ''}`}
      disabled={disabled || state !== 'idle'}
      aria-live="polite"
      onClick={async () => {
        setState('busy')
        try {
          await onClick()
          setState('done')
        } catch {
          setState('idle')
        }
      }}
    >
      {state === 'done' ? <><span aria-hidden="true">✓ </span>{doneText}</> : children}
    </button>
  )
}
