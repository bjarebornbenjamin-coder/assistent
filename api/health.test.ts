import { describe, expect, it } from 'vitest'
import { handleHealth } from './_lib/health.js'
import type { ApiRequest } from './_lib/types.js'

const req = (method = 'GET'): ApiRequest => ({ method, headers: {}, body: undefined, ip: '1.1.1.1' })
const fakeFetch = (status: number, body: unknown = {}) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

describe('/api/health', () => {
  it('visar vad som är satt utan att avslöja värden', async () => {
    const r = await handleHealth(req(), { OPENAI_API_KEY: 'sk-hemlig', APP_PASSWORD: 'lösen' }, fakeFetch(200))
    expect(r.body).toEqual({ openaiKeyConfigured: true, appPasswordConfigured: true, supabaseConfigured: false, openAccess: false, openai: { ok: true, status: 200, code: undefined } })
    expect(JSON.stringify(r.body)).not.toContain('sk-hemlig')
    expect(JSON.stringify(r.body)).not.toContain('lösen"')
  })
  it('markerar öppen åtkomst när varken lösenord eller inloggning är satt', async () => {
    expect((await handleHealth(req(), { OPENAI_API_KEY: 'x' }, fakeFetch(200))).body).toMatchObject({ openAccess: true })
    expect((await handleHealth(req(), { OPENAI_API_KEY: 'x', APP_PASSWORD: 'p' }, fakeFetch(200))).body).toMatchObject({ openAccess: false })
  })
  it('saknad nyckel anropar inte OpenAI', async () => {
    let called = false
    const f = (async () => { called = true; return new Response('{}') }) as unknown as typeof fetch
    const r = await handleHealth(req(), {}, f)
    expect(r.body).toMatchObject({ openaiKeyConfigured: false, openai: null })
    expect(called).toBe(false)
  })
  it('rapporterar OpenAI-felkoder (ogiltig nyckel, slut på tegoder, nätfel)', async () => {
    expect((await handleHealth(req(), { OPENAI_API_KEY: 'x' }, fakeFetch(401, { error: { code: 'invalid_api_key', message: 'Incorrect API key provided: sk-abc***' } }))).body).toMatchObject({ openai: { ok: false, status: 401, code: 'invalid_api_key' } })
    expect((await handleHealth(req(), { OPENAI_API_KEY: 'x' }, fakeFetch(429, { error: { code: 'insufficient_quota' } }))).body).toMatchObject({ openai: { code: 'insufficient_quota' } })
    const down = (async () => { throw new Error('x') }) as unknown as typeof fetch
    expect((await handleHealth(req(), { OPENAI_API_KEY: 'x' }, down)).body).toMatchObject({ openai: { ok: false, code: 'unreachable' } })
    expect((await handleHealth(req('POST'), {}, fakeFetch(200))).status).toBe(405)
  })
})
