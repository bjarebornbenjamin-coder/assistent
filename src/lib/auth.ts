import { getAiConfig } from '../db/repo'

/** Rubriker som identifierar användaren mot appens server, eller null om inget är inställt. */
export async function authHeaders(): Promise<Record<string, string> | null> {
  const { password } = await getAiConfig()
  return password ? { 'x-app-password': password } : null
}
