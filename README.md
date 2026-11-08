# Studieassistent

Personlig PWA för schema, packlistor, kalender och en AI-assistent. All data ligger lokalt i webbläsaren (IndexedDB).

## Kommandon

```bash
npm install
npm run dev      # utveckling
npm test         # enhetstester
npm run build    # produktionsbygge i dist/
```

## Publicera

Vercel: Import Project från GitHub-repot. Inga inställningar behövs (Vite detekteras, `vercel.json` hanterar routing).

## Server (Vercel-funktioner i `api/`)

OpenAI-anropen går via `/api/chat` och `/api/models`. Nyckeln finns bara som miljövariabel på servern.

| Variabel | Syfte |
|---|---|
| `OPENAI_API_KEY` | Din OpenAI-nyckel (obligatorisk) |
| `APP_PASSWORD` | Lösenord som appen skickar med (`x-app-password`). Skriv in det i Inställningar. |
| `RATE_LIMIT_PER_MIN` | Anrop per minut och användare (standard 20). Gäller per serverinstans, så det är ett skydd mot misstag, inte en exakt kvot. |

Sätt dessutom en utgiftsgräns på nyckeln hos OpenAI. Lokalt: `vercel dev` startar både appen och funktionerna.

## Data och säkerhet

- Schema, ämnen, händelser och kontakter sparas i IndexedDB och kan exporteras/importeras som JSON under Inställningar.
- OpenAI-nyckeln finns bara på servern. Lösenordet till servern sparas lokalt och ingår aldrig i exporten. Lägg aldrig nycklar i koden eller i repot.
