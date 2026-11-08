import { beforeEach, describe, expect, it } from 'vitest'
import { resetRateLimit } from './_lib/rateLimit'
import { dispatchDue, handleDispatch, handleTest, supabaseStore, type DueNotification, type PushStore, type Sender, type Sub } from './_lib/push'
import type { ApiRequest, Env } from './_lib/types'

const NOW = new Date('2026-11-08T20:00:30Z')
const sub = (user: string, n: number): Sub => ({ user_id: user, endpoint: `https://push.example/${user}/${n}`, p256dh: 'k', auth: 'a' })
const note = (user: string, id: string, fire: string): DueNotification => ({ user_id: user, id, title: `T ${id}`, body: 'B', fire_at: fire })

function fakeStore(due: DueNotification[], subs: Sub[]) {
  const state = { sent: [] as string[], deleted: [] as string[], subs: [...subs] }
  const store: PushStore = {
    async due() {
      return due.filter((d) => !state.sent.includes(`${d.user_id}/${d.id}`))
    },
    async subscriptions(u) {
      return state.subs.filter((s) => s.user_id === u)
    },
    async markSent(rows) {
      state.sent.push(...rows.map((r) => `${r.user_id}/${r.id}`))
    },
    async deleteSubscription(_u, endpoint) {
      state.deleted.push(endpoint)
      state.subs = state.subs.filter((s) => s.endpoint !== endpoint)
    },
  }
  return { store, state }
}

describe('dispatchDue', () => {
  it('skickar till alla användarens enheter och markerar som skickad', async () => {
    const { store, state } = fakeStore([note('u1', 'evening:2026-11-09', '2026-11-08T20:00:00Z')], [sub('u1', 1), sub('u1', 2), sub('u2', 1)])
    const sent: { to: string; payload: string }[] = []
    const send: Sender = async (s, payload) => void sent.push({ to: s.endpoint, payload })
    const r = await dispatchDue(store, send, NOW)
    expect(r).toMatchObject({ sent: 1, skipped: 0, retry: 0 })
    expect(sent.map((s) => s.to)).toEqual(['https://push.example/u1/1', 'https://push.example/u1/2'])
    expect(JSON.parse(sent[0].payload)).toMatchObject({ title: 'T evening:2026-11-09', tag: 'evening:2026-11-09' })
    expect(state.sent).toEqual(['u1/evening:2026-11-09'])
    expect((await dispatchDue(store, send, NOW)).sent).toBe(0) // skickas inte igen
  })
  it('hoppar över för gamla notiser och användare utan enheter', async () => {
    const { store, state } = fakeStore([note('u1', 'gammal', '2026-11-08T18:00:00Z'), note('u3', 'ingen-enhet', '2026-11-08T20:00:00Z')], [sub('u1', 1)])
    let calls = 0
    const r = await dispatchDue(store, async () => void calls++, NOW)
    expect(r).toMatchObject({ sent: 0, skipped: 2 })
    expect(calls).toBe(0)
    expect(state.sent).toHaveLength(2)
  })
  it('tar bort utgångna prenumerationer (410) och försöker igen vid tillfälliga fel', async () => {
    const { store, state } = fakeStore([note('u1', 'a', '2026-11-08T20:00:00Z'), note('u1', 'b', '2026-11-08T20:00:00Z')], [sub('u1', 1), sub('u1', 2)])
    const gone: Sender = async (s) => {
      if (s.endpoint.endsWith('/1')) throw Object.assign(new Error('gone'), { statusCode: 410 })
    }
    const r = await dispatchDue(store, gone, NOW)
    expect(r).toMatchObject({ sent: 2, removedSubscriptions: 1 })
    expect(state.deleted).toEqual(['https://push.example/u1/1']) // bara en gång, sedan borta
    const flaky = fakeStore([note('u1', 'c', '2026-11-08T20:00:00Z')], [sub('u1', 1)])
    const down: Sender = async () => {
      throw Object.assign(new Error('503'), { statusCode: 503 })
    }
    const r2 = await dispatchDue(flaky.store, down, NOW)
    expect(r2).toMatchObject({ retry: 1, sent: 0 })
    expect(flaky.state.sent).toEqual([]) // osänd, nästa minut försöks igen
  })
})

const env: Env = {
  SUPABASE_URL: 'https://x.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  VAPID_PUBLIC_KEY: 'pub',
  VAPID_PRIVATE_KEY: 'priv',
  CRON_SECRET: 'hemlig',
  ALLOWED_EMAILS: 'me@example.com',
}
const req = (over: Partial<ApiRequest> = {}): ApiRequest => ({ method: 'POST', headers: { authorization: 'Bearer hemlig' }, body: {}, ip: '1.1.1.1', ...over })

beforeEach(() => resetRateLimit())

describe('handleDispatch', () => {
  it('kräver rätt hemlighet och komplett konfiguration', async () => {
    const { store } = fakeStore([], [])
    const deps = { store, send: async () => {}, now: NOW }
    expect((await handleDispatch(req({ headers: {} }), env, deps)).status).toBe(401)
    expect((await handleDispatch(req({ headers: { authorization: 'Bearer fel' } }), env, deps)).status).toBe(401)
    expect((await handleDispatch(req({ headers: { 'x-cron-secret': 'hemlig' } }), env, deps)).status).toBe(200)
    expect((await handleDispatch(req(), { ...env, CRON_SECRET: undefined }, deps)).status).toBe(401)
    expect((await handleDispatch(req(), { ...env, VAPID_PRIVATE_KEY: undefined }, deps)).status).toBe(500)
    expect((await handleDispatch(req({ method: 'PUT' }), env, deps)).status).toBe(405)
  })
})

describe('handleTest', () => {
  const authFetch = (async (url: string) => new Response(JSON.stringify({ id: 'u1', email: 'me@example.com' }), { status: String(url).includes('/auth/v1/user') ? 200 : 404 })) as unknown as typeof fetch
  it('skickar testnotis till den inloggades enheter', async () => {
    const { store } = fakeStore([], [sub('u1', 1), sub('u2', 1)])
    const sent: string[] = []
    const r = await handleTest(req({ headers: { authorization: 'Bearer jwt' } }), env, { store, send: async (s) => void sent.push(s.endpoint), fetchFn: authFetch })
    expect(r).toMatchObject({ status: 200, body: { delivered: 1 } })
    expect(sent).toEqual(['https://push.example/u1/1'])
  })
  it('avvisar utan inloggning, och ger tydligt fel utan registrerad enhet', async () => {
    const { store } = fakeStore([], [])
    expect((await handleTest(req({ headers: {} }), env, { store, send: async () => {}, fetchFn: authFetch })).status).toBe(401)
    expect((await handleTest(req({ headers: { authorization: 'Bearer jwt' } }), env, { store, send: async () => {}, fetchFn: authFetch })).status).toBe(404)
  })
})

describe('supabaseStore', () => {
  it('bygger rätt PostgREST-frågor med service role', async () => {
    const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = []
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, method: init.method ?? 'GET', headers: init.headers as Record<string, string>, body: init.body as string | undefined })
      return new Response(init.method === 'PATCH' || init.method === 'DELETE' ? null : '[]', { status: init.method === 'GET' || !init.method ? 200 : 204 })
    }) as unknown as typeof fetch
    const store = supabaseStore(env, fetchFn)
    await store.due('2026-11-08T20:00:00.000Z', 200)
    await store.markSent([{ user_id: 'u1', id: 'evening:2026-11-09' }, { user_id: 'u1', id: 'before:2026-11-09:a' }])
    await store.deleteSubscription('u1', 'https://push.example/x?y=1')
    expect(calls[0].url).toContain('/rest/v1/notifications?select=user_id,id,title,body,fire_at&sent=eq.false&fire_at=lte.2026-11-08T20%3A00%3A00.000Z')
    expect(calls[0].headers.Authorization).toBe('Bearer service')
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: '{"sent":true}' })
    expect(decodeURIComponent(calls[1].url)).toContain('user_id=eq.u1&id=in.("evening:2026-11-09","before:2026-11-09:a")')
    expect(calls[2].method).toBe('DELETE')
    expect(calls[2].url).toContain('endpoint=eq.https%3A%2F%2Fpush.example%2Fx%3Fy%3D1')
  })
})
