# Raport końcowy prototypu

## Co działa

- Pełny run (10 fal + Boss) w przeglądarce: wybór klasy, oferta 3 kafelków, budowa lochu 9×9 (podgląd ducha, tooltip), ekwipunek 9 slotów ze scalaniem do poz. 3, magazyn ulepszeń (klik i drag & drop), wskaźnik zagrożenia, rajd odtwarzany w Pixi (1×/2×/4×/Pomiń), podsumowanie, Victory/GameOver, zapis przez `SaveStore` po każdej zmianie fazy, teksty PL przez i18n, scena 1920×1080 z letterboxem.
- `packages/sim`: czysty TS, deterministyczny (ten sam seed → identyczny log, testy), walka 20 Hz, 4 potwory + Boss z fazą, 5 efektów artefaktów, 5 typów pokoi, 8 ulepszeń, loot z pre-rollem, pełna maszyna stanów, boty.
- Wyniki: `pnpm check` zielony (typecheck, lint, 176 testów w 20 plikach), `pnpm e2e` 8/8 (bot klikający przez UI cały run w trybie Pomiń, Victory i GameOver, drag & drop, tooltip, letterbox, zero błędów w konsoli, zrzuty w `artifacts/screens/`), `pnpm build` OK (`base: './'`, brak żądań sieciowych).
- Balans (10 000 runów na bota, `pnpm balance`): greedy-atk 50,0%, greedy-hp 37,6%, random 2,5%; mediana rajdu poz. ≥ 4: 41–79 s; timeouty 0 na ok. 390 000 rajdów. Pełna tabela iteracji: docs/BALANCE.md.

## Jak uruchomić

```bash
pnpm install
pnpm dev      # gra: http://localhost:5173 (DEV: overlay pod klawiszem `, /dev/raid, ?seed=)
pnpm build    # apps/game/dist
pnpm check    # typecheck + lint + testy
pnpm e2e      # Playwright (pierwszy raz: pnpm exec playwright install chromium)
pnpm balance -- --runs 10000 --bot all
```

## Kryteria niespełnione (sekcja 12 i 14)

- Rozrzut wygranych między klasami ≤ 15 pkt proc.: spełniony dla random (7,0) i greedy-atk (14,8), **niespełniony dla greedy-hp (37,5)**: mag 17,6%, wojownik 40,1%, łotrzyk 55,1%.
- Rajdy na poz. 1–3 ≥ 15 s: mediana poz. 1 ok. 9 s, poz. 2 ok. 14 s (poz. 3 ok. 18 s). **Częściowo niespełnione.**
- Artefakty na run ~45–65: **74–87** (4–6 dropów na rajd + nagrody za oczyszczenie, runy trwają ok. 13 rajdów).
- Pełny run 20–35 min (szacunek): greedy-hp 24,4 min OK; greedy-atk i random ok. 17 min (**ok. 3 min poniżej**).
- Poza tym: tabela skalowania poziomów z 6.7 jest spłaszczona (do 2,15, nie 3,3) i statystyki zostały stroione; to zmiana danych, nie reguł. Kamera w rajdzie nie podąża za bohaterem (widać cały pokój). Wizualia to placeholdery.
- Przyczyna: limit 12 iteracji balansu i zamrożone boty; styl „HP” vs „atak” działa inaczej na klasę Maga i nie dało się go rozdzielić dźwigniami danych.

## Decyzje podjęte samodzielnie (pełna lista w docs/DECISIONS.md)

- pnpm przez corepack (`--install-directory`, bez admina), TypeScript 6 (typescript-eslint nie wspiera 7), `GameData` jako argument funkcji `sim`.
- Liczenie walki: brak statycznych przeszkód (A* bez reguły rogów), spawn potworów ≥ 3 komórki od bohatera, ruch łucznika bez strzelania w trakcie cofania, zaokrąglenia 0,01, tranzyt przez pokoje kosztuje czas.
- Loot: finalne składy pokoi (Ołtarz) i dropy liczone przed rajdem, nagrody onClear ze strumienia `rewards`.
- Run: `startRaid` zwiększa `raidAttempts`, rajd z bossem nie zwiększa `wavesWon`, jeden boss trafia do ręki automatycznie.
- **Odstępstwo od reguł:** w zamkniętym lochu (brak otwartych drzwi) boss może stanąć obok dowolnego zwykłego pokoju, który dostaje drzwi; zwykłe kafelki można odrzucić. Występowało w ok. 1 na 10 000 runów.
- Testy mechanik używają zamrożonych wartości startowych (`loadSpecGameData`), a testy integracyjne i boty — stroionych danych gry.

## Pytania (docs/QUESTIONS.md)

Spójność klas dla stylu „HP”, spłaszczenie tabeli skalowania, liczba artefaktów na run, wyjątek dla bossa, kamera follow, założenie 45 s Prep.

## Blokery (docs/BLOCKERS.md)

Brak. Jedna awaria środowiska (wyłączenie komputera w trakcie M4): praca odzyskana bez strat (wpis „wznowienie po awarii” w PROGRESS.md).

## Proponowane następne kroki

1. Dostroić klasy (zwłaszcza Maga) i zakres dropów; ewentualnie rozszerzyć boty o mieszany styl.
2. Sprite'y i animacje zamiast placeholderów, kamera follow, dźwięk.
3. Wybór bossa 1 z 3 w UI, meta-progresja, pakowanie Electron/Tauri.
