import { useState, type FormEvent } from 'react'
import { keyHint, projectHint, supabase } from './supabase'

/** Supabase svarar på engelska; de vanligaste felen översätts. */
export function loginError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid api key') || m.includes('no api key')) {
    return `Supabase godkänner inte nyckeln i VITE_SUPABASE_ANON_KEY. Appen använder ${keyHint} för ${projectHint}. Jämför med Publishable key i Supabase (Project Settings → API Keys): kopiera den med kopieringsknappen, inte genom att markera texten, lägg in den igen i Vercel och gör Redeploy.`
  }
  if (m.includes('invalid login credentials')) return 'Fel e-post eller lösenord.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Det går inte att skapa nya konton. Logga in med ditt befintliga konto.'
  if (m.includes('already registered')) return 'Det finns redan ett konto med den e-postadressen. Logga in i stället.'
  if (m.includes('email not confirmed')) return 'E-postadressen är inte bekräftad. Klicka på länken i mejlet från Supabase, eller stäng av Confirm email i Supabase.'
  if (m.includes('password should be at least')) return 'Lösenordet måste vara minst 6 tecken.'
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'E-postadressen ser inte rätt ut.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Kunde inte nå Supabase. Kontrollera internetanslutningen.'
  return message
}

export function LoginForm({ intro }: { intro?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  if (!supabase) return null
  const client = supabase

  async function auth(kind: 'in' | 'up', e?: FormEvent) {
    e?.preventDefault()
    setBusy(true)
    setMessage('')
    setInfo('')
    const { data, error } =
      kind === 'in'
        ? await client.auth.signInWithPassword({ email: email.trim(), password })
        : await client.auth.signUp({ email: email.trim(), password })
    setBusy(false)
    if (error) return setMessage(loginError(error.message))
    if (kind === 'up' && !data.session) setInfo('Kontot är skapat. Bekräfta e-postadressen via mejlet och logga sedan in.')
    else setPassword('')
  }

  return (
    <form onSubmit={(e) => auth('in', e)}>
      {intro && <p className="muted">{intro}</p>}
      <label className="field"><span>E-post</span><input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="field"><span>Lösenord</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {message && <p className="error" role="alert">{message}</p>}
      {info && <p className="muted" role="status">{info}</p>}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={busy || !email || !password}>{busy ? 'Loggar in…' : 'Logga in'}</button>
        <button type="button" className="btn text" disabled={busy || !email || password.length < 6} onClick={() => auth('up')}>Skapa konto</button>
      </div>
    </form>
  )
}

/** Första sidan när synken är installerad men ingen är inloggad. */
export function LoginScreen() {
  return (
    <div className="login">
      <h1>Logga in</h1>
      <LoginForm intro="Logga in för att använda din studieassistent. Det du har i appen följer med mellan dina enheter. Du behöver bara logga in en gång per enhet." />
      <p className="muted small">Första gången: skriv e-post och ett lösenord (minst 6 tecken) och tryck Skapa konto.</p>
    </div>
  )
}
