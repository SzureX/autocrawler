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
