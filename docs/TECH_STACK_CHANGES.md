# Loch Roguelite: zmiany w stacku technologicznym

Dokument samodzielny (można go wkleić do osobnego czatu bez dodatkowego kontekstu). Stan na 2026-10-15, gałąź `prototype`, tag `three-view-done`.

## Czym jest projekt (w skrócie)

Webowy prototyp autobattlera roguelite z budowaniem lochu. Gracz dobudowuje po jednym pokoju, ekwipuje bohatera artefaktami i klika Start, a bohater sam przechodzi loch i walczy. Po 10 wygranych rajdach gracz stawia pokój Bossa. Specyfikacja i zasady pracy: `CLAUDE.md` w katalogu głównym repozytorium. Język kodu i commitów: angielski, teksty w grze: polski (przez i18n).

## Architektura (bez zmian)

Monorepo pnpm, wszystko w TypeScript (strict):

| Katalog         | Rola                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/sim`  | czysty TypeScript: RNG, loch, walka, loot, przebieg runu, boty. Bez DOM, React i Three.js. Symulacja jest funkcją czystą i zwraca log zdarzeń. |
| `packages/data` | dane gry w JSON (balans tylko tutaj), schematy Zod, loader z walidacją referencji                                                              |
| `apps/game`     | aplikacja: React (UI), Three.js (widok rajdu), Zustand (store), i18n, `SaveStore`                                                              |
| `tools`         | `balance.ts` (headless raport balansu), `simulate.ts` (pojedynczy rajd z logiem)                                                               |

Widok rajdu nie liczy walki: tylko odtwarza log zdarzeń z `sim`. Dlatego wymiana silnika graficznego dotknęła jednego pliku.

## Najważniejsza zmiana: PixiJS → Three.js

| Było                      | Jest                      |
| ------------------------- | ------------------------- |
| PixiJS, widok 2D (płótno) | Three.js 0.186, lekkie 3D |

- `pixi.js` usunięty z zależności. Dodane: `three` (runtime) i `@types/three` (dev).
- Zmiana na życzenie właściciela (wariant B: lekkie 3D). Zależność `three` została zatwierdzona w rozmowie.
- API klasy `RaidCanvas` nie zmieniło się (`init`, `load`, `setSpeed`, `setPaused`, `skip`, `onState`, `destroy`), więc ekrany React, strona `/dev/raid`, odtwarzacz logu i testy `sim` nie wymagały zmian.
- Widok to na razie placeholdery: pokój 3D z podłogą (kolor zależny od typu pokoju), ścianami z lukami na drzwi i cieniami; kamera perspektywiczna podąża za bohaterem; jednostki to proste bryły (kapsuła, kula, prostopadłościan, stożek, walec) z emoji i paskiem HP nad głową. Efekty: błysk trafienia, wypad przy ataku, liczby obrażeń, ikona dropu.
- Modele 3D zostaną podmienione później w jednym miejscu: `apps/game/src/view/placeholders.ts`.
- Pliki widoku: `view/RaidCanvas.ts` (pętla, jednostki, kamera), `view/roomStage.ts` (pokój), `view/placeholders.ts` (kształty i tekstury), `view/layout.ts` (czysta geometria i kamera, z testami), `view/playback.ts` (odtwarzacz logu, bez zmian).
- Rozmiar paczki produkcyjnej: ok. 975 kB (ok. 270 kB po kompresji). Dla gry offline pakowanej jako `.exe` to nie problem. Jeśli będzie istotne w przeglądarce, ekran rajdu można ładować leniwie.

## Odstępstwa od pierwotnego planu (wszystkie w `docs/DECISIONS.md`)

- **TypeScript 6.0.3 zamiast 7.** `typescript-eslint` nie obsługuje jeszcze TS 7, więc wersja przypięta do `~6`.
- **pnpm 12.11 uruchamiany przez corepack** (na maszynie deweloperskiej `corepack enable` nie miał uprawnień administratora). Na nowej maszynie pnpm trzeba zainstalować: `npm install -g pnpm` albo używać `npx pnpm@latest <komenda>`.
- **ESLint bez reguł type-aware** (tylko zestaw `recommended`). Typy sprawdza `tsc`.
- **Katalog `tools/` jest pakietem workspace** (`@loch/tools`), żeby `pnpm typecheck` go obejmował.
- **Testy mechanik używają zamrożonych wartości startowych** ze specyfikacji (`loadSpecGameData`, pliki w `packages/data/src/fixtures`), a gra korzysta ze stroionych danych (`packages/data/src/json`). Dzięki temu strojenie balansu nie psuje testów.

## Wersje głównych narzędzi (zainstalowane w chwili budowy)

| Narzędzie                     | Wersja                     |
| ----------------------------- | -------------------------- |
| Node                          | wymagane ≥ 20 (używane 24) |
| pnpm                          | 12.11                      |
| TypeScript                    | 6.0.3                      |
| Vite                          | 8.3                        |
| Vitest                        | 5.0                        |
| ESLint                        | 10.12                      |
| Prettier                      | 3.9                        |
| Playwright                    | 1.64                       |
| tsx                           | 4.23                       |
| React                         | 19                         |
| Three.js                      | 0.186                      |
| Zod, Zustand, `@dnd-kit/core` | aktualne wersje z rejestru |

Dodatkowe zależności deweloperskie (bez wpływu na runtime): `@types/node`, `@types/react`, `@types/react-dom`, `typescript-eslint`, `@eslint/js`, `eslint-config-prettier`, `eslint-plugin-react-hooks`, `globals`.

## Do posprzątania

- `immer` jest zainstalowany (był na liście zatwierdzonych), ale nigdzie nieużywany: `sim` aktualizuje stan zwykłymi spreadami.
- `happy-dom` jest zainstalowany, ale testy działają w środowisku Node.

## Komendy

| Komenda                                              | Działanie                                                                                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                       | instalacja                                                                                                                               |
| `pnpm dev`                                           | serwer deweloperski (http://localhost:5173; w trybie DEV: overlay debug pod klawiszem `` ` ``, strona `/dev/raid`, parametr `?seed=123`) |
| `pnpm build`                                         | build produkcyjny (`base: './'`, bez żądań sieciowych w runtime)                                                                         |
| `pnpm check`                                         | typecheck + lint + testy                                                                                                                 |
| `pnpm e2e`                                           | testy Playwright ze zrzutami w `artifacts/screens/` (pierwszy raz: `pnpm exec playwright install chromium`)                              |
| `pnpm sim:raid -- --seed 123 --class mage --waves 4` | pojedynczy rajd z logiem                                                                                                                 |
| `pnpm balance -- --runs 10000 --bot all`             | raport balansu                                                                                                                           |

## Stan jakości (ostatnie uruchomienie)

- `pnpm check`: typecheck, ESLint i Prettier czyste, 182 testy w 21 plikach przechodzą.
- `pnpm e2e`: 8 z 8 przechodzi (pełny run przez UI w trybie „Pomiń”, Victory i GameOver, drag & drop, tooltip, letterbox, rajd w 3D, zero błędów w konsoli).
- `pnpm build`: działa.
- Balans (10 000 runów na bota): greedy-atk 50,0%, greedy-hp 37,6%, random 2,5%, 0 timeoutów. Niespełnione cele balansu (m.in. rozrzut wygranych między klasami dla stylu „HP”) i otwarte pytania: `docs/BALANCE.md`, `docs/QUESTIONS.md`, `docs/FINAL_REPORT.md`.
