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
