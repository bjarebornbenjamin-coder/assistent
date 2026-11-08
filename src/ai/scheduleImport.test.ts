import { describe, expect, it } from 'vitest'
import { ChatError } from './chat'
import { analyzeRows, buildMessages, normalizeTime, parseImportResponse, readScheduleImage, type ImportRow } from './scheduleImport'

describe('parseImportResponse', () => {
  it('tolkar rimliga varianter av veckodag, tid och vecka', () => {
    const json = JSON.stringify({
      lessons: [
        { subject: ' Spanska ', weekday: 'Måndag', start: '8.20', end: '9:40', room: 'A1', teacher: 'Rosa', week: null },
        { subject: 'Matte', weekday: 'tors', start: '10:00', end: '11:00', room: '', teacher: '', week: 'B' },
        { subject: 'Idrott', weekday: 5, start: '1300', end: '14:00' },
      ],
    })
    const { rows, skipped } = parseImportResponse(json, 2)
    expect(skipped).toBe(0)
    expect(rows[0]).toMatchObject({ subject: 'Spanska', weekday: 1, start: '08:20', end: '09:40', room: 'A1', week: null })
    expect(rows[1]).toMatchObject({ weekday: 4, week: 1 })
    expect(rows[2]).toMatchObject({ weekday: 5 })
    expect(rows[2].start).toBe('13:00')
  })
  it('hoppar över ogiltiga lektioner, och ignorerar vecka som inte finns i cykeln', () => {
    const { rows, skipped } = parseImportResponse(
      JSON.stringify([{ subject: 'A', weekday: 1, start: '09:00', end: '08:00' }, { subject: '', weekday: 1, start: '08:00', end: '09:00' }, { subject: 'B', weekday: 9, start: '08:00', end: '09:00' }, { subject: 'C', weekday: 2, start: '08:00', end: '09:00', week: 'B' }]),
      1,
    )
    expect(skipped).toBe(3)
    expect(rows).toHaveLength(1)
    expect(rows[0].week).toBeNull()
  })
  it('klarar kodstaket runt JSON och kastar begripligt fel på skräp', () => {
    expect(parseImportResponse('```json\n{"lessons":[]}\n```', 1).rows).toEqual([])
    expect(() => parseImportResponse('Här är schemat!', 1)).toThrow(ChatError)
    expect(() => parseImportResponse('{"annat":1}', 1)).toThrow(/inga lektioner/)
  })
  it('normalizeTime', () => {
    expect(['7:5', '25:00', '08:20', '8.20', 'x', 830].map(normalizeTime)).toEqual([null, null, '08:20', '08:20', null, null])
  })
})

describe('analyzeRows', () => {
  const subjects = [{ id: 'es', name: 'Spanska', packItems: [] }]
  const existing = [{ id: 'l1', subjectId: 'es', weekday: 1, start: '08:20', end: '09:40', room: '', teacher: '', weeks: null }]
  const row = (key: string, over: Partial<ImportRow> = {}): ImportRow => ({ key, subject: 'Spanska', weekday: 1, start: '08:20', end: '09:40', room: '', teacher: '', week: null, include: true, ...over })
  it('hittar dubbletter, krockar med befintligt och mellan nya rader', () => {
    const rows = [row('a'), row('b', { subject: 'Matte', start: '09:00', end: '10:00' }), row('c', { subject: 'Idrott', start: '09:30', end: '10:30' }), row('d', { subject: '', start: '11:00', end: '10:00' })]
    const s = analyzeRows(rows, existing, subjects, 1)
    expect(s.get('a')).toMatchObject({ duplicate: true, conflicts: [] }) // dubbletten räknas inte som krock med sin förlaga
    expect(s.get('b')).toMatchObject({ duplicate: false, valid: true })
    expect(s.get('b')?.conflicts).toEqual(expect.arrayContaining(['Spanska 08:20–09:40', 'Idrott 09:30–10:30 (ny)']))
    expect(s.get('d')?.valid).toBe(false)
  })
})

describe('readScheduleImage', () => {
  it('skickar bilden till servern med JSON-läge och inloggning, och returnerar svaret', async () => {
    let sent: { url: string; init: RequestInit } | undefined
    const fetchFn = (async (url: string, init: RequestInit) => {
      sent = { url, init }
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"lessons":[]}' } }] }))
    }) as unknown as typeof fetch
    const text = await readScheduleImage('data:image/jpeg;base64,AAA', 'gpt-4o-mini', { 'x-app-password': 'pw' }, fetchFn)
    expect(text).toBe('{"lessons":[]}')
    expect(sent?.url).toBe('/api/chat')
    const body = JSON.parse(sent!.init.body as string)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/jpeg;base64,AAA')
    expect(buildMessages('x')[0].role).toBe('system')
    const bad = (async () => new Response('{}', { status: 401 })) as unknown as typeof fetch
    await expect(readScheduleImage('x', 'm', {}, bad)).rejects.toThrow(/lösenord/i)
  })
})
