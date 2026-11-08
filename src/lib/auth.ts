import { getAiConfig } from '../db/repo'
import { currentAccessToken } from '../sync/supabase'

/**
 * Rubriker som identifierar användaren mot appens server: Supabase-inloggning om den finns,
 * annars lösenordet från Inställningar. Tomt om inget är inställt (servern kan vara öppen).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await currentAccessToken()
  if (token) return { Authorization: `Bearer ${token}` }
  const { password } = await getAiConfig()
  return password ? { 'x-app-password': password } : {}
}
