import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown'

describe('markdown', () => {
  it('fet, kursiv och kod', () => {
    expect(parseInline('**Ämne:** Matte och *kursivt* och `kod`')).toEqual([
      { t: 'bold', v: 'Ämne:' },
      { t: 'text', v: ' Matte och ' },
      { t: 'italic', v: 'kursivt' },
      { t: 'text', v: ' och ' },
      { t: 'code', v: 'kod' },
    ])
  })
  it('rör inte vanliga understreck och asterisker i text', () => {
    expect(parseInline('snake_case_namn och 2 * 3')).toEqual([{ t: 'text', v: 'snake_case_namn och 2 * 3' }])
  })
  it('listor, stycken och radbrytningar', () => {
    const b = parseMarkdown('Hej\nrad två\n\n- Matte\n- **Svenska**\n\n1. ett\n2. två')
    expect(b[0]).toMatchObject({ t: 'p', lines: [[{ t: 'text', v: 'Hej' }], [{ t: 'text', v: 'rad två' }]] })
    expect(b[1]).toMatchObject({ t: 'ul', items: [[{ t: 'text', v: 'Matte' }], [{ t: 'bold', v: 'Svenska' }]] })
    expect(b[2]).toMatchObject({ t: 'ol' })
    expect((b[2] as { items: unknown[] }).items).toHaveLength(2)
  })
  it('lista direkt efter text och rubriker', () => {
    const b = parseMarkdown('Du har:\n- Matte\n### Rubrik')
    expect(b.map((x) => x.t)).toEqual(['p', 'ul', 'h'])
  })
  it('lämnar HTML som ren text (renderas aldrig som HTML)', () => {
    expect(parseMarkdown('<img src=x onerror=alert(1)>')).toEqual([
      { t: 'p', lines: [[{ t: 'text', v: '<img src=x onerror=alert(1)>' }]] },
    ])
  })
})

describe('listor som modellen skriver', () => {
  it('tomrader mellan numrerade punkter ger EN lista, inte flera som alla börjar på 1', () => {
    const b = parseMarkdown('Förslag:\n\n1. Omelett\n\n2. Fil med bär\n\n3. Smörgås')
    expect(b.map((x) => x.t)).toEqual(['p', 'ol'])
    expect((b[1] as { items: unknown[] }).items).toHaveLength(3)
  })
  it('underpunkter hamnar under sin punkt, och numrering kan börja på annat än 1', () => {
    const b = parseMarkdown('1. Lektioner\n   - Matte 08:00\n   - Svenska 10:00\n2. Uppgifter\n   - Läxa')
    const list = b[0] as { t: string; items: unknown[]; subs: unknown[][] }
    expect(list.t).toBe('ol')
    expect(list.items).toHaveLength(2)
    expect(list.subs[0]).toHaveLength(2)
    expect(list.subs[1]).toHaveLength(1)
    expect(parseMarkdown('3. tre\n4. fyra')[0]).toMatchObject({ t: 'ol', start: 3 })
  })
  it('text efter en lista med tomrad blir ett nytt stycke', () => {
    expect(parseMarkdown('- a\n- b\n\nSlut.').map((x) => x.t)).toEqual(['ul', 'p'])
  })
})

describe('länkar', async () => {
  const { parseInline } = await import('./markdown')
  const { recipeSearchUrl } = await import('../domain/recipeLink')
  const { keepLinks } = await import('./chat')
  it('https-länkar och recept:-länkar blir länkar', () => {
    expect(parseInline('Se [Öppna receptet](https://www.ica.se/recept/carbonara-1/).')).toEqual([
      { t: 'text', v: 'Se ' },
      { t: 'link', v: 'Öppna receptet', href: 'https://www.ica.se/recept/carbonara-1/' },
      { t: 'text', v: '.' },
    ])
    expect(parseInline('[Sök](recept:Pasta carbonara)')).toEqual([{ t: 'link', v: 'Sök', href: recipeSearchUrl('Pasta carbonara') }])
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ t: 'text', v: '[x](javascript:alert(1))' }])
  })
  it('assistentens svar behåller bara länkar som kom från receptsökningen', () => {
    const allowed = new Set(['https://www.ica.se/recept/a/'])
    expect(keepLinks('[A](https://www.ica.se/recept/a/) och [B](https://www.ica.se/recept/gissad/)', allowed)).toBe('[A](https://www.ica.se/recept/a/) och B')
  })
})
