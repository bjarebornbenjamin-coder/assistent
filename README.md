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
| `APP_PASSWORD` | **Valfritt.** Lösenord som appen skickar med (`x-app-password`). Skriv in det i Inställningar. Sätter du inget är åtkomsten **öppen**: alla som har webbadressen kan använda din OpenAI-nyckel (med strängare gräns: 10 anrop/min och 100/dygn per besökare, `OPEN_DAILY_LIMIT`). Sätt en utgiftsgräns hos OpenAI om du kör öppet. |
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

## Push-notiser

Kräver att synken (Supabase) är påslagen. Appen räknar ut vilka notiser du ska få 14 dagar framåt (kvällsnotis med morgondagens lektioner och packlista, och/eller en notis före varje lektion) och lägger dem i Supabase. En serverfunktion skickar dem när tiden är inne, även när appen är stängd.

1. Generera nycklar: `npx web-push generate-vapid-keys`
2. Kör den andra delen av `supabase/schema.sql` (tabellerna `push_subscriptions` och `notifications`; hela filen går att köra om).
3. Vercel, miljövariabler (bygg om efter att du lagt till dem):
   - `VITE_VAPID_PUBLIC_KEY` och `VAPID_PUBLIC_KEY`: den publika nyckeln
   - `VAPID_PRIVATE_KEY`: den privata nyckeln (hemlig)
   - `VAPID_SUBJECT`: `mailto:din@mejl.se`
   - `SUPABASE_SERVICE_ROLE_KEY`: Project Settings → API → service_role (hemlig, kringgår Row Level Security, används bara av servern)
   - `CRON_SECRET`: ett långt slumpmässigt värde
4. Något måste anropa `/api/push-dispatch` varje minut. Enklast: kör `supabase/cron.sql` (pg_cron + pg_net) efter att du bytt ut adressen och hemligheten. Vercels gratisnivå tillåter bara ett schemalagt jobb per dygn, så det duger inte.
5. Appen → Inställningar → Notiser → **Slå på notiser på den här enheten** → **Skicka testnotis**.

Mat-notiser (Inställningar → Notiser): "Mat som snart går ut" (varor som går ut idag eller imorgon, vid vald tid) och inköpslistan en vald veckodag. Båda planeras av appen utifrån lager och lista som de ser ut när du senast öppnade appen, så ändringar du gör i appen uppdaterar planen.

Fristående påminnelser (Hem → Alla påminnelser) skickas på samma sätt, med valfri tid och upprepning (en gång, varje dag, valda veckodagar). De räknas in i samma 14-dagarsplan.

Begränsningar: iPhone kräver att appen är installerad på hemskärmen (iOS 16.4+). Notiserna planeras 14 dagar framåt, så appen behöver öppnas minst varannan vecka. Ändrar du schema eller packlistor på en enhet uppdateras planen när appen är öppen där.

## Mat (lager, inköpslista, recept)

Fliken Mat har tre delar: Lager (med bäst före-datum), Inköpslista och Recept. Kvitto och kylskåp skannas via samma bildavläsning som schemat (`/api/chat`, vision-modell krävs, t.ex. gpt-4o-mini). Allt du ser från skanningar är förslag som du granskar innan något sparas. Kvittots bäst före-datum är AI:ns uppskattning. Recepten skapas av AI:n och sparas inte; kontrollera allergier och att varorna är hela.

Chatten känner till lager och inköpslista: fråga t.ex. "vad ska jag äta idag?" (snabbfrågeknapp finns), "vad kan jag laga på det som snart går ut?" eller "lägg mjölk och ägg på inköpslistan". Den hämtar lagret, utgår från det som snart går ut och föreslår vad som saknas. Att lägga på listan, lägga i lagret eller ta bort ur lagret sker alltid via ett bekräftelsekort, aldrig direkt.

### Kost (måltider, makron, vatten)

Mat → **Kost** har tre vyer:
- **Dag:** logga måltider med protein, kolhydrater, fett (gram) och valfria kalorier (annars 4/4/9 kcal per gram), och logga vatten (glas eller egen mängd). Måltider kan fyllas i för hand, uppskattas av AI från en beskrivning ("2 ägg och 2 skivor bröd med smör") eller skapas från ett recept ("Jag åt detta"). AI-värden är uppskattningar, alltid redigerbara.
- **Utveckling:** snitt, och grafer för 7 eller 30 dagar: kalorier fördelade på makron, protein, kolhydrater, fett och vatten, med dina mål inritade. Varje graf har tooltip (hovra, tryck eller vänster/högerpil) och en tabellvy.
- **Mål:** dina dagliga mål för protein, kolhydrater, fett, vatten och glasstorlek. De är egna riktvärden, inte medicinska råd.

Chatten kan svara på "hur ligger jag till idag?" och föreslå att logga en måltid eller vatten du berättar om (via bekräftelsekort).

Färgerna i graferna (blå, orange, turkos för makron; violett för vatten) är validerade för färgblindhet i både ljust och mörkt läge. Recepten innehåller mått för valt antal portioner, ingredienslista med status och detaljerade steg.

### Träningsplanering

Fråga chatten "när ska jag gymma och springa?". Assistenten använder en planerare (inte gissningar) som följer träningsregler: högst två träningsdagar i rad, högst ett pass per dag (gym och löpning hamnar på olika dagar), minst en vilodag mellan lika pass, jämn spridning, pass efter skolan och inte över händelser, och dagen före prov eller deadlines undviks. Träningspass som redan finns i kalendern (titlar som "Gym", "Löpning", "Yoga") räknas med, även de närmaste dagarna före perioden. Går önskemålet inte att uppfylla utan att bryta reglerna får du en varning och en plan med färre pass. Passen kan läggas in i kalendern med ett bekräftelsekort.

### Chatten kan göra allt

Chatten kan läsa och ändra allt i appen: schema och lektioner, packlistor, kalender, uppgifter (skapa, bocka av, flytta, ta bort), påminnelser, kontakter, matlager, inköpslista (lägga till, markera köpt), måltider, vatten, mål, allergier och träningsplaner. Allt som ändrar något blir ett bekräftelsekort; när flera förslag väntar finns "Bekräfta alla".

Den har också ett **minne** för preferenser ("jag gillar inte svamp", "jag tränar helst på morgonen"). Chatten föreslår själv att komma ihåg sådant, och du ser och tar bort det under Inställningar → Assistentens minne. Minnet synkas och följer med i exporten.

Under Inställningar → **Instruktioner till chatten** kan du skriva egna regler (upp till 4000 tecken), som en README för assistenten: hur den ska svara, vem du är, vad den ska prioritera. De läggs sist i systemprompten och går före appens stil- och innehållsregler, men ändringar blir fortfarande bekräftelsekort. Synkas och följer med i exporten.

På "vad ska jag äta idag?" väger den ihop lagret (det som går ut först, aldrig utgånget), vad som återstår av dagens makromål, och dagens schema (träning, hur full dagen är), och ger mått och steg för det den rekommenderar.

## Importera schema från bild

Schema → "Importera schemat från en bild". Bilden skalas ner i webbläsaren och skickas via `/api/chat` till OpenAI (vald modell måste klara bilder, t.ex. gpt-4o-mini). Resultatet visas som förslag som du kan ändra, avmarkera och kontrollera mot krockar och dubbletter innan något sparas. Bilden sparas inte.

## Data och säkerhet

- Schema, ämnen, händelser och kontakter sparas i IndexedDB och kan exporteras/importeras som JSON under Inställningar.
- OpenAI-nyckeln finns bara på servern. Lösenordet till servern sparas lokalt och ingår aldrig i exporten. Lägg aldrig nycklar i koden eller i repot.
