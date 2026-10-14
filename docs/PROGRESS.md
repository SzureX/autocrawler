# Progress

## Plan M0

Monorepo pnpm, dane + Zod + loader, sim (rng, fazy, createRun, serializacja), aplikacja z overlayem, SaveStore, i18n.

## Raport M0: Fundament

- Zrobione: monorepo pnpm (data, sim, game, tools); dane z sekcji 8 w JSON + schematy Zod + loader z walidacją unikalności id i referencji; sim: RNG mulberry32 z fork, maszyna faz, createRun, serializacja z walidacją Zod i stubem migracji; aplikacja Vite/React z debug overlayem (faza, ziarno, przełączanie faz, eksport), SaveStore (LocalStorage, autozapis po zmianie fazy), t() z pl.json; ESLint z regułami sim (brak Math.random, Date, DOM, react/pixi/zustand).
- Wynik pnpm check: typecheck OK (4 pakiety) / lint OK (eslint + prettier) / testy: 26 przechodzi w 5 plikach. pnpm build OK.
- Decyzje podjęte samodzielnie: patrz docs/DECISIONS.md (pnpm przez corepack, TS 6, GameData jako argument sim, nextUid w RunState).
- Znane problemy / dług: tools/balance.ts i tools/simulate.ts to stuby (M7 / M3).
- Jak to zobaczyć/uruchomić: pnpm install; pnpm dev (overlay w prawym górnym rogu, klawisz ` przełącza).
- Proponowany następny krok: M1 (siatka, budowanie, oferty, trasa).

## Plan M1

1. grid.ts (kierunki, klucze), level.ts (dungeonLevel, pasma z balance), uid.ts.
2. spawns.ts: skład potworów z seeda `spawns:<uid>` (wagi komnaty, minLevel, tryby pokoi).
3. dungeon.ts: sąsiedztwo po drzwiach, `legalPlacements`, `placeTile`.
4. tiles.ts: generator kafelka (maska 2/3/4 drzwi, reroll do 20x, fallback 4 drzwi), oferta 3 kafelków o różnych typach, oferta bossa, `chooseTile`.
5. route.ts: `computeRaidRoute` (DFS preorder N,E,S,W + Boss na końcu, ścieżki BFS).
6. `createRun` generuje spawns pokoju 1 i pierwszą ofertę.
7. Testy: reguły położenia, cykle, brak soft locka na >1000 ofert, trasa na >=20 układach, determinizm.
8. UI minimalne: ekran klasy, oferta kafelków, siatka Prep z duchem i klikaniem.

## Raport M1: Siatka i budowanie

- Zrobione: grid/level/uid, spawns (skład z seeda `spawns:<uid>`, minLevel brutala, tryby pokoi), dungeon (`legalPlacements`, `placementConnections`, `connectedNeighbors`, `placeTile`), tiles (generator z rerollem maski i fallbackiem 4 drzwi, oferta 3 kafelków o różnych typach, oferta bossa, `chooseTile`), `computeRaidRoute` (DFS preorder N,E,S,W, boss na końcu, ścieżki BFS bez przechodzenia przez bossa); `createRun` generuje spawns pokoju 1 i pierwszą ofertę. UI minimalne: ekran klasy, oferta kafelków z listą potworów, siatka Prep z duchem i podświetleniem legalnych pól, klik stawia kafelek.
- Wynik pnpm check: typecheck OK / lint OK / testy: 52 w 9 plikach (m.in. 1000+ ofert bez soft locka, trasa na 50 układach, determinizm ofert, cykle, limit pokoi).
- Decyzje podjęte samodzielnie: patrz DECISIONS.md (M1).
- Znane problemy / dług: brak tooltipa nad pokojem (M6b); `debugNextWave` w overlayu zastępuje pełny przepływ do M5.
- Jak to zobaczyć/uruchomić: pnpm dev, wybierz klasę, wybierz kafelek, kliknij zielone pole.
- Proponowany następny krok: M2 (statystyki bohatera, artefakty, scalanie).

## Raport M2: Bohater, statystyki, artefakty
- Zrobione: `computeStats` (kolejność (base+flat)×(1+add)×mult, clampy), `diffStats`, `levelMult` i `scaledModifiers` (flat/percentAdd ×lm, percentMult 1+(v−1)×lm), `activeEffects` (efekty per egzemplarz ze skalowaniem value), `computeHeroStats`, `grantArtifact`, `equip` (zamiana przy zajętym slocie)/`unequip` (tylko Prep, 9 slotów), `mergeArtifacts` (3→1, max poz. 3, tylko plecak), `backpackStacks`. UI: plecak ze stosami, 9 slotów, panel statystyk z różnicą przed/po (zielone/czerwone), przycisk Scal, dodawanie artefaktu w overlayu.
- Wynik pnpm check: typecheck OK / lint OK / testy: 84 w 12 plikach.
- Decyzje podjęte samodzielnie: clampy statystyk (critChance 0..1, aspd/moveSpeed ≥0.1, maxHp ≥1, range ≥1); scalanie bierze pierwsze 3 sztuki z plecaka; zakładanie na zajęty slot zamienia artefakty.
- Znane problemy / dług: drag & drop dopiero w M6b (na razie klik: wybierz stos, potem slot).
- Jak to zobaczyć/uruchomić: pnpm dev, wybierz klasę i kafelek, w overlayu „Dodaj artefakt”.
- Proponowany następny krok: M3 (symulacja walki).
