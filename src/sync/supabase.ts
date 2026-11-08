import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import type { OutRow, Remote, RemoteRow } from './engine'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const syncConfigured = Boolean(url && anon)

export const supabase: SupabaseClient | null = syncConfigured
  ? createClient(url!, anon!, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

const PAGE = 1000

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client
          .from('records')
          .select('collection,id,data,deleted,updated_at')
          .order('updated_at')
          .order('collection')
          .order('id')
          .range(from, from + PAGE - 1)
        if (since) q = q.gte('updated_at', since)
        const { data, error } = await q
        if (error) throw new Error(error.message)
        out.push(...(data as RemoteRow[]))
        if (data.length < PAGE) return out
      }
    },
    async push(rows: OutRow[]) {
      const { error } = await client
        .from('records')
        .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,collection,id' })
      if (error) throw new Error(error.message)
    },
  }
}

/** Aktuell inloggning, eller null. */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export async function currentAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}
