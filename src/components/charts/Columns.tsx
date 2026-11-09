import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceMax, topRoundedRect } from './scale'

export interface Segment {
  id: string
  label: string
  /** CSS-färg, t.ex. var(--viz-protein). */
  color: string
  value: number
}

export interface Column {
  key: string
  /** Kort etikett under stapeln. */
  label: string
  /** Fullständig beskrivning till tooltip och tabell. */
  title: string
  segments: Segment[]
}

interface Props {
  title: string
  subtitle?: string
  columns: Column[]
  /** Visa en x-etikett var N:e stapel (1 = alla). */
  labelEvery?: number
  goal?: { value: number; label: string }
  /** Formaterar ett värde för axel, tooltip och tabell. */
  format: (v: number) => string
  /** Axelns format kan skilja sig (t.ex. kortare). */
  formatTick?: (v: number) => string
  height?: number
  /** Sammanfattning till skärmläsare och som tabellrubrik för totalen. */
  totalLabel?: string
  showTotal?: boolean
}

const W = 360
const M = { left: 38, right: 8, top: 14, bottom: 22 }

export function Columns({ title, subtitle, columns, labelEvery = 1, goal, format, formatTick, height = 190, totalLabel = 'Totalt', showTotal = true }: Props) {
  const id = useId()
  const plotRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)

  const n = columns.length
  const plotW = W - M.left - M.right
  const plotH = height - M.top - M.bottom
  const totals = columns.map((c) => c.segments.reduce((s, x) => s + x.value, 0))
  const { max, ticks } = niceMax(Math.max(...totals, goal?.value ?? 0))
  const slot = plotW / n
  const barW = Math.min(24, slot * 0.7)
  const y = (v: number) => M.top + plotH - (v / max) * plotH
  const legend = columns[0]?.segments ?? []
  const hasData = totals.some((t) => t > 0)
  const tick = formatTick ?? format

  function indexAt(clientX: number): number | null {
    const el = plotRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * W - M.left
    if (x < 0 || x > plotW) return null
    return Math.min(n - 1, Math.max(0, Math.floor(x / slot)))
  }
  const onPointer = (e: PointerEvent) => setActive(indexAt(e.clientX))
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n) - 1))
    else if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? -1) + 1))
    else if (e.key === 'Escape') setActive(null)
    else return
    e.preventDefault()
  }

  const col = active !== null ? columns[active] : null
  const tipLeft = active !== null ? ((M.left + slot * (active + 0.5)) / W) * 100 : 0

  return (
    <figure className="viz-card" aria-labelledby={`${id}-t`}>
      <figcaption>
        <div id={`${id}-t`} className="viz-title">{title}</div>
        {subtitle && <div className="viz-sub">{subtitle}</div>}
      </figcaption>

      {legend.length > 1 && (
        <ul className="viz-legend" aria-label="Förklaring">
          {legend.map((s) => (
            <li key={s.id}><i style={{ background: s.color }} aria-hidden="true" />{s.label}</li>
          ))}
        </ul>
      )}

      {!hasData ? (
        <p className="empty">Inget loggat för perioden.</p>
      ) : (
        <div
          ref={plotRef}
          className="viz-plot"
          tabIndex={0}
          role="group"
          aria-label={`${title}. Använd vänster- och högerpil för att läsa varje stapel.`}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-hidden="true" focusable="false">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} className="viz-grid" />
                <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="viz-axis">{tick(t)}</text>
              </g>
            ))}

            {columns.map((c, i) => {
              const x = M.left + slot * i + (slot - barW) / 2
              let acc = 0
              const live = c.segments.filter((s) => s.value > 0)
              return (
                <g key={c.key} className={active === i ? 'viz-col on' : 'viz-col'}>
                  {live.map((s, j) => {
                    const bottom = y(acc)
                    acc += s.value
                    const top = y(acc)
                    const gap = j === 0 ? 0 : 2 // 2 px yta mellan segment
                    const h = Math.max(0, bottom - top - gap)
                    if (h < 1) return null
                    const isTop = j === live.length - 1
                    return isTop ? (
                      <path key={s.id} d={topRoundedRect(x, top, barW, h)} fill={s.color} />
                    ) : (
                      <rect key={s.id} x={x} y={top} width={barW} height={h} fill={s.color} />
                    )
                  })}
                  {(i % labelEvery === labelEvery - 1 || labelEvery === 1) && (
                    <text x={x + barW / 2} y={height - 6} textAnchor="middle" className="viz-axis">{c.label}</text>
                  )}
                </g>
              )
            })}

            {goal && goal.value > 0 && (
              <g>
                <line x1={M.left} x2={W - M.right} y1={y(goal.value)} y2={y(goal.value)} className="viz-goal" />
                <text x={W - M.right} y={y(goal.value) - 4} textAnchor="end" className="viz-goal-label">{goal.label}</text>
              </g>
            )}
            {active !== null && <line x1={M.left + slot * (active + 0.5)} x2={M.left + slot * (active + 0.5)} y1={M.top} y2={M.top + plotH} className="viz-cross" />}
          </svg>

          {col && (
            <div className="viz-tip" role="status" style={{ left: `${Math.min(78, Math.max(22, tipLeft))}%` }}>
              <div className="viz-tip-title">{col.title}</div>
              {col.segments.map((s) => (
                <div key={s.id} className="viz-tip-row">
                  <i style={{ background: s.color }} aria-hidden="true" />
                  <strong>{format(s.value)}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
              {showTotal && col.segments.length > 1 && (
                <div className="viz-tip-row total"><strong>{format(totals[active!])}</strong><span>{totalLabel}</span></div>
              )}
            </div>
          )}
        </div>
      )}

      <details className="viz-table">
        <summary>Visa som tabell</summary>
        <div className="viz-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Dag</th>
              {legend.map((s) => <th key={s.id} scope="col">{s.label}</th>)}
              {showTotal && legend.length > 1 && <th scope="col">{totalLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {columns.map((c, i) => (
              <tr key={c.key}>
                <th scope="row">{c.title}</th>
                {c.segments.map((s) => <td key={s.id}>{format(s.value)}</td>)}
                {showTotal && legend.length > 1 && <td>{format(totals[i])}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </figure>
  )
}
