import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { matchExisting, parseScanResponse, scanImage, type ScanKind, type ScanRow } from '../ai/foodScan'
import { addPantryItems } from '../db/repo'
import { toISODate } from '../domain/dates'
import { useAiConfig, usePantry, useShopping } from '../hooks'
import { authHeaders } from '../lib/auth'
import { imageToDataUrl } from '../lib/image'

const TEXT: Record<ScanKind, { title: string; intro: string; button: string }> = {
  receipt: {
    title: 'Skanna kvitto',
    intro:
      'Ta ett skarpt, rakt foto av kvittot eller välj en skärmdump av ett e-kvitto. Bilden skickas via appens server till OpenAI och sparas inte. Bäst före-datumen är uppskattningar som du kan ändra. Dölj gärna kortnummer.',
    button: 'Välj kvitto',
  },
  fridge: {
    title: 'Skanna kylskåp',
    intro:
      'Fota kylskåpet, frysen eller skafferiet med öppen dörr. AI:n ser bara det som syns, så saker bakom andra varor missas och mängderna är gissningar. Granska listan innan du sparar. Bilden skickas via appens server till OpenAI och sparas inte.',
    button: 'Välj foto',
  },
}

export function ScanFoodPage() {
  const [params] = useSearchParams()
  const kind: ScanKind = params.get('typ') === 'kylskap' ? 'fridge' : 'receipt'
  const t = TEXT[kind]
  const config = useAiConfig()
  const pantry = usePantry()
  const shopping = useShopping()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState('')
  const [rows, setRows] = useState<ScanRow[] | null>(null)
  const [skipped, setSkipped] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!config || !pantry || !shopping) return null

  const match = matchExisting(pantry, shopping)

  async function onFile(file: File) {
    setError('')
    setRows(null)
    setBusy(true)
    try {
      const image = await imageToDataUrl(file)
      setPreview(image)
      const text = await scanImage(kind, image, config!.model, await authHeaders())
      const parsed = parseScanResponse(text, kind, toISODate(new Date()))
      setSkipped(parsed.skipped)
      setRows(parsed.rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Något gick fel.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const update = (key: string, patch: Partial<ScanRow>) => setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null)
  const chosen = rows?.filter((r) => r.include && r.name.trim()) ?? []
  const clearing = kind === 'receipt' ? chosen.filter((r) => match.listHit(r)) : []

  async function save() {
    await addPantryItems(chosen.map((r) => ({ name: r.name, amount: r.amount, expires: r.expires || undefined })), kind, { clearFromList: kind === 'receipt' })
    navigate('/mat')
  }

  return (
    <>
      <Link to="/mat" className="back">‹ Tillbaka till Mat</Link>
      <h1>{t.title}</h1>
      <p className="muted">{t.intro}</p>
      <div className="actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Läser av…' : rows ? 'Välj en annan bild' : t.button}
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {error && (
        <>
          <p className="error" role="alert">{error}</p>
          <div className="actions" style={{ marginTop: 0 }}><Link to="/installningar" className="btn">Testa anslutningen</Link></div>
        </>
      )}
      {preview && <img src={preview} alt={kind === 'receipt' ? 'Ditt kvitto' : 'Ditt foto'} className="import-preview" />}

      {rows && (
        <>
          <h2>Hittade {rows.length} varor{skipped > 0 ? ` (${skipped} hoppades över)` : ''}</h2>
          {rows.length === 0 && <p className="empty">Inga varor hittades. Prova en skarpare bild.</p>}
          {rows.map((r) => {
            const inPantry = match.pantryHit(r)
            const onList = kind === 'receipt' ? match.listHit(r) : undefined
            return (
              <div key={r.key} className={`card import-row${r.include ? '' : ' off'}`}>
                <label className="checks" style={{ margin: 0 }}>
                  <span className="row" style={{ alignItems: 'center' }}>
                    <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, { include: e.target.checked })} />
                    <span className="title">{r.name || 'Namnlös'}{r.amount ? ` · ${r.amount}` : ''}</span>
                  </span>
                </label>
                {inPantry && <p className="sub">Finns redan i lagret{inPantry.amount ? ` (${inPantry.amount})` : ''}. Det läggs till som en ny post.</p>}
                {onList && r.include && <p className="sub">Tas bort från inköpslistan.</p>}
                {r.include && (
                  <div className="import-fields">
                    <input type="text" aria-label="Vara" value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} />
                    <input type="text" aria-label="Mängd" placeholder="Mängd" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} />
                    <input type="date" aria-label="Bäst före" value={r.expires} onChange={(e) => update(r.key, { expires: e.target.value })} />
                  </div>
                )}
              </div>
            )
          })}
          <div className="actions">
            <button type="button" className="btn primary" disabled={chosen.length === 0} onClick={save}>
              Lägg {chosen.length} {chosen.length === 1 ? 'vara' : 'varor'} i lagret{clearing.length > 0 ? ` (${clearing.length} tas bort från listan)` : ''}
            </button>
            <Link to="/mat" className="btn">Avbryt</Link>
          </div>
        </>
      )}
    </>
  )
}
