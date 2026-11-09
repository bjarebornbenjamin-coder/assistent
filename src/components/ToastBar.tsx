import { hideToast, useToast } from '../lib/undo'

export function ToastBar() {
  const toast = useToast()
  if (!toast) return null
  return (
    <div className="toast" role="status" aria-live="polite" key={toast.id}>
      <span>{toast.message}</span>
      {toast.undo && (
        <button
          type="button"
          className="toast-undo"
          onClick={async () => {
            const undo = toast.undo!
            hideToast()
            await undo()
          }}
        >
          Ångra
        </button>
      )}
    </div>
  )
}
