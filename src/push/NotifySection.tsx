import { useCallback, useEffect, useState } from 'react'
import { saveSettings } from '../db/repo'
import { useSettings } from '../hooks'
import { authHeaders } from '../lib/auth'
import { supabase, useSession } from '../sync/supabase'
import { currentSubscription, pushSupported, subscribeDevice, unsubscribeDevice, vapidKey } from './push'

const BEFORE_OPTIONS = [0, 5, 10, 15, 30]

export function NotifySection() {
  const settings = useSettings()
  const session = useSession()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setSubscribed(pushSupported() && Notification.permission === 'granted' ? Boolean(await currentSubscription()) : false)
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!settings) return null
  const n = settings.notify

  const head = <h2>Notiser</h2>
  if (!pushSupported()) {
    return <>{head}<p className="muted">Den här webbläsaren stöder inte push-notiser. På iPhone måste appen först läggas till på hemskärmen (iOS 16.4 eller senare).</p></>
  }
  if (!supabase || !vapidKey) {
    return <>{head}<p className="muted">Notiser är inte påslagna på den här installationen. Se README (avsnittet Push-notiser).</p></>
  }
  if (!session) {
    return <>{head}<p className="muted">Logga in under Synk ovan för att kunna få notiser. Servern behöver veta vem du är för att skicka till rätt enhet.</p></>
  }
  const client = supabase
  const userId = session.user.id

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    setMessage('')
    try {
      await fn()
      setMessage(ok)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
      await refresh()
      window.dispatchEvent(new Event('push-changed'))
    }
  }

  async function test() {
    const headers = await authHeaders()
    const res = await fetch('/api/push-test', { method: 'POST', headers: headers ?? {} })
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    if (!res.ok) throw new Error(body.error?.message ?? `Servern svarade med fel ${res.status}.`)
  }

  return (
    <>
      {head}
      <div className="checks" style={{ marginBottom: 8 }}>
        <label>
          <input type="checkbox" checked={n.evening} onChange={(e) => saveSettings({ notify: { ...n, evening: e.target.checked } })} />
          Kvällsnotis med morgondagens lektioner och packlista
        </label>
      </div>
      {n.evening && (
        <label className="field">
          <span>Tid för kvällsnotis</span>
          <input type="time" value={n.eveningTime} onChange={(e) => e.target.value && saveSettings({ notify: { ...n, eveningTime: e.target.value } })} />
        </label>
      )}
      <div className="checks" style={{ marginBottom: 8 }}>
        <label>
          <input type="checkbox" checked={n.before} onChange={(e) => saveSettings({ notify: { ...n, before: e.target.checked } })} />
          Notis före varje lektion
        </label>
      </div>
      {n.before && (
        <label className="field">
          <span>Hur långt före</span>
          <select value={n.beforeMinutes} onChange={(e) => saveSettings({ notify: { ...n, beforeMinutes: Number(e.target.value) } })}>
            {BEFORE_OPTIONS.map((m) => <option key={m} value={m}>{m === 0 ? 'Vid start' : `${m} minuter före`}</option>)}
          </select>
        </label>
      )}

      <p className="muted">
        {subscribed === null ? '' : subscribed ? 'Den här enheten tar emot notiser.' : 'Den här enheten tar inte emot notiser än.'}
      </p>
      <div className="actions" style={{ marginTop: 0 }}>
        {subscribed ? (
          <>
            <button type="button" className="btn" disabled={busy} onClick={() => run(test, 'Testnotis skickad.')}>Skicka testnotis</button>
            <button type="button" className="btn danger" disabled={busy} onClick={() => run(() => unsubscribeDevice(client, userId), 'Notiser avstängda på den här enheten.')}>Stäng av på den här enheten</button>
          </>
        ) : (
          <button type="button" className="btn primary" disabled={busy} onClick={() => run(() => subscribeDevice(client, userId), 'Notiser påslagna.')}>Slå på notiser på den här enheten</button>
        )}
      </div>
      {message && <p className="muted" role="status">{message}</p>}
      <p className="muted">
        Notiserna planeras 14 dagar framåt varje gång du öppnar appen eller ändrar schema och packlistor. Öppna appen minst varannan vecka.
      </p>
    </>
  )
}
