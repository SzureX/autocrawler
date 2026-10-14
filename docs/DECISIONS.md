# Decisions

Format: data, decyzja, powód.

- 2026-10-14: pnpm nie jest zainstalowany, `corepack enable` wymaga uprawnień admina (EPERM). Użyto `corepack enable --install-directory <katalog tymczasowy>` (pnpm 12 przez corepack); brak instalacji globalnej. Powód: zgodność z CLAUDE.md (pnpm workspaces).
- 2026-10-14: TypeScript przypięty do 6.x (`~6`), bo typescript-eslint 8.x nie wspiera TS 7. Powód: lint musi działać.
- 2026-10-14: ESLint bez reguł type-aware (tylko `recommended`); powód: prostota i szybkość, TS i tak sprawdza typy.
- 2026-10-14: API `sim` przyjmuje `GameData` jako pierwszy argument (`createRun(data, seed, classId)`); funkcje czyste nie mają dostępu do globalnych danych. Powód: brak singletonów, łatwe testy.
- 2026-10-14: `RunState` ma dodatkowe pole `nextUid` (licznik deterministycznych id kafelków i artefaktów) oraz `RaidSummary` zdefiniowane w M0. Powód: unikalne, deterministyczne uid bez RNG i zegara.
- 2026-10-14: `createRun` zwraca od razu fazę `TileOffer` (klasa wybrana w argumencie); faza `ClassSelect` istnieje tylko jako stan UI przed utworzeniem runu. Powód: najprostsze odwzorowanie 6.1.
- 2026-10-14: Pokój nr 1 w M0 ma puste `spawns`; od M1 skład potworów jest losowany z seeda `spawns:tile-0` jak dla każdej Komnaty. Powód: sekcja 6.2 mówi, że skład losuje się przy tworzeniu kafelka.
- 2026-10-14: Strumienie RNG `fork` są wyprowadzane z oryginalnego ziarna (nie ze stanu rodzica), więc kolejność użycia nie zmienia wyników. Powód: determinizm odporny na refaktory.
- 2026-10-14: Narzędzia (`tools/`) są pakietem workspace `@loch/tools`, żeby `pnpm typecheck` je obejmował.
- 2026-10-14 (M1): Boss jest wykluczony jako sąsiad połączeń dla zwykłych kafelków i jako pokój pośredni na trasie (ślepy zaułek). Powód: 6.2.
- 2026-10-14 (M1): Strumień `tiles` ma indeks `wavesWon`, więc oferta jest funkcją stanu runu. Powód: determinizm bez dodatkowego licznika.
- 2026-10-14 (M1): Gdyby nawet maska 4-drzwiowa nie miała legalnej pozycji (praktycznie niemożliwe), oferta i tak jest zwrócona; M5 obsługuje to jako pominięcie kafelka. Powód: nie blokować generatora, brak soft locka w testach 1000+ ofert.
- 2026-10-14 (M1): Pokój nr 1 ma losowany skład potworów jak Komnata poziomu 1 (aktualizacja wpisu z M0). Powód: pierwszy rajd ma realną walkę.
- 2026-10-14 (M2): Clampy statystyk w `computeStats`: critChance 0..1, aspd i moveSpeed ≥ 0.1, maxHp ≥ 1, critMult ≥ 1, range ≥ 1, atk/def/accuracy ≥ 0. Powód: ochrona przed degeneracją, spec nie podaje limitów.
- 2026-10-14 (M2): Zakładanie artefaktu na zajęty slot zamienia go z plecakiem; scalanie zużywa pierwsze 3 pasujące egzemplarze w kolejności plecaka. Powód: najprostsze zachowanie.
- 2026-10-14 (M3): Plansza nie ma statycznych przeszkód, więc reguła „bez przecinania rogów” jest pusta; jednostki blokują komórki, ale nie rogi. A* używa heurystyki max(0, Czebyszew − zasięg).
- 2026-10-14 (M3): Potwory pojawiają się w losowych komórkach o odległości Czebyszewa ≥ 3 od bohatera (strumień `combat`); bohater w pokoju nr 1 startuje przy drzwiach S, w kolejnych przy drzwiach przeciwnych do kierunku wejścia; boss stoi na środku planszy.
- 2026-10-14 (M3): Jednostka z HP ≤ 0, która nie została jeszcze usunięta (koniec tiku), nadal wykonuje akcję w tym tiku (umożliwia obustronne zabójstwa); nie można jednak zacząć ataku na cel z HP ≤ 0.
- 2026-10-14 (M3): Zawsze zużywane są 2 rzuty na atak (accuracy, krytyk). Bonusy efektów artefaktów (nth, execute, firstStrike) sumują się addytywnie do mnożnika obrażeń przed redukcją przez DEF; krytyk mnoży wynik. Lifesteal liczy się od faktycznie zadanych obrażeń (bez overkill), także od AoE.
- 2026-10-14 (M3): Łucznik cofa się tylko, gdy jest bliżej niż 3 komórki i ma gdzie; w czasie odliczania kroku nie strzela, a przyparty do ściany strzela. Obrażenia i HP zaokrąglane do 0.01 (HP potworów do całości).
- 2026-10-14 (M3): Przejście przez pokój (też oczyszczony) kosztuje (odległość Czebyszewa wejście→wyjście + 1) × ticksPerCell bohatera; `RoomEnter.duration` to czas marszu poprzedzający wejście. Limit 6000 tików obejmuje marsz.
- 2026-10-14 (M3): Strona `/dev/raid` działa tylko w trybie DEV (ścieżka, nie hash).
- 2026-10-14 (M4): Finalny skład pokoju (kopia od Ołtarza krwi) jest losowany przed rajdem ze strumienia `extra`, żeby pre-roll dropów znał wszystkie potwory. Dropy: ulepszenia losowane równomiernie spośród 8; artefakty zawsze poziomu 1; uid artefaktów nadawane od `run.nextUid` w kolejności upuszczenia.
- 2026-10-14 (M4): Nagrody onClear losowane ze strumienia `rewards:<attempt>`, niezależnego od walki. Nagrody nie są przyznawane, gdy bohater ginie w pokoju. Ulepszenie można przypisać także do pokoju Bossa; zdjęcie ulepszenia (`removeUpgrade`) dodane dla wygody UI.
- 2026-10-14 (M5): `startRaid` zwiększa `raidAttempts` przed symulacją, więc pierwszy rajd używa strumieni z indeksem 1. `resolveRaid(run, result)` robi Action→Resolve i nalicza skutki; `continueRun` wybiera następną fazę. Rajd z bossem nie zwiększa `wavesWon` (zostaje 10), kończy run Victory.
- 2026-10-14 (M5): Przy jednym bossie `continueRun` przechodzi BossOffer→Prep wewnętrznie (kafelek w ręce). Boss nie może zostać odrzucony; zwykły kafelek bez legalnej pozycji można odrzucić (`discardUnplaceableTile`), co w testach nigdy nie jest potrzebne.
- 2026-10-14 (M5): Boty: ulepszenia przypisywane losowo do losowych pokoi; greedy wybiera ekwipunek zachłannie wg celu (DPS lub efektywne HP), random zakłada losowe artefakty w wolne sloty i scala z p=0,5.
- 2026-10-14 (M6): Kamera w rajdzie nie podąża za bohaterem; cały pokój 9×7 jest widoczny (czytelność ponad efekt, lekkie odstępstwo od sekcji 9). Powód: najprostsze i czytelniejsze, brak wpływu na logikę.
- 2026-10-14 (M6): Wynik rajdu w UI nie jest przechowywany w stanie, tylko liczony ponownie z `RunState` (`simulateRaid` jest czysta), dzięki czemu zapis w fazie Action i odświeżenie dają ten sam rajd. Wskaźnik zagrożenia: heurystyka w `sim/threat.ts`, progi 0,45 i 0,9 w `balance.json`.
- 2026-10-14 (M6): Akcje debug (wygraj/przegraj rajd) zamiast prawdziwej walki używają sztucznego wyniku bez łupu; `?seed=` działa tylko w DEV. Testy e2e czekają 150 ms po drag & drop, bo dnd-kit połyka następny klik.
- 2026-10-14 (M7): Testy mechanik używają zamrożonych wartości startowych z CLAUDE.md (`loadSpecGameData`, packages/data/src/fixtures), a nie stroionych danych gry; dzięki temu strojenie balansu nie zmienia oczekiwań testów. Testy integracyjne na prawdziwych danych (loader, boty bez timeoutu/utknięcia) używają `loadGameData`.
- 2026-10-14 (M7): Strojenie obejmuje wartości liczbowe w JSON (statystyki potworów/bossa, wartości artefaktów, tabela skalowania, wagi). Struktura reguł się nie zmienia.
- 2026-10-14 (M7): Odstępstwo od reguł (najmniejsze możliwe): jeśli loch jest „zamknięty” (żadne drzwi nie prowadzą do wolnego pola), kafelek bossa może stanąć obok dowolnego zwykłego pokoju, a ten pokój dostaje drzwi w jego stronę. Bez tego run bywał niewygrywalny (ok. 1 na 10 000 runów). Zwykłe kafelki w takiej sytuacji można odrzucić przyciskiem „Odrzuć kafelek”.
- 2026-10-14 (M7): `RaidSummary.killer` (opcjonalne) przechowuje przyczynę śmierci do telemetrii; stare zapisy bez tego pola nadal się wczytują.
- 2026-10-14 (M7): Dane balansu: patrz docs/BALANCE.md (12 iteracji). Zmieniono: statystyki bohaterów, potworów i bossa, wartości artefaktów, tabelę skalowania poziomów, siłę AoE Maga i leczenie Wojownika. Tabela skalowania z 6.7 jest więc inna niż w specyfikacji (do 2,15 zamiast 3,3).
