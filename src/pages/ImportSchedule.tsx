import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { analyzeRows, parseImportResponse, readScheduleImage, type ImportRow } from '../ai/scheduleImport'
import { importLessons } from '../db/repo'
import { WEEKDAYS_LONG } from '../domain/dates'
import { cycleLabel } from '../domain/weekCycle'
import { useAiConfig, useLessons, useSettings, useSubjects } from '../hooks'
import { imageToDataUrl } from '../lib/image'
import { authHeaders } from '../lib/auth'

export function ImportSchedulePage() {
  const settings = useSettings()
  const config = useAiConfig()
  const lessons = useLessons()
  const subjects = useSubjects()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [rows, setRows] = useState<ImportRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cycleLength = settings?.cycleLength ?? 1
  const status = useMemo(
    () => (rows && lessons && subjects ? analyzeRows(rows, lessons, subjects, cycleLength) : new Map()),
    [rows, lessons, subjects, cycleLength],
  )
  if (!settings || !config || !lessons || !subjects) return null

  async function onFile(file: File) {
    setError('')
    setRows(null)
    setBusy(true)
    try {
      const headers = await authHeaders()
      const dataUrl = await imageToDataUrl(file)
      setPreview(dataUrl)
      const text = await readScheduleImage(dataUrl, config!.model, headers)
      const parsed = parseImportResponse(text, cycleLength)
      setSkipped(parsed.skipped)
      const existing = analyzeRows(parsed.rows, lessons!, subjects!, cycleLength)
      setRows(parsed.rows.map((r) => ({ ...r, include: !existing.get(r.key)?.duplicate })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const update = (key: string, patch: Partial<ImportRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null)
  const chosen = rows?.filter((r) => r.include) ?? []
  const invalid = chosen.some((r) => !status.get(r.key)?.valid)

  async function save() {
    if (!rows) return
    const res = await importLessons(
      chosen.map((r) => ({ subject: r.subject, weekday: r.weekday, start: r.start, end: r.end, room: r.room, teacher: r.teacher, weeks: cycleLength > 1 && r.week !== null ? [r.week] : null })),
    )
    navigate('/schema', { state: { imported: res } })
  }

  return (
    <>
      <Link to="/schema" className="back">‹ Tillbaka till Schema</Link>
      <h1>Importera schema från bild</h1>
      <p className="muted">
        Välj en skärmdump eller ett foto av ditt schema. Bilden skickas via appens server till OpenAI för avläsning och sparas inte. Du får granska och ändra
        allt innan något sparas.
      </p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Läser av…' : rows ? 'Välj en annan bild' : 'Välj bild'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {preview && <img src={preview} alt="Ditt schema" className="import-preview" />}

      {rows && (
        <>
          <h2>Hittade {rows.length} lektioner{skipped > 0 ? ` (${skipped} oläsliga hoppades över)` : ''}</h2>
          {rows.length === 0 && <p className="empty">Inga lektioner hittades. Prova en tydligare bild.</p>}
          {cycleLength === 1 && rows.some((r) => r.week !== null) && <p className="muted">Schemat verkar ha A/B-veckor. Slå på det under Inställningar och importera igen om du vill behålla det.</p>}
          {rows.map((r) => {
            const st = status.get(r.key)
            return (
              <div key={r.key} className={`card import-row${r.include ? '' : ' off'}`}>
                <label className="checks" style={{ margin: 0 }}>
                  <span className="row" style={{ alignItems: 'center' }}>
                    <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                    <span className="title">{r.subject || 'Namnlös'} {r.start}–{r.end}</span>
                  </span>
                </label>
                {st?.duplicate && <p className="sub">Finns redan i schemat.</p>}
                {st && st.conflicts.length > 0 && <p className="sub overdue">Krockar med {st.conflicts.join(', ')}</p>}
                {r.include && (
                  <div className="import-fields">
                    <input type="text" aria-label="Ämne" value={r.subject} onChange={(e) => update(r.key, { subject: e.target.value })} />
                    <select aria-label="Dag" value={r.weekday} onChange={(e) => update(r.key, { weekday: Number(e.target.value) })}>
                      {WEEKDAYS_LONG.map((d, i) => <option key={d} value={i + 1}>{d[0].toUpperCase() + d.slice(1)}</option>)}
                    </select>
                    <input type="time" aria-label="Start" value={r.start} onChange={(e) => update(r.key, { start: e.target.value })} />
                    <input type="time" aria-label="Slut" value={r.end} onChange={(e) => update(r.key, { end: e.target.value })} />
                    <input type="text" aria-label="Sal" placeholder="Sal" value={r.room} onChange={(e) => update(r.key, { room: e.target.value })} />
                    <input type="text" aria-label="Lärare" placeholder="Lärare" value={r.teacher} onChange={(e) => update(r.key, { teacher: e.target.value })} />
                    {cycleLength > 1 && (
                      <select aria-label="Vecka" value={r.week ?? ''} onChange={(e) => update(r.key, { week: e.target.value === '' ? null : Number(e.target.value) })}>
                        <option value="">Alla veckor</option>
                        {Array.from({ length: cycleLength }, (_, i) => <option key={i} value={i}>Vecka {cycleLabel(i)}</option>)}
                      </select>
                    )}
                    {!st?.valid && <p className="error">Kontrollera ämne och tider (slut måste vara efter start).</p>}
                  </div>
                )}
              </div>
            )
          })}
          <div className="actions">
            <button type="button" className="btn primary" disabled={chosen.length === 0 || invalid} onClick={save}>
              Importera {chosen.length} lektion{chosen.length === 1 ? '' : 'er'}
            </button>
            <Link to="/schema" className="btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Avbryt</Link>
          </div>
        </>
      )}
    </>
  )
}
