import { Fragment } from 'react'
import { parseMarkdown, type Inline } from '../ai/markdown'

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.t === 'bold' ? <strong key={i}>{n.v}</strong>
        : n.t === 'italic' ? <em key={i}>{n.v}</em>
        : n.t === 'code' ? <code key={i}>{n.v}</code>
        : <Fragment key={i}>{n.v}</Fragment>,
      )}
    </>
  )
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {parseMarkdown(text).map((b, i) =>
        b.t === 'p' ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Inlines nodes={l} />
              </Fragment>
            ))}
          </p>
        ) : b.t === 'h' ? (
          <p key={i}><strong><Inlines nodes={b.inline} /></strong></p>
        ) : b.t === 'ul' ? (
          <ul key={i}>{b.items.map((it, j) => (
            <li key={j}>
              <Inlines nodes={it} />
              {b.subs?.[j] && <ul>{b.subs[j]!.map((sub, k) => <li key={k}><Inlines nodes={sub} /></li>)}</ul>}
            </li>
          ))}</ul>
        ) : (
          <ol key={i} start={b.start}>{b.items.map((it, j) => (
            <li key={j}>
              <Inlines nodes={it} />
              {b.subs?.[j] && <ul>{b.subs[j]!.map((sub, k) => <li key={k}><Inlines nodes={sub} /></li>)}</ul>}
            </li>
          ))}</ol>
        ),
      )}
    </div>
  )
}
