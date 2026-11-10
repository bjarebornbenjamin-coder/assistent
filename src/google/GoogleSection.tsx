import { useState } from 'react'
import { GOOGLE_CLIENT_ID, connectAndSync, disconnectGoogle, events, useGoogleState } from './google'

export function GoogleSection() {
  const state = useGoogleState()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      setMessage(await action())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {!GOOGLE_CLIENT_ID ? (
        <p className="muted">
          Inte inställt. Det kräver ett OAuth-klient-ID från Google Cloud som läggs in som VITE_GOOGLE_CLIENT_ID i Vercel. Se README, avsnittet Google Kalender.
        </p>
      ) : !state?.connected ? (
        <>
          <p className="muted">Visar händelser från dina Google-kalendrar i appen (30 dagar bakåt, 4 månader framåt). Appen kan bara läsa, inte ändra i Google.</p>
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn primary" disabled={busy} onClick={() => run(async () => `Kopplad. ${events(await connectAndSync(true))} hämtade.`)}>
              {busy ? 'Kopplar…' : 'Koppla Google Kalender'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted">
            {events(state.count ?? 0)} från {state.calendars?.length ? state.calendars.join(', ') : 'Google'}.
            {state.lastSync && ` Senast hämtat ${new Date(state.lastSync).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}.`}
            {' '}Hämtas automatiskt när du öppnar appen, så länge inloggningen gäller (ungefär en timme). Annars trycker du på Hämta från Google.
          </p>
          <div className="actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn" disabled={busy} onClick={() => run(async () => `${events(await connectAndSync(false))} hämtade.`)}>
              {busy ? 'Hämtar…' : 'Hämta från Google'}
            </button>
            <button type="button" className="btn danger" disabled={busy} onClick={() => run(async () => (await disconnectGoogle(), 'Bortkopplad. Googles händelser är borttagna ur appen.'))}>
              Koppla från
            </button>
          </div>
        </>
      )}
      {message && <p className="muted" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  )
}
