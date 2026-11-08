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
