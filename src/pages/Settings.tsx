import { useRef, useState, type FormEvent } from 'react'
import { parseBackup } from '../db/backup'
import { DEFAULT_MODEL, deleteContact, exportAll, importAll, newId, saveAiConfig, saveContact, saveSettings } from '../db/repo'
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
  const [key, setKey] = useState('')
  const [model, setModel] = useState<string | null>(null)
  if (!config) return null
  return (
    <>
      <h2>AI-assistent</h2>
      <p className="muted">
        Nyckeln sparas bara i den här webbläsaren och skickas bara till OpenAI. Den tas inte med i exporten. Alla som kommer åt din
        webbläsare kan läsa den, så sätt en utgiftsgräns på nyckeln hos OpenAI. När du frågar om schema eller händelser skickas just
        den informationen till OpenAI.
      </p>
      {config.apiKey ? (
        <p>Nyckel sparad (slutar på …{config.apiKey.slice(-4)}). <button type="button" className="btn danger" onClick={() => saveAiConfig({ apiKey: '' })}>Ta bort nyckel</button></p>
      ) : (
        <form className="item" onSubmit={(e: FormEvent) => { e.preventDefault(); if (key.trim()) { void saveAiConfig({ apiKey: key.trim() }); setKey('') } }}>
          <input type="password" aria-label="OpenAI API-nyckel" placeholder="sk-…" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
          <button type="submit" className="btn primary">Spara</button>
        </form>
      )}
      <label className="field">
        <span>Modell</span>
        <input
          type="text"
          value={model ?? config.model}
          placeholder={DEFAULT_MODEL}
          onChange={(e) => setModel(e.target.value)}
          onBlur={() => { if (model !== null) { void saveAiConfig({ model: model.trim() || DEFAULT_MODEL }); setModel(null) } }}
        />
      </label>
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
