import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ChatError, runChat } from '../ai/chat'
import { applyCard, cardView } from '../ai/cards'
import { loadToolContext } from '../ai/context'
import { addChatMessage, clearChat, setCardStatus } from '../db/repo'
import { Markdown } from '../components/Markdown'
import type { ChatMessage, Subject } from '../domain/types'
import { useAiConfig, useChat, useSubjects } from '../hooks'

export function mailtoUrl(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function Card({ m, subjects }: { m: ChatMessage; subjects: Subject[] }) {
  const card = m.card
  if (!card) return null
  const status = m.cardStatus ?? 'pending'
  const view = cardView(card, subjects)

  async function confirm() {
    if (!card) return
    if (card.type === 'email') {
      window.location.href = mailtoUrl(card.to, card.subject, card.body)
      await setCardStatus(m.id, 'done')
      return
    }
    await setCardStatus(m.id, await applyCard(card))
  }

  return (
    <div className="card proposal">
      <div className="sub">{view.kicker}</div>
      <div className="title">{view.title}</div>
      {view.lines.map((l, i) => <div key={i} className="sub note">{l}</div>)}
      {card.type === 'email' && <p className="note" style={{ marginTop: 8 }}>{card.body}</p>}
      {status === 'pending' ? (
        <div className="actions" style={{ marginTop: 8 }}>
          <button type="button" className={`btn ${view.danger ? 'danger' : 'primary'}`} onClick={confirm}>{view.confirmLabel}</button>
          <button type="button" className="btn" onClick={() => setCardStatus(m.id, 'dismissed')}>Avvisa</button>
        </div>
      ) : (
        <p className="sub" style={{ marginTop: 8 }}>
          {status === 'dismissed' ? 'Avvisat.' : status === 'missing' ? 'Finns inte längre, inget ändrades.' : view.doneText}
        </p>
      )}
    </div>
  )
}

export function ChatPage() {
  const config = useAiConfig()
  const messages = useChat()
  const subjects = useSubjects()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages?.length, busy, error])

  if (!config || !messages || !subjects) return null

  async function send(e: FormEvent) {
    e.preventDefault()
    const userText = text.trim()
    if (!userText || busy || !config) return
    setText('')
    setError('')
    setBusy(true)
    const history = messages ?? []
    await addChatMessage({ role: 'user', content: userText })
    try {
      const { reply, cards } = await runChat({
        apiKey: config.apiKey,
        model: config.model,
        history,
        userText,
        now: new Date(),
        loadContext: loadToolContext,
      })
      await addChatMessage({ role: 'assistant', content: reply })
      for (const card of cards) await addChatMessage({ role: 'assistant', content: '', card, cardStatus: 'pending' })
    } catch (err) {
      setError(err instanceof ChatError ? err.message : 'Något gick fel. Försök igen.')
    } finally {
      setBusy(false)
    }
  }

  if (!config.apiKey) {
    return (
      <>
        <h1>Chatt</h1>
        <p className="empty">
          Lägg in din OpenAI API-nyckel under <Link to="/installningar">Inställningar</Link> för att använda assistenten.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="chat-head">
        <h1>Chatt</h1>
        {messages.length > 0 && (
          <button type="button" className="btn" onClick={() => confirm('Rensa hela chatten?') && clearChat()}>Rensa</button>
        )}
      </div>

      <div className="chat" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty">Fråga t.ex. "Vad har jag på schemat idag?", "Vad ska jag ta med imorgon?" eller "Skriv ett mejl till Anna om läxan".</p>
        )}
        {messages.map((m) =>
          m.card ? (
            <Card key={m.id} m={m} subjects={subjects} />
          ) : (
            <div key={m.id} className={`bubble ${m.role}`}>{m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}</div>
          ),
        )}
        {busy && <div className="bubble assistant muted">Tänker…</div>}
        {error && <p className="error" role="alert">{error}</p>}
        <div ref={endRef} className="chat-end" />
      </div>

      <form className="composer" onSubmit={send}>
        <textarea
          rows={1}
          aria-label="Meddelande"
          placeholder="Skriv till assistenten"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
        />
        <button type="submit" className="btn primary" disabled={busy || !text.trim()}>Skicka</button>
      </form>
    </>
  )
}
