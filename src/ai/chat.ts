import { WEEKDAYS_LONG, toHHmm, toISODate, weekdayOf } from '../domain/dates'
import type { ChatCard, ChatMessage } from '../domain/types'
import { cycleLabel, weekIndex } from '../domain/weekCycle'
import { DEFAULT_MODEL } from './models'
import { TOOL_DEFINITIONS, runTool, type ToolContext } from './tools'

const API_URL = '/api/chat'
const MAX_ROUNDS = 6
const HISTORY_LIMIT = 20

type ApiMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export class ChatError extends Error {}

export function systemPrompt(now: Date, ctx: ToolContext): string {
  const today = toISODate(now)
  const week =
    ctx.settings.cycleLength > 1
      ? ` Veckorna i schemat alternerar; denna vecka är vecka ${cycleLabel(weekIndex(today, ctx.settings.cycleAnchor, ctx.settings.cycleLength))}.`
      : ''
  return [
    'Du är en personlig assistent för en elev/student i en schema- och kalenderapp. Svara kort och på svenska.',
    `Idag är ${WEEKDAYS_LONG[weekdayOf(today) - 1]} ${today}, klockan ${toHHmm(now)}.${week}`,
    'Hämta alltid schema, packlista och händelser med verktygen och gissa aldrig. Räkna ut datum själv ("imorgon", "på fredag") och skicka dem som YYYY-MM-DD.',
    'Du kan inte lägga in, ändra, ta bort eller skicka något direkt: propose_*-verktygen och draft_email visar bara ett förslag som användaren själv bekräftar eller skickar. Säg tydligt att det är ett förslag/utkast som väntar på användaren, inte att det är gjort.',
    'Om en uppgift saknas (t.ex. vilken Anna som avses eller vad mejlet ska handla om), fråga istället för att hitta på.',
  ].join('\n')
}

interface RunOptions {
  /** Autentiseringsrubriker till appens server. */
  headers: Record<string, string>
  model: string
  history: Pick<ChatMessage, 'role' | 'content'>[]
  userText: string
  now: Date
  loadContext: () => Promise<ToolContext>
  fetchFn?: typeof fetch
}

export interface ChatResult {
  reply: string
  cards: ChatCard[]
  /** Satt om vi föll tillbaka på standardmodellen. */
  notice?: string
}

export async function describeError(res: Response): Promise<string> {
  let detail = ''
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    /* svaret var inte JSON */
  }
  if (res.status === 401) return `${detail || 'Fel lösenord.'} Kontrollera lösenordet i Inställningar.`
  if (res.status === 403) return detail || 'Du har inte åtkomst.'
  if (res.status === 429) return detail || 'För många anrop eller slut på tegoder hos OpenAI.'
  if (res.status === 404) return `Modellen hittades inte. Kontrollera modellnamnet i Inställningar.${detail ? ` ${detail}` : ''}`
  return detail ? `Servern svarade med fel ${res.status}: ${detail}` : `Servern svarade med fel ${res.status} utan förklaring. Kontrollera Vercel → Logs och att miljövariablerna är satta.`
}

export async function runChat(o: RunOptions): Promise<ChatResult> {
  const fetchFn = o.fetchFn ?? fetch
  const ctx = await o.loadContext()
  const messages: ApiMessage[] = [
    { role: 'system', content: systemPrompt(o.now, ctx) },
    ...o.history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }) as ApiMessage),
    { role: 'user', content: o.userText },
  ]
  const cards: ChatCard[] = []
  let model = o.model
  let notice: string | undefined

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let res: Response
    try {
      res = await fetchFn(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...o.headers },
        body: JSON.stringify({ model, messages, tools: TOOL_DEFINITIONS }),
      })
    } catch {
      throw new ChatError('Kunde inte nå servern. Kontrollera internetanslutningen.')
    }
    if (res.status === 404 && model !== DEFAULT_MODEL) {
      notice = `Modellen ${model} hittades inte, så jag använde ${DEFAULT_MODEL}. Byt modell i Inställningar.`
      model = DEFAULT_MODEL
      round--
      continue
    }
    if (!res.ok) throw new ChatError(await describeError(res))

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]
    }
    const msg = data.choices?.[0]?.message
    if (!msg) throw new ChatError('Oväntat svar från OpenAI.')

    if (!msg.tool_calls?.length) return { reply: (msg.content ?? '').trim() || '(Tomt svar)', cards, notice }

    messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
    for (const call of msg.tool_calls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        /* ogiltiga argument ger ett fel från verktyget */
      }
      const outcome = runTool(call.function.name, args, ctx)
      if (outcome.card) cards.push(outcome.card)
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(outcome.result) })
    }
  }
  throw new ChatError('Assistenten fastnade i en loop. Försök formulera om frågan.')
}
