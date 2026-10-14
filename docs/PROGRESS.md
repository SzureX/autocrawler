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

## Plan M3

1. combat/types.ts: zdarzenia logu, jednostki, wynik rajdu.
2. combat/board.ts: komórki drzwi, Czebyszew, A* (8 kierunków), odwrót łucznika.
3. combat/units.ts: skalowanie statystyk potworów/bossa z poziomu lochu, modyfikatory ulepszeń pokoju.
4. combat/fight.ts: pętla tików pokoju (cele, ruch, ataki, krytyk/accuracy, efekty artefaktów, AoE maga, odbicie, faza bossa, śmierci na końcu tiku, efekty onEnter/onClear).
5. combat/raid.ts: `simulateRaid` (trasa, tranzyty przez oczyszczone pokoje, limit 6000 tików, timeout = RaidLost), hash logu.
6. Testy: zasięg, cooldown, ruch, krytyk, AoE, lifesteal, reflect, execute, firstStrike, nth, faza bossa, pułapka/sanktuarium, determinizm, 1000 rajdów bez timeoutu.
7. tools/simulate.ts (CLI z logiem), strona /dev/raid w Pixi (M3.9) + screenshot Playwright.

## Raport M3: Symulacja walki

- Zrobione: combat/{types,board,units,fight,raid}.ts: plansza 9×7, A* (8 kierunków), tik 20 Hz, wybór celu (najbliższy, remis niższe id, retarget co 10 tików), ruch i cooldowny z `round(20/x)`, accuracy→krytyk (stała kolejność rzutów), obrażenia z defem, efekty artefaktów (nth, lifesteal, reflect, execute, firstStrike, per egzemplarz), AoE Maga, leczenie Wojownika, łucznik z dystansem, boss z fazą (2 szkielety, aspd ×1.3), efekty pokoi onEnter (pułapka nie zabija, sanktuarium), ulepszenia pokoi wpływające na walkę (torches, fog, webs, gate HP, altar, ambush, fountain), trasa z tranzytem przez oczyszczone pokoje, limit 6000 tików (timeout=RaidLost), log zdarzeń, `hashRaidLog`. `tools/simulate.ts` (CLI), strona dev `/dev/raid` w Pixi z prędkościami 1×/2×/4× i „Pomiń” (silnik odtwarzania `playback.ts` jest czysty i przetestowany), test Playwright ze zrzutami `artifacts/screens/dev-raid-*.png`.
- Wynik pnpm check: typecheck OK / lint OK / testy: 123 w 14 plikach (w tym 1000 rajdów na losowych lochach: 0 timeoutów, determinizm hash logu, mechaniki). pnpm e2e: 1 test OK. pnpm build OK.
- Decyzje podjęte samodzielnie: patrz DECISIONS.md (M3).
- Znane problemy / dług: balans niedostrojony (bohater bez artefaktów przegrywa z 3 szkieletami na poz. 1), strojenie w M7; efekty pokoi dotyczące lootu (Skarbiec, Pułapka onClear, Kowadło, Brama) i dropy w M4.
- Jak to zobaczyć/uruchomić: pnpm sim:raid -- --seed 123 --class mage --waves 3; pnpm dev i http://localhost:5173/dev/raid.
- Proponowany następny krok: M4 (loot i ulepszenia pokoi).

## Plan M4

1. loot.ts: rzadkość z wag poziomu, wybór artefaktu wagą dropWeight, `planDrops` (pre-roll 4–6 artefaktów i 1–2 ulepszeń, przypisanie potworom wagami: elita ×3, mnożnik pokoju, ołtarz +50%, maks. 1 artefakt na potwora).
2. Integracja z rajdem: finalne składy pokoi (ołtarz krwi dodaje kopię) liczone przed rajdem, dropy przypisane jednostkom przy spawnie, `LootDropped` przy śmierci potwora (dropy niezabitych przepadają), nagrody onClear (Skarbiec 50%, Pułapka +ulepszenie, Kowadło ≥rare, Brama dowolny) ze strumienia `rewards`.
3. `assignUpgrade`/`removeUpgrade` (wymiana wraca do magazynu), `applyRaidLoot` (do plecaka i magazynu).
4. Testy: rozkład liczby i rzadkości dropów, wagi, zgon gubi dropy, ulepszenie zmienia przebieg, onClear.
5. UI minimalne: magazyn ulepszeń i przypisanie do pokoju w Prep.

## Wznowienie po awarii (po części sim M4)

- Zastano: gałąź m4-loot, tagi m0..m3-done, niezacommitowane pliki M4 (loot.ts, upgrades.ts, combat/{context,plan,rewards}.ts, loot.test.ts, zmiany fight/raid/units). Brak index.lock, node_modules sprawne. Wszystkie pliki kompletne; `pnpm check` zielony (149 testów). Nic nie naprawiano, tylko commit.

## Raport M4: Loot i ulepszenia pokoi

- Zrobione: loot.ts (rzadkość z wag poziomu, wybór wagą dropWeight, `planDrops`: 4–6 artefaktów i 1–2 ulepszeń, próbkowanie bez zwracania, maks. 1 na potwora), combat/plan.ts (finalne składy pokoi z Ołtarzem krwi + przypisanie dropów, wagi: elita ×3, mnożnik pokoju, Ołtarz +50%), combat/rewards.ts (`LootDropped` przy śmierci potwora, nagrody onClear: Skarbiec 50%, Pułapka +ulepszenie, Kowadło ≥rare, Brama dowolny), strumienie `drops`, `extra`, `rewards`, `combat` z `fork(label, attempt)`; `assignUpgrade`/`removeUpgrade` (wymiana wraca do magazynu), `applyRaidLoot`. UI: magazyn ulepszeń, przypisanie klikiem do pokoju, zdjęcie klikiem, ikona na pokoju, dodawanie ulepszeń w overlayu.
- Wynik pnpm check: typecheck OK / lint OK / testy: 149 w 15 plikach (rozkład liczby i rzadkości dropów, wagi, zgon gubi dropy, ulepszenie zmienia przebieg, onClear, boss nie dropi, determinizm).
- Decyzje podjęte samodzielnie: patrz DECISIONS.md (M4).
- Znane problemy / dług: brak testu e2e UI ulepszeń (M6); balans niedostrojony.
- Jak to zobaczyć/uruchomić: pnpm dev, w overlayu dodaj ulepszenie, kliknij je w magazynie, potem pokój.
- Proponowany następny krok: M5 (pełna pętla runu w sim).

## Plan M5

1. flow.ts: `startRaid` (Prep, pusta ręka → Action, raidAttempts++), `resolveRaid` (Action → Resolve: loot zostaje, wygrana wavesWon++, porażka lives--, lastRaid), `continueRun` (Resolve → TileOffer / Prep+boss / Prep / GameOver / Victory), `discardUnplaceableTile`, `playRaid`.
2. bots.ts: boty random / greedy-atk / greedy-hp (wybór kafelka losowy, losowe legalne miejsce, ekwipunek wg heurystyki, scalanie, losowe ulepszenia) + `playRun`.
3. Testy: niedozwolone przejścia, wygrany i przegrany run sterowany botem przez wszystkie stany, brak kafelka po porażce, boss na końcu trasy i postawiony przez gracza, zapis/wczytanie między fazami, determinizm całego runu.

## Raport M5: Run i progresja

- Zrobione: flow.ts (`startRaid`, `resolveRaid`, `continueRun`, `discardUnplaceableTile`, `playRaid`), bots.ts (boty random/greedy-atk/greedy-hp, `playRun`), pełna maszyna stanów z 6.1: wygrana → TileOffer, 10. wygrana → oferta bossa z automatycznym wyborem jedynego bossa → Prep, porażka → Prep bez kafelka (loot zostaje), 0 żyć → GameOver, pokonanie bossa → Victory (wavesWon zostaje 10).
- Wynik pnpm check: typecheck OK / lint OK / testy: 162 w 16 plikach (wygrany run 11 rajdów przez wszystkie fazy, przegrany run, niedozwolone przejścia, zapis/wczytanie po każdym kroku, determinizm całego runu, 120 runów botów bez Stuck/timeoutu).
- Decyzje podjęte samodzielnie: patrz DECISIONS.md (M5).
- Znane problemy / dług: UI nie jest jeszcze podpięte pod Start/Action/Resolve (M6c); boty zostaną zamrożone na początku M7.
- Jak to zobaczyć/uruchomić: pnpm test (flow.test.ts).
- Proponowany następny krok: M6a–d (UI).
