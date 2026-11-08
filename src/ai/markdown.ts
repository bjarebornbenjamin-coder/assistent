/** Liten, säker markdown-parser: fet, kursiv, kod, rubriker, listor och stycken. Ingen rå HTML. */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold' | 'italic' | 'code'; v: string }

export type Block =
  | { t: 'p'; lines: Inline[][] }
  | { t: 'h'; inline: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][] }

const INLINE = /(\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|\*([^*\s][^*]*?)\*|(?<![A-Za-z0-9])_([^_\s][^_]*?)_(?![A-Za-z0-9]))/g

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of src.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) })
    if (m[2] !== undefined) out.push({ t: 'bold', v: m[2] })
    else if (m[3] !== undefined) out.push({ t: 'bold', v: m[3] })
    else if (m[4] !== undefined) out.push({ t: 'code', v: m[4] })
    else out.push({ t: 'italic', v: (m[5] ?? m[6])! })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) })
  return out
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let para: Inline[][] | null = null
  let list: { t: 'ul' | 'ol'; items: Inline[][] } | null = null

  const flush = () => {
    if (para) blocks.push({ t: 'p', lines: para })
    if (list) blocks.push(list)
    para = null
    list = null
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      flush()
      continue
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ t: 'h', inline: parseInline(heading[1]) })
      continue
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line)
    const item = bullet ?? numbered
    if (item) {
      const kind = bullet ? 'ul' : 'ol'
      if (para || (list && list.t !== kind)) flush()
      list ??= { t: kind, items: [] }
      list.items.push(parseInline(item[1]))
      continue
    }
    if (list) flush()
    para ??= []
    para.push(parseInline(line.trim()))
  }
  flush()
  return blocks
}
