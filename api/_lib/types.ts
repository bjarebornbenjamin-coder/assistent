export interface ApiRequest {
  method: string
  headers: Record<string, string | string[] | undefined>
  body: unknown
  ip: string
}

export interface ApiResponse {
  status: number
  headers?: Record<string, string>
  body: unknown
}

export interface Env {
  OPENAI_API_KEY?: string
  /** Delat lösenord som appen skickar med (x-app-password). */
  APP_PASSWORD?: string
  /** Kommaseparerade e-postadresser som får använda servern via Supabase-inloggning. */
  ALLOWED_EMAILS?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  RATE_LIMIT_PER_MIN?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
  CRON_SECRET?: string
}

export type FetchFn = typeof fetch

export const header = (req: ApiRequest, name: string): string => {
  const v = req.headers[name.toLowerCase()]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export const json = (status: number, body: unknown, headers?: Record<string, string>): ApiResponse => ({ status, body, headers })
export const errorBody = (status: number, message: string): ApiResponse => json(status, { error: { message } })
