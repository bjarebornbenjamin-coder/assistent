import { useState, type FormEvent } from 'react'
import { useSyncStatus } from './status'
import { supabase, syncConfigured, useSession } from './supabase'

export function SyncSection() {
  const session = useSession()
  const status = useSyncStatus()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (!syncConfigured || !supabase) {
    return (
      <>
        <h2>Synk mellan enheter</h2>
        <p className="muted">Synk är inte påslagen på den här installationen. Se README (avsnittet Supabase) för hur du kopplar den.</p>
      </>
    )
  }
  const client = supabase
  if (session === undefined) return null

  async function auth(kind: 'in' | 'up', e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const { data, error } =
      kind === 'in'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    if (error) return setMessage(error.message)
    if (kind === 'up' && !data.session) setMessage('Kontot är skapat. Bekräfta e-postadressen via mejlet och logga sedan in.')
    else setPassword('')
  }

  return (
    <>
      <h2>Synk mellan enheter</h2>
      {session ? (
        <>
          <p>Inloggad som {session.user.email}.</p>
          <p className="muted" role="status">
            {status.state === 'syncing' && 'Synkar…'}
            {status.state === 'idle' && `Senast synkad ${status.lastSync ? new Date(status.lastSync).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : ''}.`}
            {status.state === 'error' && <span className="error">Synken misslyckades: {status.error}</span>}
            {!navigator.onLine && ' Du är offline. Ändringar synkas när nätet är tillbaka.'}
          </p>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn" onClick={() => window.dispatchEvent(new Event('manual-sync'))}>Synka nu</button>
            <button type="button" className="btn danger" onClick={() => client.auth.signOut()}>Logga ut</button>
          </div>
          <p className="muted">Datan finns kvar på enheten när du loggar ut, men synkas inte längre.</p>
        </>
      ) : (
        <form onSubmit={(e) => auth('in', e)}>
          <p className="muted">Logga in så följer schema, ämnen, händelser och uppgifter med mellan dina enheter. Din befintliga data på den här enheten laddas upp första gången.</p>
          <label className="field"><span>E-post</span><input type="text" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>Lösenord</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {message && <p className="error" role="alert">{message}</p>}
          <div className="actions">
            <button type="submit" className="btn primary" disabled={busy || !email || !password}>Logga in</button>
            <button type="button" className="btn" disabled={busy || !email || password.length < 6} onClick={(e) => auth('up', e as unknown as FormEvent)}>Skapa konto</button>
          </div>
        </form>
      )}
    </>
  )
}
