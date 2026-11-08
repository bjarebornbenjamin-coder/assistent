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

## Synk mellan enheter (Supabase)

Lokalt först: allt fungerar offline i IndexedDB. När du loggar in synkas schema, ämnen, händelser, uppgifter, kontakter och inställningar mot Supabase. Packlistans avbockningar, chatthistorik och lösenord synkas inte.

1. Skapa ett projekt på supabase.com.
2. SQL Editor: kör innehållet i `supabase/schema.sql` (tabell + Row Level Security).
3. Authentication → Providers → Email: stäng av "Confirm email" om du vill kunna logga in direkt efter att du skapat kontot.
4. Lägg i Vercel (Environment Variables) och bygg om:
   - `VITE_SUPABASE_URL` och `VITE_SUPABASE_ANON_KEY` (Project Settings → API; anon-nyckeln är publik och skyddas av Row Level Security)
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` och `ALLOWED_EMAILS` (din e-postadress) så att servern bara släpper in dig till OpenAI-anropen
5. Öppna appen → Inställningar → Synk → **Skapa konto**. Din befintliga data laddas upp första gången.
6. **Stäng sedan av nya registreringar** (Authentication → Sign In / Providers → "Allow new users to sign up" av). Det är en personlig app.

Konflikter: en ändring du gjort lokalt men inte hunnit synka vinner över en inkommande ändring; i övrigt gäller senaste skrivningen på servern. Borttagningar synkas.

## Data och säkerhet

- Schema, ämnen, händelser och kontakter sparas i IndexedDB och kan exporteras/importeras som JSON under Inställningar.
- OpenAI-nyckeln finns bara på servern. Lösenordet till servern sparas lokalt och ingår aldrig i exporten. Lägg aldrig nycklar i koden eller i repot.
