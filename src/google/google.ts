import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { addDays, toISODate } from '../domain/dates'
import type { CalendarEvent } from '../domain/types'
import { fromGoogle, type GoogleEvent } from './map'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ''
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'
const API = 'https://www.googleapis.com/calendar/v3'
const TOKEN_KEY = 'google-token'
const STATE_KEY = 'google'
/** Hur långt bakåt och framåt som hämtas. */
const PAST_DAYS = 30
const FUTURE_DAYS = 120
const AUTO_SYNC_MS = 15 * 60_000

export interface GoogleState {
  connected: boolean
  lastSync?: string
  count?: number
  calendars?: string[]
}

interface TokenClient {
  requestAccessToken(o?: { prompt?: string }): void
}
interface Gis {
  accounts: {
    oauth2: {
      initTokenClient(o: { client_id: string; scope: string; callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void; error_callback?: (e: { type?: string }) => void }): TokenClient
      revoke(token: string, done?: () => void): void
    }
  }
}

let gisPromise: Promise<Gis> | null = null
function loadGis(): Promise<Gis> {
  const w = window as unknown as { google?: Gis }
  if (w.google?.accounts?.oauth2) return Promise.resolve(w.google)
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (w.google ? resolve(w.google) : reject(new Error('Googles inloggning laddades inte.')))
    s.onerror = () => {
      gisPromise = null
      reject(new Error('Kunde inte ladda Googles inloggning. Kontrollera internetanslutningen.'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** Token sparas bara för fliken (sessionStorage) och gäller i ungefär en timme. */
function storedToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const t = JSON.parse(raw) as { token: string; expiresAt: number }
    return t.expiresAt > Date.now() + 60_000 ? t.token : null
  } catch {
    return null
  }
}

/** Ber Google om åtkomst. Måste anropas från ett tryck, annars blockeras rutan. */
export async function requestToken(prompt: '' | 'consent'): Promise<string> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Kalender är inte inställt (VITE_GOOGLE_CLIENT_ID saknas).')
  const gis = await loadGis()
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (!r.access_token) return reject(new Error(r.error === 'access_denied' ? 'Du nekade åtkomst.' : 'Google gav ingen åtkomst.'))
        try {
          sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 }))
        } catch {
          /* fungerar ändå, bara utan att komma ihåg token */
        }
        resolve(r.access_token)
      },
      error_callback: (e) => reject(new Error(e.type === 'popup_closed' ? 'Inloggningsrutan stängdes.' : 'Kunde inte öppna Googles inloggning. Tillåt popup-fönster.')),
    })
    client.requestAccessToken({ prompt })
  })
}

async function getJson<T>(url: string, token: string, fetchFn: typeof fetch): Promise<T> {
  const res = await fetchFn(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    try {
      sessionStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignorera */
    }
    throw new Error('Inloggningen hos Google har gått ut. Tryck på Hämta från Google igen.')
  }
  if (!res.ok) throw new Error(`Google svarade med fel ${res.status}.`)
  return (await res.json()) as T
}

export async function readState(): Promise<GoogleState> {
  const row = await db.local.get(STATE_KEY)
  try {
    return row ? (JSON.parse(row.value) as GoogleState) : { connected: false }
  } catch {
    return { connected: false }
  }
}

async function writeState(s: GoogleState): Promise<void> {
  await db.local.put({ key: STATE_KEY, value: JSON.stringify(s), updatedAt: new Date().toISOString() })
}

export function useGoogleState(): GoogleState | undefined {
  return useLiveQuery(readState, [])
}

const same = (a: CalendarEvent, b: CalendarEvent) => JSON.stringify({ ...a, updatedAt: '' }) === JSON.stringify({ ...b, updatedAt: '' })

/**
 * Hämtar händelser från de kalendrar som är markerade i Google och ersätter de tidigare hämtade.
 * Oförändrade händelser behåller sin tidsstämpel så att synken inte skickar om dem.
 */
export async function syncGoogle(token: string, now = new Date(), fetchFn: typeof fetch = fetch): Promise<number> {
  const list = await getJson<{ items?: { id: string; summary?: string; selected?: boolean; primary?: boolean }[] }>(`${API}/users/me/calendarList?minAccessRole=reader`, token, fetchFn)
  const calendars = (list.items ?? []).filter((c) => c.selected || c.primary)
  const today = toISODate(now)
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
    timeMin: new Date(`${addDays(today, -PAST_DAYS)}T00:00:00`).toISOString(),
    timeMax: new Date(`${addDays(today, FUTURE_DAYS)}T00:00:00`).toISOString(),
  })
  const fetched: CalendarEvent[] = []
  for (const c of calendars.slice(0, 10)) {
    const data = await getJson<{ items?: GoogleEvent[] }>(`${API}/calendars/${encodeURIComponent(c.id)}/events?${params}`, token, fetchFn)
    fetched.push(...fromGoogle(c.id, data.items ?? [], now))
  }
  await db.transaction('rw', db.events, async () => {
    const old = (await db.events.toArray()).filter((e) => e.source === 'google')
    const byId = new Map(old.map((e) => [e.id, e]))
    const keep = new Set(fetched.map((e) => e.id))
    await db.events.bulkDelete(old.filter((e) => !keep.has(e.id)).map((e) => e.id))
    await db.events.bulkPut(fetched.filter((e) => !byId.has(e.id) || !same(byId.get(e.id)!, e)))
  })
  await writeState({ connected: true, lastSync: now.toISOString(), count: fetched.length, calendars: calendars.map((c) => c.summary ?? c.id) })
  return fetched.length
}

/** Kopplar, eller hämtar igen med ny inloggning. Anropas från ett tryck. */
export async function connectAndSync(first: boolean): Promise<number> {
  const token = storedToken() ?? (await requestToken(first ? 'consent' : ''))
  return syncGoogle(token)
}

export async function disconnectGoogle(): Promise<void> {
  const token = storedToken()
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignorera */
  }
  if (token) await loadGis().then((g) => g.accounts.oauth2.revoke(token)).catch(() => {})
  await db.transaction('rw', db.events, db.local, async () => {
    const ids = (await db.events.toArray()).filter((e) => e.source === 'google').map((e) => e.id)
    await db.events.bulkDelete(ids)
    await db.local.delete(STATE_KEY)
  })
}

/** Hämtar på nytt i bakgrunden när appen öppnas, så länge inloggningen från senaste trycket gäller. */
export function useGoogleAutoSync(): void {
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let running = false
    const run = async () => {
      if (running || document.visibilityState !== 'visible' || !navigator.onLine) return
      const token = storedToken()
      const state = await readState()
      if (!token || !state.connected) return
      if (state.lastSync && Date.now() - new Date(state.lastSync).getTime() < AUTO_SYNC_MS) return
      running = true
      await syncGoogle(token).catch(() => {})
      running = false
    }
    void run()
    document.addEventListener('visibilitychange', run)
    const timer = setInterval(run, AUTO_SYNC_MS)
    return () => {
      document.removeEventListener('visibilitychange', run)
      clearInterval(timer)
    }
  }, [])
}

/** "1 händelse", "3 händelser" */
export const events = (n: number) => `${n} ${n === 1 ? 'händelse' : 'händelser'}`

