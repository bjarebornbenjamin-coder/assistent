/** Liten, säker markdown-parser: fet, kursiv, kod, länkar, rubriker, listor och stycken. Ingen rå HTML. */
import { resolveLink } from '../domain/recipeLink'

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold' | 'italic' | 'code'; v: string }
  | { t: 'link'; v: string; href: string }

export type Block =
  | { t: 'p'; lines: Inline[][] }
  | { t: 'h'; inline: Inline[] }
  | { t: 'ul' | 'ol'; items: Inline[][]; start?: number; subs?: (Inline[][] | undefined)[] }

const INLINE = /(\[([^\]\n]+)\]\(((?:https?:\/\/|recept:)[^)\n]+)\)|\*\*([^*]+?)\*\*|__([^_]+?)__|`([^`]+?)`|\*([^*\s][^*]*?)\*|(?<![A-Za-z0-9])_([^_\s][^_]*?)_(?![A-Za-z0-9]))/g

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of src.matchAll(INLINE)) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) })
    // Länkar som inte är tillåtna visas som vanlig text, utan adress.
    if (m[2] !== undefined) {
      const href = resolveLink(m[3].trim())
      out.push(href ? { t: 'link', v: m[2], href } : { t: 'text', v: m[2] })
    }
    else if (m[4] !== undefined) out.push({ t: 'bold', v: m[4] })
    else if (m[5] !== undefined) out.push({ t: 'bold', v: m[5] })
    else if (m[6] !== undefined) out.push({ t: 'code', v: m[6] })
    else out.push({ t: 'italic', v: (m[7] ?? m[8])! })
    last = m.index + m[0].length
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) })
  return out
}

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let para: Inline[][] | null = null
  let list: { t: 'ul' | 'ol'; items: Inline[][]; start?: number; subs: (Inline[][] | undefined)[] } | null = null
  let blankInList = false

  const flushPara = () => {
    if (para) blocks.push({ t: 'p', lines: para })
    para = null
  }
  const flushList = () => {
    if (list) blocks.push(list.subs.some(Boolean) ? list : { t: list.t, items: list.items, ...(list.start && list.start !== 1 ? { start: list.start } : {}) })
    list = null
    blankInList = false
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')
    if (line.trim() === '') {
      // En tomrad avslutar stycken, men en lista får fortsätta efter den (modeller lägger ofta tomrader mellan punkter).
      flushPara()
      if (list) blankInList = true
      continue
    }
    const indent = (/^\s*/.exec(line)?.[0].length ?? 0)
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line)
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line)
    if ((bullet || numbered) && list && indent >= 2 && list.items.length > 0) {
      // Underpunkt till föregående punkt.
      const i = list.items.length - 1
      list.subs[i] = [...(list.subs[i] ?? []), parseInline(bullet ? bullet[1] : numbered![2])]
      blankInList = false
      continue
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      flushList()
      blocks.push({ t: 'h', inline: parseInline(heading[1]) })
      continue
    }
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      flushPara()
      if (list && list.t !== kind) flushList()
      if (!list) list = { t: kind, items: [], subs: [], ...(numbered ? { start: Number(numbered[1]) } : {}) }
      list.items.push(parseInline(bullet ? bullet[1] : numbered![2]))
      list.subs.push(undefined)
      blankInList = false
      continue
    }
    if (list && blankInList) flushList()
    else if (list && indent >= 2) {
      // Fortsättningsrad till en punkt.
      list.items[list.items.length - 1] = [...list.items[list.items.length - 1], { t: 'text', v: ' ' }, ...parseInline(line.trim())]
      continue
    } else if (list) flushList()
    para ??= []
    para.push(parseInline(line.trim()))
  }
  flushPara()
  flushList()
  return blocks
}
