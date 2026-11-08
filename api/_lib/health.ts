import { errorBody, json, type ApiRequest, type ApiResponse, type Env, type FetchFn } from './types.js'

export interface Health {
  openaiKeyConfigured: boolean
  appPasswordConfigured: boolean
  supabaseConfigured: boolean
  /** Inget lösenord eller inloggning krävs: alla med adressen kan använda nyckeln. */
  openAccess: boolean
  /** Resultat av ett riktigt anrop till OpenAI med serverns nyckel (null om nyckel saknas). */
  openai: { ok: boolean; status: number; code?: string } | null
}

/** Visar bara om saker är satta och om OpenAI godtar nyckeln. Aldrig själva värdena. */
export async function handleHealth(req: ApiRequest, env: Env, fetchFn: FetchFn = fetch): Promise<ApiResponse> {
  if (req.method !== 'GET') return errorBody(405, 'Metoden stöds inte.')
  const health: Health = {
    openaiKeyConfigured: Boolean(env.OPENAI_API_KEY),
    appPasswordConfigured: Boolean(env.APP_PASSWORD),
    supabaseConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY),
    openAccess: !env.APP_PASSWORD && !env.SUPABASE_URL,
    openai: null,
  }
  if (env.OPENAI_API_KEY) {
    try {
      const res = await fetchFn('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` } })
      let code: string | undefined
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; type?: string } }
        code = body.error?.code ?? body.error?.type ?? undefined
      }
      health.openai = { ok: res.ok, status: res.status, code }
    } catch {
      health.openai = { ok: false, status: 0, code: 'unreachable' }
    }
  }
  return json(200, health, { 'Cache-Control': 'no-store' })
}
