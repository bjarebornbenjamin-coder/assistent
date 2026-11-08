import { useRef, useState, type FormEvent } from 'react'
import { DEFAULT_MODEL, FALLBACK_MODELS, fetchModels } from '../ai/models'
import { authHeaders } from '../lib/auth'
import { parseBackup } from '../db/backup'
import { deleteContact, exportAll, importAll, newId, saveAiConfig, saveContact, saveSettings } from '../db/repo'
import { toISODate } from '../domain/dates'
import type { Theme } from '../domain/types'
import { anchorFor, cycleLabel, weekIndex } from '../domain/weekCycle'
import { useAiConfig, useContacts, useFieldError, useSettings } from '../hooks'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'Som enheten' },
  { value: 'light', label: 'Ljust' },
  { value: 'dark', label: 'Mörkt' },
]

function AiSection() {
  const config = useAiConfig()
  const [password, setPassword] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelsMsg, setModelsMsg] = useState('')
  if (!config) return null
  return (
    <>
      <h2>AI-assistent</h2>
      <p className="muted">
        OpenAI-nyckeln finns på servern (miljövariabeln OPENAI_API_KEY) och lämnar aldrig servern. Här anger du bara lösenordet som
        skyddar servern (APP_PASSWORD). Lösenordet sparas på den här enheten och ingår inte i exporten. När du frågar om schema eller
        händelser skickas just den informationen via servern till OpenAI.
      </p>
      {config.password ? (
        <p>
          Lösenord sparat. <button type="button" className="btn danger" onClick={() => saveAiConfig({ password: '' })}>Ta bort lösenord</button>
        </p>
      ) : (
        <form className="item" onSubmit={(e: FormEvent) => { e.preventDefault(); if (password.trim()) { void saveAiConfig({ password: password.trim() }); setPassword('') } }}>
          <input type="password" aria-label="Serverns lösenord" placeholder="Lösenord" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn primary">Spara</button>
        </form>
      )}
      <label className="field">
        <span>Modell</span>
        <select value={config.model} onChange={(e) => saveAiConfig({ model: e.target.value })}>
          {[...new Set([config.model, ...(config.models ?? FALLBACK_MODELS)])].map((m) => (
            <option key={m} value={m}>{m}{m === DEFAULT_MODEL ? ' (standard)' : ''}</option>
          ))}
        </select>
      </label>
      <div className="actions" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="btn"
          disabled={!config.password || loadingModels}
          onClick={async () => {
            setLoadingModels(true)
            setModelsMsg('')
            try {
              const headers = await authHeaders()
              if (!headers) throw new Error('Ange lösenordet först.')
              const models = await fetchModels(headers)
              await saveAiConfig({ models })
              setModelsMsg(`Hämtade ${models.length} modeller.`)
            } catch (e) {
              setModelsMsg(e instanceof Error ? e.message : 'Kunde inte hämta listan.')
            } finally {
              setLoadingModels(false)
            }
          }}
        >
          Hämta aktuell lista från OpenAI
        </button>
      </div>
      {modelsMsg && <p className="muted" role="status">{modelsMsg}</p>}
      <p className="muted">Listan nedan är en förvald lista tills du hämtar en färsk. Fungerar inte modellen används {DEFAULT_MODEL}.</p>
    </>
  )
}

function ContactsSection() {
  const contacts = useContacts()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { error, fail, touch } = useFieldError()
  if (!contacts) return null

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) return fail('contact', 'Ange namn och en giltig e-postadress.')
    await saveContact({ id: newId(), name: name.trim(), email: email.trim() })
    setName('')
    setEmail('')
  }

  return (
    <>
      <h2>Kontakter</h2>
      <p className="muted">Används av assistenten för att veta vem "Anna" är när du ber den skriva ett mejl.</p>
      {contacts.map((c) => (
        <div className="contact-row" key={c.id}>
          <span className="title">{c.name}</span>
          <span className="sub" style={{ overflowWrap: 'anywhere' }}>{c.email}</span>
          <button type="button" className="btn danger" aria-label={`Ta bort ${c.name}`} onClick={() => deleteContact(c.id)}>Ta bort</button>
        </div>
      ))}
      <form onSubmit={add}>
        <div className="two">
          <input type="text" aria-label="Kontaktens namn" placeholder="Namn" value={name} onChange={(e) => { setName(e.target.value); touch('contact') }} />
          <input type="text" inputMode="email" aria-label="Kontaktens e-post" placeholder="E-post" value={email} onChange={(e) => { setEmail(e.target.value); touch('contact') }} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="actions"><button type="submit" className="btn">Lägg till kontakt</button></div>
      </form>
    </>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)
  if (!settings) return null

  const today = toISODate(new Date())
  const currentWeek = weekIndex(today, settings.cycleAnchor, settings.cycleLength)

  async function download() {
    const blob = new Blob([JSON.stringify(await exportAll(), null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `studieassistent-${toISODate(new Date())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function upload(file: File) {
    try {
      const backup = parseBackup(JSON.parse(await file.text()))
      if (!confirm(`Importen ersätter ALL data i appen (${backup.subjects.length} ämnen, ${backup.lessons.length} lektioner, ${backup.events.length} händelser). Fortsätta?`)) return
      await importAll(backup)
      setMessage({ text: 'Importen är klar.', error: false })
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : 'Kunde inte läsa filen.', error: true })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <h1>Inställningar</h1>

      <h2>Veckor</h2>
      <label className="field">
        <span>Hur skiljer sig veckorna åt?</span>
        <select
          value={settings.cycleLength}
          onChange={(e) => saveSettings({ cycleLength: Number(e.target.value), cycleAnchor: anchorFor(today, 0) })}
        >
          <option value={1}>Samma schema varje vecka</option>
          <option value={2}>A/B-veckor</option>
          <option value={3}>3 olika veckor (A/B/C)</option>
          <option value={4}>4 olika veckor (A/B/C/D)</option>
        </select>
      </label>
      {settings.cycleLength > 1 && (
        <label className="field">
          <span>Den här veckan är</span>
          <select value={currentWeek} onChange={(e) => saveSettings({ cycleAnchor: anchorFor(today, Number(e.target.value)) })}>
            {Array.from({ length: settings.cycleLength }, (_, i) => (
              <option key={i} value={i}>Vecka {cycleLabel(i)}</option>
            ))}
          </select>
        </label>
      )}

      <h2>Utseende</h2>
      <div className="seg" role="group" aria-label="Tema">
        {THEMES.map((t) => (
          <button key={t.value} type="button" className="tab" aria-pressed={settings.theme === t.value} onClick={() => saveSettings({ theme: t.value })}>
            {t.label}
          </button>
        ))}
      </div>

      <AiSection />
      <ContactsSection />

      <h2>Säkerhetskopia</h2>
      <p className="muted">All data ligger bara på den här enheten. Exportera regelbundet.</p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn" onClick={download}>Exportera JSON</button>
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Importera JSON</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {message && <p className={message.error ? 'error' : 'muted'} role="status">{message.text}</p>}
    </>
  )
}
