import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { db } from '../db/db'

/** Bakgrundsbilden sparas bara på den här enheten (bilder är för stora för synk och export). */
export interface Background {
  image: string | null
  /** Hur mycket av appens bakgrundsfärg som ligger över bilden, 0.3–0.95. Högre = lugnare och mer lättläst. */
  veil: number
}

export const DEFAULT_VEIL = 0.72

export async function getBackground(): Promise<Background> {
  const [image, veil] = await Promise.all([db.local.get('bg-image'), db.local.get('bg-veil')])
  const v = Number(veil?.value)
  return { image: image?.value || null, veil: Number.isFinite(v) && v >= 0.3 && v <= 0.95 ? v : DEFAULT_VEIL }
}

export async function setBackgroundImage(dataUrl: string | null): Promise<void> {
  if (dataUrl === null) await db.local.delete('bg-image')
  else await db.local.put({ key: 'bg-image', value: dataUrl, updatedAt: new Date().toISOString() })
}

export async function setBackgroundVeil(veil: number): Promise<void> {
  await db.local.put({ key: 'bg-veil', value: String(Math.min(0.95, Math.max(0.3, veil))), updatedAt: new Date().toISOString() })
}

export function useBackground(): Background | undefined {
  return useLiveQuery(() => getBackground(), [])
}

/** Lägger bilden och hinnan som CSS-variabler på <html>, så att stilmallen kan rita bakgrunden. */
export function useApplyBackground(): void {
  const bg = useBackground()
  useEffect(() => {
    const root = document.documentElement
    if (bg?.image) {
      root.style.setProperty('--bg-image', `url("${bg.image}")`)
      root.style.setProperty('--bg-veil', String(bg.veil))
      root.dataset.bgImage = 'on'
    } else {
      root.style.removeProperty('--bg-image')
      root.style.removeProperty('--bg-veil')
      delete root.dataset.bgImage
    }
  }, [bg?.image, bg?.veil])
}
