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

## Data och säkerhet

- Schema, ämnen, händelser och kontakter sparas i IndexedDB och kan exporteras/importeras som JSON under Inställningar.
- OpenAI-nyckeln sparas bara lokalt i webbläsaren och ingår aldrig i exporten. Lägg aldrig nyckeln i koden eller i repot.
