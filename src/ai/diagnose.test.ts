import { describe, expect, it } from 'vitest'
import { diagnose } from './diagnose'

type Health = { openaiKeyConfigured: boolean; appPasswordConfigured: boolean; supabaseConfigured: boolean; openAccess?: boolean; openai: { ok: boolean; status: number; code?: string } | null }
const good: Health = { openaiKeyConfigured: true, appPasswordConfigured: true, supabaseConfigured: false, openai: { ok: true, status: 200 } }
const server = (health: Health | number, modelsStatus = 200) =>
  (async (url: string) => {
    if (String(url).includes('/api/health')) return typeof health === 'number' ? new Response('{}', { status: health }) : new Response(JSON.stringify(health))
    return new Response('{}', { status: modelsStatus })
  }) as unknown as typeof fetch

describe('diagnose', () => {
  it('pekar ut rätt problem i rätt ordning', async () => {
    expect((await diagnose({ 'x-app-password': 'a' }, server(404))).message).toMatch(/inte deployad/)
    expect((await diagnose({ 'x-app-password': 'a' }, server(500))).message).toMatch(/Logs/)
    expect((await diagnose({}, server({ ...good, openaiKeyConfigured: false, openai: null }))).message).toMatch(/OPENAI_API_KEY/)
    expect((await diagnose({}, server({ ...good, openai: { ok: false, status: 401, code: 'invalid_api_key' } }))).message).toMatch(/avvisar nyckeln/)
    expect((await diagnose({}, server({ ...good, openai: { ok: false, status: 429, code: 'insufficient_quota' } }))).message).toMatch(/tegoder/)
    expect(await diagnose({}, server({ ...good, appPasswordConfigured: false, openAccess: true }))).toMatchObject({ ok: true, message: expect.stringContaining('åtkomsten är öppen') })
    expect((await diagnose({}, server(good))).message).toMatch(/servern kräver ett lösenord/)
    expect((await diagnose({ 'x-app-password': 'fel' }, server(good, 401))).message).toMatch(/stämmer inte/)
    expect((await diagnose({ Authorization: 'Bearer x' }, server(good, 403))).message).toMatch(/ALLOWED_EMAILS/)
  })
  it('varnar om en OpenAI-nyckel sparats som lösenord', async () => {
    expect((await diagnose({ 'x-app-password': 'sk-proj-abcdefghijklmnopqrstuvwxyz' }, server(good))).message).toMatch(/ser ut som en OpenAI-nyckel/)
  })
  it('rapporterar ok när allt fungerar, och nätfel begripligt', async () => {
    expect(await diagnose({ 'x-app-password': 'a' }, server(good))).toMatchObject({ ok: true })
    const offline = (async () => { throw new TypeError('x') }) as unknown as typeof fetch
    expect((await diagnose({}, offline)).message).toMatch(/Kunde inte nå servern/)
  })
})
