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
