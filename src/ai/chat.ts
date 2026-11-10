import { goalKcal } from '../domain/nutrition'
import { WEEKDAYS_LONG, toHHmm, toISODate, weekdayOf } from '../domain/dates'
import type { ChatCard, ChatMessage } from '../domain/types'
import { cycleLabel, weekIndex } from '../domain/weekCycle'
import { DEFAULT_MODEL } from './models'
import { TOOL_DEFINITIONS, runTool, type ToolContext } from './tools'

const API_URL = '/api/chat'
const MAX_ROUNDS = 10
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

function memoryPrompt(ctx: ToolContext): string {
  const m = ctx.settings.memories
  return [
    'Minne: när användaren berättar en bestående preferens eller ett faktum om sig själv (mat hen inte gillar, när hen helst tränar, mål, vanor), föreslå att komma ihåg det med remember. Spara inte tillfälliga saker.',
    m.length ? `Saker användaren bett dig komma ihåg (följ dem i alla svar):\n${m.map((x) => `- ${x}`).join('\n')}` : 'Inget sparat i minnet än.',
  ].join('\n')
}

function trainingPrompt(): string {
  return [
    'Träning: när användaren frågar när hen ska träna, gymma eller springa, eller vill ha ett träningsschema: anropa ALLTID plan_workouts. Planera aldrig träningsdagar själv utifrån vilka dagar som är lediga i schemat: en ledig dag betyder inte att man ska träna den.',
    '"Den här veckan" betyder de kommande 7 dagarna (inklusive idag om det finns tid kvar) om inte användaren säger annat. Om det inte framgår hur många pass av varje sort och över hur många dagar: fråga kort, eller anta något rimligt (t.ex. 3 gympass och 2 löppass över 7 dagar) och säg uttryckligen vad du antog.',
    'Träningslogg: berättar användaren att hen tränat ("körde ben idag, knäböj 3x8 80 kg", "sprang 5 km på 27 min"), föreslå loggning med propose_workout_log med just de siffror hen sagt. Frågor om tidigare pass, vikter eller hur mycket hen tränat: list_workouts.',
    'Förklara planen kort och varför dagarna valts (vila mellan lika pass, aldrig 3 dagar i rad, olika pass olika dagar, efter skolan, hänsyn till prov). Nämn varningar från verktyget. Erbjud att lägga in passen i kalendern med propose_events (titel t.ex. "Gym" eller "Löpning", med tider från planen). Ge inga medicinska råd.',
  ].join('\n')
}

function foodPrompt(ctx: ToolContext): string {
  const f = ctx.settings.food
  const n = ctx.settings.nutrition
  return [
    'Veckomeny: frågar användaren vad det blir till middag, eller vad hen ska äta en dag med planerad middag, anropa get_meal_plan och utgå från den.',
    'Mat: du ser användarens matlager med list_pantry och inköpslistan med list_shopping. På "vad ska jag äta idag/ikväll?" eller "vad kan jag laga?": hämta list_pantry, get_nutrition för idag och get_overview för idag, och väg ihop: (1) använd i första hand varor som snart går ut (daysLeft 0–2), aldrig utgångna (negativt daysLeft; nämn dem kort), (2) håll dig INOM det som återstår av dagens mål: har användaren t.ex. 240 kcal kvar ska förslagen ligga på ungefär 240 kcal eller mindre, är fettet redan över målet ska förslagen vara magra, och är proteinmålet nått behövs inget proteintillskott; säg kort hur mycket som är kvar, (3) har användaren träning idag, föreslå en proteinrik måltid i rimlig tid före eller efter passet, (4) är dagen full, föreslå något snabbt, (5) ta hänsyn till klockslaget: sent på kvällen är det ett kvällsmål eller mellanmål, inte en full middag. Räkna inte upp hela lagret; nämn bara de varor du använder. Föreslå 1–3 ETABLERADE, kända rätter med sina vedertagna namn (t.ex. pasta carbonara, kycklinggryta med curry, chili con carne), aldrig egna kombinationer bara för att använda det som finns hemma; hellre att några varor saknas än att rätten blir konstig. För den du rekommenderar mest: ingredienser med mått för standardportionerna och korta numrerade steg med tider. Anta att salt, peppar, vatten, olja och socker finns. Säg vad som saknas och erbjud propose_shopping_items. Avsluta varje recept med en egen rad exakt så här: [Öppna receptet](recept:Rättens namn), t.ex. [Öppna receptet](recept:Pasta carbonara). Appen gör om det till en länk till receptet. Skriv aldrig egna webbadresser; du kan inte surfa och de skulle vara gissade. Gissa aldrig vad användaren har: är lagret tomt, säg det och föreslå att lägga in varor eller skanna ett kvitto.',
    `Standard är ${f.portions} portioner.${f.allergies.trim() ? ` Allergier/kostönskemål som du måste respektera: ${f.allergies.trim()}.` : ''}`,
    `Kost: användarens dagliga mål är protein ${n.proteinG} g, kolhydrater ${n.carbsG} g, fett ${n.fatG} g (ca ${goalKcal(n)} kcal) och vatten ${n.waterMl} ml; ett glas är ${n.glassMl} ml. Frågor om hur mycket användaren ätit eller druckit, eller vad som återstår: anropa get_nutrition och räkna ut skillnaden mot målen. På "vad ska jag äta?" kan du ta hänsyn till vad som återstår av dagens mål om get_nutrition visar något loggat. Berättar användaren vad hen ätit: uppskatta näringsvärdena för hela måltiden, säg att det är en uppskattning, och föreslå loggning med propose_meal. Berättar hen att hen druckit vatten ("2 glas"): använd propose_water i ml. Det här är bara riktvärden: ge inga medicinska råd.`,
  ].join('\n')
}

export function systemPrompt(now: Date, ctx: ToolContext): string {
  const today = toISODate(now)
  const week =
    ctx.settings.cycleLength > 1
      ? ` Veckorna i schemat alternerar; denna vecka är vecka ${cycleLabel(weekIndex(today, ctx.settings.cycleAnchor, ctx.settings.cycleLength))}.`
      : ''
  return [
    'Du är en personlig assistent för en elev/student i en schema- och kalenderapp. Svara ALLTID på svenska, även rubriker; använd aldrig engelska ord eller verktygens fältnamn (som packing, tasksDue, overdue). Var kortfattad: sällan mer än 8 rader om användaren inte ber om mer. Numrerade listor numreras 1, 2, 3.',
    `Idag är ${WEEKDAYS_LONG[weekdayOf(today) - 1]} ${today}, klockan ${toHHmm(now)}.${week}`,
    'En uppgift är försenad först efter deadlinedagen; deadline idag är "ska in idag", inte försenad.',
    'För frågor om vad användaren har en dag eller vecka (idag, imorgon, i veckan, på fredag): anropa ALLTID get_overview för datumet eller intervallet. Den innehåller lektioner, händelser, uppgifter med deadline, påminnelser och packlista. Sammanfatta ALLT som finns, även om det bara är en uppgift eller en påminnelse, och nämn försenade uppgifter. Är allt tomt, säg uttryckligen att inget är inplanerat. Svara aldrig med tomt svar.',
    'Hämta alltid schema, packlista och händelser med verktygen och gissa aldrig. Räkna ut datum själv ("imorgon", "på fredag") och skicka dem som YYYY-MM-DD.',
    'Du kan inte lägga in, ändra, ta bort eller skicka något direkt: propose_*-verktygen och draft_email visar bara ett förslag som användaren själv bekräftar eller skickar. Säg tydligt att det är ett förslag/utkast som väntar på användaren, inte att det är gjort.',
    foodPrompt(ctx),
    trainingPrompt(),
    'Plugg: när användaren vill plugga eller planera inför ett prov, anropa plan_study (fråga efter datum om det saknas, och gärna vad som ingår). Planera aldrig pluggdagar själv.',
    'Du kan läsa och ändra allt i appen via verktygen: schema och lektioner, packlistor, kalender, uppgifter, påminnelser, kontakter, matlager, inköpslista, måltider, vatten, mål och träning. Gör det åt användaren med verktygen i stället för att be hen gå till en sida. Allt som ändrar något blir ett förslag som användaren bekräftar; säg det kort, och samla gärna flera förslag i samma svar.',
    'Packning: när du föreslår en ny händelse där man behöver ta med något (match, träning, prov, utflykt, resa, simning), skicka med 2–8 förslag i pack. Packlistan för en dag (get_packing_list, get_overview) innehåller både ämnenas och händelsernas saker.',
    'Om en uppgift saknas (t.ex. vilken Anna som avses eller vad mejlet ska handla om), fråga istället för att hitta på.',
    memoryPrompt(ctx),
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
  const ctx = { ...(await o.loadContext()), today: toISODate(o.now), nowTime: toHHmm(o.now) }
  const messages: ApiMessage[] = [
    { role: 'system', content: systemPrompt(o.now, ctx) },
    ...o.history.slice(-HISTORY_LIMIT).map((m) => ({ role: m.role, content: m.content }) as ApiMessage),
    { role: 'user', content: o.userText },
  ]
  const cards: ChatCard[] = []
  let model = o.model
  let notice: string | undefined
  let retriedEmpty = false

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

    if (!msg.tool_calls?.length) {
      const text = (msg.content ?? '').trim()
      if (!text && !retriedEmpty) {
        // Modellen svarade tomt (t.ex. efter tomma verktygsresultat). Be den svara i text, en gång.
        retriedEmpty = true
        messages.push({ role: 'user', content: 'Svara i text på min fråga utifrån det du fått från verktygen. Om inget finns, säg det tydligt.' })
        continue
      }
      return { reply: text || 'Jag fick inget svar den här gången. Försök igen.', cards, notice }
    }

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
