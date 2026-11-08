import { useEffect } from 'react'

interface Props {
  title: string
  message?: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="scrim" onClick={onCancel}>
      <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={message ? 'confirm-msg' : undefined} onClick={(e) => e.stopPropagation()}>
        <h1 id="confirm-title" style={{ fontSize: 20 }}>{title}</h1>
        {message && <p id="confirm-msg">{message}</p>}
        <div className="actions">
          <button type="button" className="btn danger" onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" className="btn" onClick={onCancel} autoFocus>Avbryt</button>
        </div>
      </div>
    </div>
  )
}
