# Loch Roguelite (prototyp)

Webowy autobattler roguelite z budowaniem lochu. Dobudowujesz po jednym pokoju do lochu, ekwipujesz bohatera artefaktami i klikasz Start, a bohater sam przechodzi loch i walczy. Wygrany rajd daje nowy kafelek pokoju, porażka kosztuje życie. Po 10 wygranych stawiasz pokój Bossa i jeśli go pokonasz, wygrywasz run. To prototyp, nie produkt końcowy.

## Wymagania

- Node.js >= 20
- pnpm (menedżer pakietów). Na nowej maszynie trzeba go zainstalować: `npm install -g pnpm` albo `corepack enable` (korzysta z Node; na Windowsie może wymagać uprawnień administratora). Bez instalacji globalnej można używać `npx pnpm@latest <komenda>`.

## Instalacja i uruchomienie

```bash
pnpm install
pnpm dev          # gra pod http://localhost:5173
pnpm build        # wersja produkcyjna w apps/game/dist (base: './', bez sieci w runtime)
```

## Komendy

| Komenda                                              | Działanie                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                           | serwer deweloperski gry                                                                                     |
| `pnpm build`                                         | build produkcyjny                                                                                           |
| `pnpm test` / `pnpm test:watch`                      | testy Vitest                                                                                                |
| `pnpm typecheck`                                     | `tsc --noEmit` we wszystkich pakietach                                                                      |
| `pnpm lint`                                          | ESLint + Prettier (sprawdzenie)                                                                             |
| `pnpm format`                                        | Prettier (zapis)                                                                                            |
| `pnpm check`                                         | typecheck + lint + testy (uruchom przed commitem)                                                           |
| `pnpm e2e`                                           | testy Playwright ze zrzutami w `artifacts/screens/` (pierwszy raz: `pnpm exec playwright install chromium`) |
| `pnpm balance -- --runs 10000 --bot all`             | raport balansu (boty `random`, `greedy-atk`, `greedy-hp`)                                                   |
| `pnpm sim:raid -- --seed 123 --class mage --waves 4` | pojedynczy rajd z logiem                                                                                    |

W trybie dev (`pnpm dev`): overlay debug pod klawiszem `` ` ``, strona `/dev/raid` (podgląd rajdu) i parametr `?seed=123` w adresie (powtarzalny run).

## Dokumentacja

- [CLAUDE.md](CLAUDE.md): specyfikacja gry, reguły, model danych, zasady pracy i status milestone'ów (źródło prawdy).
- [docs/](docs/INDEX.md): spis dokumentów (decyzje, balans, postęp, pytania do właściciela, raport końcowy, zmiany w stacku).

## Struktura

- `packages/data`: dane gry w JSON (balans tylko tutaj), schematy Zod, loader.
- `packages/sim`: czysty TypeScript (RNG, loch, walka, loot, przebieg runu, boty); cała logika gry.
- `apps/game`: React (UI), Three.js (odtwarzanie rajdu z logu w 3D), Zustand, i18n (`pl.json`), `SaveStore`, telemetria lokalna.
- `tools`: `simulate.ts`, `balance.ts`.
