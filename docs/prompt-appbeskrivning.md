# Prompt: beskrivning av appen (läget 10 november 2026)

Klistra in texten nedan i en ny chatt (Claude, ChatGPT, Claude i Chrome) när den behöver veta vad appen är och vad den kan.

---

Du får här en beskrivning av min personliga studieassistent, en webbapp som bara jag använder. Läs den och utgå från den när du hjälper mig. Hitta inte på funktioner som inte står här. Är du osäker på om något finns, fråga eller kolla i appen.

## Vad appen är

- En personlig assistent för mig som elev: schema, packlistor, kalender, uppgifter, påminnelser, mat, kost, träning och en AI-chatt som kan läsa och ändra allt.
- PWA (kan installeras på mobilen), gjord i React + TypeScript + Vite. Mobilen först, ljust och mörkt läge, svenskt gränssnitt.
- Designen följer Google Kalender (Material 3): lugna ytor, få färger, inga onödiga animationer eller ikoner.
- Koden ligger på GitHub (bjarebornbenjamin-coder/assistent). Varje push till `main` publiceras automatiskt på Vercel.
- All data sparas först i webbläsaren (IndexedDB). Den kan synkas mellan enheter via Supabase och exporteras/importeras som en JSON-fil (version 8).

## Menyn

Fem flikar längst ner: **Hem, Schema, Kalender, Mat, Chatt**. Undersidor: Uppgifter, Påminnelser, Träning och Inställningar (från Hem), Ämnen och packlistor samt Importera schema (från Schema), Plugga inför prov (från Kalender).

## Funktioner

**Hem**
- Datum och knappen Inställningar överst.
- Nästa lektion, dagens lektioner (passerade är nedtonade, krockar markeras), packlista att bocka av.
- Händelser närmaste veckan, uppgifter som ska in snart, en rad med dagens mat och vatten, en rad med veckans träning, påminnelser idag.

**Schema**
- Veckoschema med A/B-veckor (eller fler veckor i cykeln). Lektioner har ämne, tid, sal och lärare.
- Ämnen har färg och en packlista.
- Varnar för krockar mellan lektioner.
- Importera schema från en bild: AI:n läser bilden och visar ett förslag som jag granskar innan något sparas.

**Kalender**
- Vyerna Månad, Vecka och Lista. Visar lektioner, händelser och uppgifter.
- Lista visar de kommande 60 dagarna och har en sökruta som hittar händelser och uppgifter, även gamla (titel, anteckning, ämne).
- Händelser kan vara heldag eller ha tid, och ha en anteckning och en egen packlista. När jag lägger in en ny händelse föreslår AI:n vad jag ska ta med; jag väljer själv vad som läggs till.
- **Plugga inför prov**: jag skriver provet, datumet och vad som ingår. Pluggpassen sprids ut på lediga tider efter skolan fram till dagen före provet, ett moment per pass och repetition sist. Jag ser förslaget innan det läggs in.
- **Google Kalender** (bara läsning): händelser från mina Google-kalendrar visas i appen, 30 dagar bakåt och 4 månader framåt. De kan inte ändras i appen. Kräver att `VITE_GOOGLE_CLIENT_ID` är inlagt i Vercel. Inloggningen hos Google gäller ungefär en timme, sedan trycker man på "Hämta från Google".

**Uppgifter**
- Titel, ämne, deadline, valfritt klockslag (t.ex. 23:59) och anteckning.
- En uppgift är försenad först efter deadlinedagen.

**Påminnelser**
- Fristående påminnelser: en gång, varje dag, vissa veckodagar eller varje vecka. Kan stängas av och på.

**Mat** (flikarna Lager, Inköp, Recept, Meny, Kost)
- Lager: varor med mängd och bäst före-datum. Fylls i för hand eller genom att skanna ett kvitto eller kylskåpet med kameran (AI).
- Inköp: inköpslista. Köpta varor kan flyttas till lagret.
- Recept: AI:n föreslår tre kända rätter utifrån det som finns hemma (det som går ut först), med mått, steg och näring per portion.
- **Meny**: AI:n planerar 3–7 middagar utifrån lagret, mina mål och hur dagarna ser ut (snabbt på fulla dagar, proteinrikt på träningsdagar). Det som saknas för hela veckan läggs på inköpslistan med ett tryck.
- Kost: logga måltider (protein, kolhydrater, fett, kcal; AI kan uppskatta) och vatten. Dagens summa mot mål, diagram över utvecklingen, egna mål.
- Allergier och antal portioner ställs in under Recept.

**Träning** (Hem → Träning)
- Logga gym (övningar, set, reps, vikt, med förra gångens resultat och "samma övningar som förra gången"), löpning (distans, tid, tempo) eller annat.
- Träningspass i kalendern kan loggas med ett tryck.
- Veckosummor och diagram över träningsminuter per vecka.
- Träningsplaneringen (via chatten) följer regler: aldrig tre träningsdagar i rad, ett pass per dag, vila mellan lika pass, jämnt utspritt, efter skolan, undviker dagen före prov. Den räknar med både kalenderpass och loggade pass.

**Chatten**
- Använder OpenAI via appens server (`/api/chat`). OpenAI-nyckeln finns bara i Vercel (`OPENAI_API_KEY`), aldrig i appen eller repot.
- Svarar på svenska och kort. Kan läsa och ändra allt: schema, packlistor, kalender, uppgifter, påminnelser, kontakter, lager, inköpslista, måltider, vatten, mål, träning, veckomeny.
- Allt som ändrar något blir ett **förslagskort** som jag bekräftar ("Bekräfta alla" finns när flera väntar). Mejl blir ett utkast som öppnas i mitt mejlprogram; chatten skickar aldrig själv.
- Exempel: "Vad har jag imorgon?", "Vad ska jag äta ikväll?", "När ska jag gymma den här veckan?", "Hjälp mig plugga inför matteprovet på fredag", "När var senaste matteprovet?", "Sprang 5 km på 27 min", "Vad blir det till middag?", "Skicka ett mejl till Anna om läxan".
- Har ett minne för preferenser ("jag gillar inte svamp") som syns och kan tas bort under Inställningar.

**Notiser** (push, kräver Supabase och inloggning)
- Morgonöversikt (standard 07:00): dagens lektioner, vad jag ska ta med (ämnenas och händelsernas packlistor), vad som ska in, försenat, händelser, påminnelser och mat som går ut. Skickas inte tomma dagar.
- Kvällsnotis med morgondagens lektioner och packlista, notis före varje lektion, påminnelser, mat som snart går ut, inköpslistan en viss veckodag.

**Inställningar**
- AI: lösenord till servern (valfritt, `APP_PASSWORD` i Vercel), modell, "Testa anslutningen".
- Assistentens minne, kontakter (för mejl), bakgrundsbild (bara på enheten), veckocykel (A/B), tema, synk (Supabase-inloggning), Google Kalender, notiser, export och import.

**Övrigt**
- "Ångra" efter de flesta ändringar (ruta längst ner).
- Allt som AI:n gör är förslag eller uppskattningar; inga medicinska råd.

## Teknik i korthet

- Frontend: React 18, TypeScript, Vite, vite-plugin-pwa, react-router, Dexie (IndexedDB).
- Server: Vercel-funktioner i `api/` (chat, models, health, push-dispatch, push-test). Chatten får upp till 60 sekunder.
- Synk: Supabase-tabellen `records` (en rad per post). Notiser: Supabase + web-push + cron.
- Tester: vitest (220 tester).

## Begränsningar som gäller nu

- Google Kalender är bara läsning och kräver ett eget klient-ID från Google Cloud.
- Riktiga OpenAI-, Supabase- och push-anrop är bara testade med låtsade svar, inte mot riktiga konton.
- Veckomenyn kan ta upp till en halv minut att göra.
