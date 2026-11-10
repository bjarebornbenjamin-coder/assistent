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
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  if (!supabase) return null
  const client = supabase
  const up = mode === 'up'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    setInfo('')
    const { data, error } = up
      ? await client.auth.signUp({ email: email.trim(), password })
      : await client.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return setMessage(loginError(error.message))
    if (up && !data.session) setInfo('Kontot är skapat. Bekräfta e-postadressen via mejlet och logga sedan in.')
    else setPassword('')
  }

  const switchMode = (m: 'in' | 'up') => {
    setMode(m)
    setMessage('')
    setInfo('')
  }

  return (
    <form className="login-form" onSubmit={submit}>
      {intro && <p className="muted">{intro}</p>}
      <div className="seg" role="group" aria-label="Logga in eller skapa konto">
        <button type="button" className="tab" aria-pressed={!up} onClick={() => switchMode('in')}>Logga in</button>
        <button type="button" className="tab" aria-pressed={up} onClick={() => switchMode('up')}>Skapa konto</button>
      </div>
      <label className="field">
        <span>E-post</span>
        <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        <span>Lösenord{up ? ' (minst 6 tecken)' : ''}</span>
        <span className="password-field">
          <input type={show ? 'text' : 'password'} autoComplete={up ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="btn text" aria-pressed={show} aria-label={show ? 'Dölj lösenordet' : 'Visa lösenordet'} onClick={() => setShow((v) => !v)}>
            {show ? 'Dölj' : 'Visa'}
          </button>
        </span>
      </label>
      {message && <p className="error" role="alert">{message}</p>}
      {info && <p className="muted" role="status">{info}</p>}
      <button type="submit" className="btn primary wide" disabled={busy || !email || (up ? password.length < 6 : !password)}>
        {busy ? (up ? 'Skapar konto…' : 'Loggar in…') : up ? 'Skapa konto' : 'Logga in'}
      </button>
    </form>
  )
}

/** Första sidan när synken är installerad men ingen är inloggad. */
export function LoginScreen() {
  return (
    <div className="login">
      <div className="eyebrow">Studieassistent</div>
      <h1>Välkommen</h1>
      <p className="muted">Schema, kalender, mat och träning på ett ställe. Logga in en gång per enhet, så följer allt med mellan mobil och dator.</p>
      <div className="card login-card">
        <LoginForm />
      </div>
    </div>
  )
}
