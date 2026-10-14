# Loch Roguelite (prototyp)

Webowy autobattler roguelite z budowaniem lochu: dobudowujesz po jednym pokoju, ekwipujesz bohatera
artefaktami, klikasz Start i oglądasz rajd. Po 10 wygranych stawiasz pokój Bossa. Pełna specyfikacja:
[CLAUDE.md](CLAUDE.md). Balans: [docs/BALANCE.md](docs/BALANCE.md).

## Uruchomienie

Wymagane: Node >= 20 i pnpm (`corepack enable` lub `npm i -g pnpm`).

```bash
pnpm install
pnpm dev          # http://localhost:5173 (tryb DEV: overlay debug pod klawiszem `)
pnpm build        # produkcja w apps/game/dist (base: './', bez sieci w runtime)
```

## Komendy

| Komenda                                              | Działanie                                                                                                             |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                                         | typecheck + lint + testy (uruchom przed commitem)                                                                     |
| `pnpm test`                                          | Vitest (sim, dane, UI)                                                                                                |
| `pnpm e2e`                                           | Playwright: pełny run przez UI, zrzuty w `artifacts/screens/` (pierwszy raz: `pnpm exec playwright install chromium`) |
| `pnpm sim:raid -- --seed 123 --class mage --waves 4` | pojedynczy rajd z logiem                                                                                              |
| `pnpm balance -- --runs 10000 --bot all`             | raport balansu (boty random, greedy-atk, greedy-hp)                                                                   |

W trybie DEV: `/dev/raid` (podgląd rajdu), `?seed=123` (powtarzalny run), overlay z przyciskami debug i eksportem
`RunState` oraz telemetrii (lokalnej, w pamięci, bez sieci).

## Struktura

- `packages/data`: dane JSON (balans tylko tutaj), schematy Zod, loader.
- `packages/sim`: czysty TypeScript (RNG, loch, walka, loot, przebieg runu, boty). Żadnej logiki w UI.
- `apps/game`: React (UI), Pixi (odtwarzanie rajdu z logu), Zustand, i18n (`pl.json`), `SaveStore`.
- `tools`: `simulate.ts`, `balance.ts`.
