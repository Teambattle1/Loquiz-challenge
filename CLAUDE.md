# CLAUDE.md

## Projekt

2026-loquiz-results — En React-applikation til at vise spilresultater og ranglister fra Loquiz med festlig podium-reveal, task-analyse, fotogalleri og live-opdateringer.

- **Repository:** https://github.com/Teambattle1/Loquiz-challenge
- **Live:** https://loquiz.eventday.dk

## Kommandoer

- `npm run dev` — Start udviklingsserver (port 3000)
- `npm run build` — Byg til produktion (output: dist/)
- `npm run preview` — Forhåndsvis produktionsbuild

## Tech stack

- **Sprog:** TypeScript (~5.8)
- **Framework:** React 19 med funktionelle komponenter og hooks
- **Build:** Vite 6 med @vitejs/plugin-react
- **Styling:** Tailwind CSS (CDN) — mørkt tema med orange accenter
- **API'er:** Loquiz API (v3/v4), Google Gemini (@google/genai)

## Projektstruktur

```
├── App.tsx              # Root view-router (login → lobby → results)
├── index.tsx            # React entry point
├── index.html           # HTML template med Tailwind CDN og custom CSS
├── types.ts             # Alle delte TypeScript interfaces
├── components/          # React-komponenter (PascalCase filnavne)
├── services/            # API-services (loquizService.ts, geminiService.ts)
└── vite.config.ts       # Vite-konfiguration med path alias og env vars
```

## Kodekonventioner

- **Komponenter:** PascalCase filnavne, funktionelle komponenter med typed props-interfaces
- **Services:** camelCase med deskriptive navne
- **Types:** Alle delte interfaces i `types.ts`, PascalCase navngivning
- **Imports:** Brug `@/` path alias til root-relative imports
- **Styling:** Tailwind utility classes inline — ingen separate CSS-filer (undtagen custom styles i index.html)
- **State:** useState/useEffect/useCallback/useMemo — ingen Context API eller state library
- **Sprog i kode:** Engelsk (variabelnavne, kommentarer, typer)

## Datakilder

Al data hentes fra én af to kilder:

- **Supabase** — Klient i `/lib/supabase.js` bruges til persisteret data
- **Loquiz API** — Klient i `/services/loquizService.ts` bruges til spildata (resultater, tasks, fotos) via v3/v4 endpoints

Nye data-fetches skal bruge en af disse to kilder.

## Vigtige arkitekturbeslutninger

- CORS proxies bruges som fallback til Loquiz API (corsproxy.io, api.codetabs.com)
- Live-opdatering via 15-sekunders polling (ingen WebSocket)
- API-nøgle gemmes i localStorage (`loquiz_api_key`)
- Modale overlays til Showtime (fotogalleri) og TaskInspector
- Komponenterne håndterer egen state — prop drilling, ingen global state

## Miljøvariabler

- `GEMINI_API_KEY` — Google Gemini API-nøgle (sættes i .env.local)
- Injiceres via vite.config.ts som `process.env.API_KEY` og `process.env.GEMINI_API_KEY`

## Kendte begrænsninger

- Ingen React error boundaries
- Nogle `any`-typer i API-response parsing (`raw?: any`)
- Quiz-komponenter (Quiz.tsx, LocationInput.tsx, ScoreScreen.tsx) er ikke integreret i hovedflowet endnu
