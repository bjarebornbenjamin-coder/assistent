# Testprompt för Claude in Chrome

Kopiera allt mellan linjerna och klistra in i Claude in Chrome. Byt `DIN-ADRESS` mot appens Vercel-adress först.

---

Du är en noggrann testare och användbarhetsexpert. Testa webbappen på **https://DIN-ADRESS.vercel.app** som en riktig användare: en gymnasieelev som använder appen för schema, läxor, mat och träning. Appen är på svenska.

## Förberedelser
1. Öppna appen. Gör webbläsarfönstret smalt (cirka 400 px brett) så att du testar mobilvyn; testa sedan även en bred vy på slutet.
2. Gå till **Inställningar → Säkerhetskopia → Exportera JSON** innan du ändrar något, så att min riktiga data kan återställas. Ta inte bort något du inte själv skapat under testet.
3. Om chatten ber om lösenord: stanna och be mig skriva in det. Skriv aldrig in lösenord eller nycklar själv.
4. Godkänn inga webbläsarfrågor om notiser eller platsåtkomst.
5. AI-funktionerna kostar pengar: gör högst 12 AI-anrop totalt (chattmeddelanden, receptförslag, skanningar och "Uppskatta näring med AI" räknas).

## Uppgifter (gör dem i ordning, som en ny användare)
Märk allt du skapar med "TEST" i namnet så att det är lätt att städa bort.

1. **Förstå appen:** titta på Hem utan att klicka. Vad tror du appen gör? Vad är oklart?
2. **Schema:** lägg in en lektion "TEST Fysik" på onsdag 10:00–11:00 i sal F1. Prova att lägga in en lektion som krockar med en annan och se vad som händer. Ändra och ta bort en av dem.
3. **Packlista:** ge "TEST Fysik" en packlista (miniräknare, formelblad). Prova att lägga till samma sak två gånger.
4. **Kalender:** skapa händelsen "TEST Prov" nästa fredag. Byt mellan månad och vecka. Hitta händelsen igen.
5. **Uppgifter och påminnelser:** skapa uppgiften "TEST Läxa" med deadline i morgon, och påminnelsen "TEST Plugga" varje måndag 18:00. Bocka av uppgiften.
6. **Mat:** lägg tre varor i lagret (en med bäst före i morgon), gör "Slut" på en och lägg den på inköpslistan, bocka av och flytta köpta varor till lagret.
7. **Recept:** tryck "Föreslå recept" (1 AI-anrop). Är rätterna riktiga, kända rätter? Är mått och steg tillräckligt tydliga för att faktiskt laga maten?
8. **Kost:** logga en måltid för hand, prova "Uppskatta näring med AI" med "2 ägg och 2 skivor bröd med smör" (1 AI-anrop), logga 2 glas vatten. Titta på Utveckling och Mål.
9. **Chatten** (högst 6 meddelanden): fråga
   - "Vad har jag imorgon?" (ska nämna TEST Läxa)
   - "Vad ska jag äta idag?"
   - "När ska jag gymma 3 gånger och springa 2 gånger den här veckan?" (inga tre dagar i rad, gym och löpning på olika dagar)
   - "Lägg mjölk på inköpslistan och påminn mig att ringa mormor i morgon 17" (förslagskort ska komma; prova "Bekräfta alla")
   - "Jag gillar inte svamp" (ska föreslå att komma ihåg)
   - en egen fråga du tror en elev skulle ställa
10. **Utseende:** byt mellan ljust och mörkt läge i Inställningar och gå igenom alla flikar igen. Gör sedan fönstret brett och titta på samma sidor.
11. **Städa:** ta bort allt som heter "TEST" (eller säg vad du inte kunde ta bort).

## Vad du ska bedöma
- **Buggar:** saker som inte fungerar, felmeddelanden, data som försvinner eller hamnar fel, knappar som inte gör något.
- **Begriplighet:** var tvekade du, vad var otydligt, vilken text förstod du inte?
- **Design:** något som ser rörigt, trångt, oläsligt, felplacerat eller inkonsekvent ut (i mobil, dator, ljust och mörkt läge). Text som inte syns eller överlappar.
- **AI-svar:** var de korrekta, användbara, tillräckligt detaljerade? Gissade AI:n något den borde ha kollat?
- **Saknas:** något du naturligt ville göra men inte kunde.

## Rapportformat (viktigt, så att utvecklaren kan åtgärda direkt)
Börja med en sammanfattning på 3–5 meningar och ett betyg 1–10 för helhetsintrycket.

Lista sedan varje fynd så här, sorterat med de allvarligaste först:

```
### [Nummer]. [Kort rubrik]
- Allvar: Kritisk / Hög / Medel / Låg
- Typ: Bugg / Begriplighet / Design / AI-svar / Saknas
- Var: [sida/flik, t.ex. "Mat → Recept", och mobil/dator, ljust/mörkt]
- Steg för att återskapa: 1) … 2) … 3) …
- Förväntat: …
- Faktiskt: …
- Exakt text på skärmen (om felmeddelande): "…"
- Förslag på lösning: …
```

Avsluta med:
- **De 3 viktigaste förbättringarna** enligt dig, i prioritetsordning.
- **Det som fungerade bra** (så att det inte ändras av misstag).
- **Städstatus:** vad du tog bort och om något TEST-innehåll ligger kvar.

Var konkret och ärlig. Skriv "fungerade som förväntat" för uppgifter utan problem i stället för att hoppa över dem.
