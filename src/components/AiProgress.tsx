import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Sant medan AI:n arbetar. */
  active: boolean
  /** Ungefär hur lång tid det brukar ta, i sekunder. */
  expected: number
  label: string
}

/**
 * Förloppsstapel 0–100 % medan AI:n arbetar. AI:n rapporterar inte hur långt den kommit,
 * så stapeln är en uppskattning: den fylls snabbt först och sedan allt långsammare mot 95 %,
 * och går till 100 % när svaret kommer.
 */
export function AiProgress({ active, expected, label }: Props) {
  const [pct, setPct] = useState(0)
  const [visible, setVisible] = useState(active)
  const started = useRef(0)

  useEffect(() => {
    if (active) {
      started.current = Date.now()
      setVisible(true)
      setPct(0)
      const timer = setInterval(() => {
        const t = (Date.now() - started.current) / 1000
        setPct(Math.min(95, Math.round(95 * (1 - Math.exp((-2 * t) / expected)))))
      }, 200)
      return () => clearInterval(timer)
    }
    if (!visible) return
    setPct(100)
    const hide = setTimeout(() => setVisible(false), 600)
    return () => clearTimeout(hide)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, expected])

  if (!visible) return null
  return (
    <div className="ai-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="ai-progress-head">
        <span>{pct === 100 ? 'Klart' : label}</span>
        <span className="num">{pct} %</span>
      </div>
      <div className="ai-progress-track">
        <div className="ai-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
