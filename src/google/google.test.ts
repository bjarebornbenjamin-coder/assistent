import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { readState, syncGoogle } from './google'
import { fromGoogle } from './map'

describe('Google-händelser', () => {
  it('heldag över flera dagar blir en per dag, tider blir lokala, inställda hoppas över', () => {
    const list = fromGoogle('primary', [
      { id: 'a', summary: 'Sportlov', start: { date: '2026-11-10' }, end: { date: '2026-11-12' } },
      { id: 'b', summary: 'Tandläkare', location: 'Folktandvården', start: { dateTime: '2026-11-10T14:00:00' }, end: { dateTime: '2026-11-10T14:45:00' }, htmlLink: 'https://calendar.google.com/x' },
      { id: 'c', summary: 'Inställt', status: 'cancelled', start: { date: '2026-11-10' } },
      { id: 'd', start: { dateTime: '2026-11-10T23:00:00' }, end: { dateTime: '2026-11-11T01:00:00' } },
    ])
    expect(list.map((e) => [e.id, e.date, e.start, e.end, e.title])).toEqual([
      ['g:primary:a:2026-11-10', '2026-11-10', undefined, undefined, 'Sportlov'],
      ['g:primary:a:2026-11-11', '2026-11-11', undefined, undefined, 'Sportlov'],
      ['g:primary:b', '2026-11-10', '14:00', '14:45', 'Tandläkare'],
      ['g:primary:d', '2026-11-10', '23:00', undefined, '(Utan titel)'],
    ])
    expect(list[2]).toMatchObject({ source: 'google', note: 'Folktandvården', link: 'https://calendar.google.com/x' })
  })
})

describe('syncGoogle', () => {
  beforeEach(async () => {
    await db.events.clear()
    await db.local.clear()
  })

  const fakeFetch = (events: unknown[]) =>
    (async (url: string) => {
      if (url.includes('calendarList')) return new Response(JSON.stringify({ items: [{ id: 'primary', summary: 'Min kalender', primary: true }, { id: 'x', summary: 'Dold', selected: false }] }))
      return new Response(JSON.stringify({ items: events }))
    }) as unknown as typeof fetch

  it('ersätter tidigare hämtade händelser men rör inte appens egna', async () => {
    await db.events.put({ id: 'own', title: 'Egen', date: '2026-11-10', note: '', updatedAt: '' })
    const now = new Date('2026-11-09T12:00:00')
    await syncGoogle('t', now, fakeFetch([{ id: 'a', summary: 'Möte', start: { dateTime: '2026-11-10T10:00:00' } }, { id: 'b', summary: 'Gammal', start: { date: '2026-11-11' } }]))
    const first = await db.events.get('g:primary:a')
    await syncGoogle('t', new Date('2026-11-09T13:00:00'), fakeFetch([{ id: 'a', summary: 'Möte', start: { dateTime: '2026-11-10T10:00:00' } }]))
    const ids = (await db.events.toArray()).map((e) => e.id).sort()
    expect(ids).toEqual(['g:primary:a', 'own'])
    expect((await db.events.get('g:primary:a'))!.updatedAt).toBe(first!.updatedAt) // oförändrad skickas inte om
    expect(await readState()).toMatchObject({ connected: true, count: 1, calendars: ['Min kalender'] })
  })

  it('utgången inloggning ger ett begripligt fel', async () => {
    const f = (async () => new Response('', { status: 401 })) as unknown as typeof fetch
    await expect(syncGoogle('t', new Date(), f)).rejects.toThrow(/gått ut/)
  })
})
