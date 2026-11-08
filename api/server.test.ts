import { beforeEach, describe, expect, it } from 'vitest'
import { handleChat, handleModels, sanitizeChatBody } from './_lib/openai'
import { resetRateLimit } from './_lib/rateLimit'
import type { ApiRequest, Env } from './_lib/types'

const env: Env = { OPENAI_API_KEY: 'sk-server', APP_PASSWORD: 'hemligt', ALLOWED_EMAILS: 'Me@Example.com', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }
const req = (over: Partial<ApiRequest> = {}): ApiRequest => ({
  method: 'POST',
  headers: { 'x-app-password': 'hemligt' },
  body: { model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hej' }], secret: 'ska inte skickas vidare', stream: true },
  ip: '1.2.3.4',
  ...over,
})
const upstream = (calls: { url: string; init: RequestInit }[], status = 200, body: unknown = { choices: [{ message: { content: 'ok' } }] }) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch

beforeEach(() => resetRateLimit())

describe('/api/chat', () => {
  it('vidarebefordrar med serverns nyckel och släpper bara igenom tillåtna fält', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const res = await handleChat(req(), env, upstream(calls))
    expect(res.status).toBe(200)
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer sk-server')
    const sent = JSON.parse(calls[0].init.body as string)
    expect(Object.keys(sent).sort()).toEqual(['messages', 'model'])
  })
  it('avvisar fel, saknat lösenord och saknad konfiguration', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    expect((await handleChat(req({ headers: { 'x-app-password': 'fel' } }), env, upstream(calls))).status).toBe(401)
    expect((await handleChat(req({ headers: {} }), env, upstream(calls))).status).toBe(401)
    expect((await handleChat(req(), { ...env, OPENAI_API_KEY: undefined }, upstream(calls))).status).toBe(500)
    expect((await handleChat(req(), { OPENAI_API_KEY: 'k' }, upstream(calls))).status).toBe(500)
    expect((await handleChat(req({ method: 'GET' }), env, upstream(calls))).status).toBe(405)
    expect(calls).toHaveLength(0) // ingenting nådde OpenAI
  })
  it('rate limiting ger 429 med Retry-After', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    const e = { ...env, RATE_LIMIT_PER_MIN: '2' }
    expect((await handleChat(req(), e, upstream(calls))).status).toBe(200)
    expect((await handleChat(req(), e, upstream(calls))).status).toBe(200)
    const third = await handleChat(req(), e, upstream(calls))
    expect(third.status).toBe(429)
    expect(Number(third.headers?.['Retry-After'])).toBeGreaterThan(0)
    expect(calls).toHaveLength(2)
  })
  it('skickar OpenAI-fel vidare med samma status', async () => {
    const res = await handleChat(req(), env, upstream([], 404, { error: { message: 'model_not_found' } }))
    expect(res).toMatchObject({ status: 404, body: { error: { message: 'model_not_found' } } })
  })
  it('validerar förfrågan', () => {
    expect(sanitizeChatBody({ model: 'a b', messages: [{}] }).ok).toBe(false)
    expect(sanitizeChatBody({ model: 'gpt-4o', messages: [] }).ok).toBe(false)
    expect(sanitizeChatBody({ model: 'gpt-4o', messages: [{ role: 'user', content: 'x'.repeat(4_100_000) }] }).ok).toBe(false)
    expect(sanitizeChatBody({ model: 'gpt-4o', messages: [{}], tools: [], response_format: { type: 'json_object' } })).toMatchObject({ ok: true })
  })
})

describe('Supabase-inloggning på servern', () => {
  const bearer = { authorization: 'Bearer jwt' }
  const supa = (status: number, body: unknown) => (async (url: string) => (String(url).includes('/auth/v1/user') ? new Response(JSON.stringify(body), { status }) : new Response(JSON.stringify({ choices: [] })))) as unknown as typeof fetch
  it('släpper in tillåten e-post (skiftlägesokänsligt) men inte andra eller ogiltiga tokens', async () => {
    expect((await handleChat(req({ headers: bearer }), env, supa(200, { id: 'u1', email: 'me@example.com' }))).status).toBe(200)
    expect((await handleChat(req({ headers: bearer }), env, supa(200, { id: 'u2', email: 'annan@example.com' }))).status).toBe(403)
    expect((await handleChat(req({ headers: bearer }), env, supa(401, {}))).status).toBe(401)
    expect((await handleChat(req({ headers: bearer }), { ...env, ALLOWED_EMAILS: '' }, supa(200, { id: 'u1', email: 'me@example.com' }))).status).toBe(403)
  })
})

describe('/api/models', () => {
  it('kräver GET och inloggning', async () => {
    const calls: { url: string; init: RequestInit }[] = []
    expect((await handleModels(req({ method: 'GET' }), env, upstream(calls, 200, { data: [] }))).status).toBe(200)
    expect(calls[0].url).toBe('https://api.openai.com/v1/models')
    expect((await handleModels(req({ method: 'GET', headers: {} }), env, upstream(calls))).status).toBe(401)
    expect((await handleModels(req({ method: 'POST' }), env, upstream(calls))).status).toBe(405)
  })
})
