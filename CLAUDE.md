# Loch Roguelite: CLAUDE.md

> Robocza nazwa gry: **Loch Roguelite** (placeholder, do zmiany w jednym miejscu: `packages/data/src/meta.json`).
> Ten plik jest źródłem prawdy o grze i zasadach pracy. Jeśli coś w kodzie lub rozmowie mu przeczy, zatrzymaj się i zapytaj.

## 1. Czym jest ten projekt

Webowy prototyp **autobattlera roguelite z budowaniem lochu**. Gracz dobudowuje po jednym pokoju do lochu, ekwipuje bohatera artefaktami, klika „Start” i **patrzy, jak bohater sam przechodzi loch i walczy**. Wygrana rajd daje nowy kafelek pokoju, porażka kosztuje życie. Po 10 wygranych gracz stawia pokój Bossa i jeśli go pokona, wygrywa run.

Cel: **grywalny prototyp pełnego runu** (10 fal + Boss), zbalansowany skryptem, możliwy do spakowania później jako `.exe`. Nie jest to produkt końcowy.

Język komunikacji ze mną: **polski**. Kod, identyfikatory, komentarze, commity: **angielski**. Teksty w grze: **polski** przez i18n (sekcja 10).

---

## 2. Zasady pracy (obowiązują zawsze)

1. **Jeden milestone na raz** (sekcja 11). Nie zaczynaj następnego bez mojej zgody. Aktualny milestone jest oznaczony w sekcji 16.
2. **Najpierw plan, potem kod.** Przed milestone'em napisz krótki plan (5–10 punktów), poczekaj na „ok” tylko jeśli plan odbiega od tego pliku.
3. **Najpierw `packages/sim` z testami, potem UI.** Żadnej logiki gry w komponentach React ani w kodzie Pixi.
4. **Nigdy nie mów „gotowe”, jeśli nie uruchomiłeś `pnpm check`** i nie widziałeś, że przechodzi. Podaj w raporcie rzeczywisty wynik.
5. **Nie naginaj testów, żeby przechodziły.** Test zmieniasz tylko wtedy, gdy jest błędny, i piszesz dlaczego.
6. **Nowe zależności tylko po mojej akceptacji** (z uzasadnieniem). Zatwierdzone na start: `typescript`, `vite`, `@vitejs/plugin-react`, `react`, `react-dom`, `pixi.js`, `zustand`, `immer`, `zod`, `vitest`, `@playwright/test`, `@dnd-kit/core`, `eslint`, `prettier`, `tsx`.
7. **Niejasność w specyfikacji:** wybierz najprostszą opcję zgodną z tym plikiem, zapisz ją w `docs/DECISIONS.md` (data, decyzja, powód) i wspomnij w raporcie. Pytaj tylko wtedy, gdy decyzja blokuje dalszą pracę lub zmienia zasady gry.
8. **Zakres jest zamrożony** (sekcja 13). Nowe pomysły trafiają do `docs/BACKLOG.md`, a nie do kodu.
9. **Weryfikacja wizualna UI:** rób screenshoty przez Playwright (`artifacts/screens/`) i oglądaj je. Do M6 nie poświęcaj czasu na estetykę: placeholdery, czytelność ponad ładność.
10. **Małe commity.** Gałąź na milestone (`m1-grid-building`), commit po zielonych testach, komunikaty w formie `feat(sim): ...`, `fix(data): ...`, `test(sim): ...`. Nie merguj do `main` bez mojej zgody. Nie rób force push.
11. **Raport po każdym milestone'ie** (format niżej).

### Format raportu po milestone'ie

```
## Raport M<n>: <nazwa>
- Zrobione: <lista>
- Wynik `pnpm check`: <typecheck / lint / testy: liczby>
- Decyzje podjęte samodzielnie: <lista lub „brak”> (wpisane do docs/DECISIONS.md)
- Znane problemy / dług: <lista lub „brak”>
- Jak to zobaczyć/uruchomić: <komendy>
- Proponowany następny krok: <1–2 zdania>
```

---

## 3. Twarde zasady techniczne

1. **`packages/sim` to czysty TypeScript.** Zero importów z `react`, `pixi.js`, `zustand`, DOM, `window`, `document`, `localStorage`. W `tsconfig` pakietu `lib: ["ES2022"]` (bez DOM), a w ESLint `no-restricted-imports` dla powyższych.
2. **Zero `Math.random()` i `Date.now()` w `sim`** (reguła ESLint `no-restricted-properties`). Cała losowość pochodzi z seedowanego RNG (sekcja 6.8).
3. **Cały `RunState` jest serializowalny do JSON.** Brak `Map`, `Set`, klas, funkcji w stanie. Używamy `Record<string, T>` i tablic.
4. **Symulacja jest funkcją czystą.** `simulateRaid(run, raidSeed)` zwraca wynik i **log zdarzeń**. Widok (Pixi) tylko odtwarza log z interpolacją i nigdy nie liczy walki sam.
5. **Dane są w JSON** (`packages/data`), walidowane Zod przy starcie. Żadnych liczb balansowych wpisanych w kod.
6. **TypeScript `strict`**, `noUncheckedIndexedAccess`. Zakaz `any` (użyj `unknown` + zawężanie). Zakaz `!` bez komentarza z uzasadnieniem.
7. **Każdy system w `sim` ma testy Vitest** przed podpięciem UI. Test determinizmu (ten sam seed → identyczny log) jest obowiązkowy.
8. **Pliki do ~400 linii.** Dzielimy według odpowiedzialności, a nie „utils.ts” na wszystko.
9. **Brak sieci w runtime:** zero CDN, zero zewnętrznych czcionek i skryptów. Wszystko w bundlu. (Pod przyszłe pakowanie Electron/Tauri.)
10. **Zapis stanu tylko przez interfejs `SaveStore`** (sekcja 10), nigdy bezpośrednio `localStorage` w komponentach.

---

## 4. Stack, struktura i komendy

**Stack:** TypeScript (strict), Vite, PixiJS (odtwarzanie walki), React (UI: menu, plecak, sloty, siatka lochu), Zustand (store UI, opakowuje `sim`), immer (niemutowalne aktualizacje `RunState`), Zod (walidacja danych), Vitest (testy), Playwright (e2e i screenshoty), dnd-kit (drag & drop). Menedżer pakietów: **pnpm** (workspaces). Node ≥ 20.

```
/
├─ CLAUDE.md
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ docs/            DECISIONS.md, BACKLOG.md, BALANCE.md
├─ packages/
│  ├─ sim/          czysty TS: rng, stats, dungeon, combat, loot, run
│  │  └─ src/ + testy obok plików (*.test.ts)
│  └─ data/         JSON + schematy Zod + loader (loadGameData)
├─ apps/
│  └─ game/         Vite: React UI + Pixi view + store + i18n + save
│     └─ src/{ui,view,store,i18n,save,dev}
└─ tools/
   ├─ balance.ts    headless runner N runów
   └─ simulate.ts   pojedynczy rajd z seedem, wypisuje log
```

**Komendy** (muszą istnieć i działać po M0):

| Komenda | Działanie |
|---|---|
| `pnpm install` | instalacja |
| `pnpm dev` | serwer deweloperski gry |
| `pnpm build` | build produkcyjny (`base: './'`) |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` we wszystkich pakietach |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm check` | typecheck + lint + test (**uruchom przed każdym commitem**) |
| `pnpm e2e` | Playwright (smoke test + screenshoty) |
| `pnpm balance -- --runs 10000 --bot greedy-atk` | raport balansu |
| `pnpm sim:raid -- --seed 123 --class warrior` | pojedynczy rajd z logiem |

---

## 5. Słownik (PL ↔ identyfikatory)

| Polski | Kod | Znaczenie |
|---|---|---|
| Run | `Run` | cała gra od wyboru klasy do Victory/GameOver |
| Rajd | `Raid` | jedno przejście bohatera przez loch (faza Action) |
| Fala | `wavesWon` | licznik **wygranych** rajdów (0–10) |
| Loch | `Dungeon` | siatka pokoi |
| Pokój | `Room` / `RoomInstance` | postawiony kafelek |
| Kafelek | `RoomTile` | pokój jeszcze nie postawiony |
| Poziom lochu | `dungeonLevel` | `wavesWon + 1`, skaluje potwory i loot |
| Artefakt | `Artifact` | przedmiot zakładany na bohatera |
| Plecak | `backpack` | artefakty niezałożone, bez limitu |
| Slot | `equipped[0..8]` | 9 slotów ekwipunku |
| Scal | `merge` | 3 takie same artefakty poziomu N → 1 poziomu N+1 |
| Ulepszenie pokoju | `RoomUpgrade` | 1 na pokój, wymienne |
| Życia | `lives` | pula 5 żyć, osobna od HP bohatera |

---

## 6. Reguły gry (zatwierdzone decyzje)

### 6.1 Pętla gry i maszyna stanów

```
ClassSelect → TileOffer → Prep → Action → Resolve ─┬→ TileOffer        (wygrana, wavesWon < 10)
                                                   ├→ BossOffer → Prep (wygrana, wavesWon == 10)
                                                   ├→ Prep             (porażka, lives > 0, BEZ kafelka)
                                                   ├→ GameOver         (lives == 0)
                                                   └→ Victory          (Boss pokonany)
```

- **ClassSelect:** wybór 1 z 3 klas. Loch dostaje **pokój nr 1** (Komnata, wszystkie 4 drzwi) na środku siatki (4,4).
- **TileOffer:** gracz widzi **3 kafelki** (typ pokoju, drzwi, skład potworów) i **wybiera 1**. Reszta znika. Wybrany trafia do `hand`.
- **BossOffer:** po 10. wygranej oferta bossów. W prototypie jest **1 boss**, więc kafelek trafia do `hand` automatycznie. Kod ma obsługiwać wybór 1 z N (lista w danych), żeby wybór 1 z 3 dało się włączyć później bez zmian w `sim`.
- **Prep:** **budowa jest obowiązkowa, gdy `hand` nie jest pusta**: przycisk Start jest nieaktywny, dopóki kafelek nie zostanie postawiony. Nie można go odłożyć. W Prep gracz też zakłada/zdejmuje artefakty, scala artefakty i przypisuje ulepszenia pokoi.
- **Action:** rajd. Gracz może tylko zmieniać prędkość (1×/2×/4×) i klikać „Pomiń”. Brak innej interakcji (**czysty autobattler**).
- **Resolve:** podsumowanie (loot, wynik). Wygrana: `wavesWon++`. Porażka: `lives--`.
- **Po porażce gracz NIE dostaje kafelka** i wraca do Prep na tym samym lochu (budowa pomijana, bo `hand` jest pusta). Loot zebrany przed śmiercią **zostaje**.
- **Boss:** po `wavesWon == 10` gracz **sam stawia** kafelek Bossa (regułami z 6.2), a bohater odwiedza go **zawsze na końcu trasy**. Rajd z Bossem to 11. rajd, porażka kosztuje życie jak zwykle. Pokonanie Bossa → `Victory`.
- `lives == 0` → `GameOver`. Start: `lives = 5`.

### 6.2 Loch i budowanie

- Siatka **9×9**, limit **15 pokoi** (bez Bossa) jako zabezpieczenie (przy 11 możliwych pokojach nie powinien zadziałać).
- Kafelek 1×1 z **maską drzwi** (`Dir[]` z `N`,`E`,`S`,`W`). **Bez rotacji, bez usuwania i przestawiania** pokoi.
- **Poprawne położenie kafelka** `p`: komórka pusta i w siatce, sąsiaduje (4 kierunki) z ≥ 1 pokojem `r`, przy czym **`r` ma drzwi w stronę `p` ORAZ kafelek ma drzwi w stronę `r`**. Pokój łączy się ze **wszystkimi** sąsiadami spełniającymi ten warunek (mogą powstać cykle).
- **Gwarancja braku soft locka:** generator ofert musi zapewnić, że **każdy oferowany kafelek ma ≥ 1 legalne położenie**. Jeśli nie ma, losuj maskę drzwi ponownie (do 20 razy), potem użyj maski z 4 drzwiami.
- Maska drzwi kafelka: 2 drzwi (50%), 3 (35%), 4 (15%). Kafelek Bossa ma 4 drzwi, ale boss jest ślepym zaułkiem trasy.
- **Trasa rajdu:** DFS (preorder, kolejność sąsiadów N,E,S,W) po pokojach niebędących Bossem, od pokoju nr 1. Przejścia między kolejnymi pokojami idą najkrótszą ścieżką po grafie (cofanie przez oczyszczone pokoje liczy się do czasu). Na końcu najkrótsza ścieżka do Bossa. Trasa jest funkcją czystą z testami na ≥ 20 układach.
- **Skład potworów** jest losowany **raz, przy tworzeniu kafelka** (seed z `runSeed` + `tile.uid`) i potem **stały**. Gracz widzi go przy wyborze kafelka i w **tooltipie** nad pokojem (ikony × liczba, elita oznaczona). Statystyki potworów skalują się z `dungeonLevel` w momencie startu rajdu, a skład się nie zmienia.
- Potwory **respawnują się przy każdym rajdzie** (też po porażce), bohater też.

### 6.3 Bohater i statystyki

`StatBlock`: `maxHp`, `atk`, `aspd` (ataki/s), `def`, `moveSpeed` (komórki/s), `critChance`, `critMult`, `accuracy` (domyślnie 1.0), `range` (komórki).

**Kolejność liczenia statystyk** (stała, nie zmieniaj bez zgody):

```
final = (base + Σ flat) × (1 + Σ percentAdd) × Π percentMult
```

**Obrażenia:** `dmg = max(1, atk × 100 / (100 + def))`, krytyk mnoży przez `critMult`. Trafienie: rzut na `accuracy`, potem rzut na krytyk (stała kolejność rzutów).

Bohater **nie ma XP ani poziomów w runie**: moc pochodzi tylko z artefaktów. HP odnawia się do pełna na starcie każdego rajdu, w rajdzie leczą tylko efekty (Sanktuarium, Fontanna, pasywka Wojownika, lifesteal).

### 6.4 Artefakty, plecak i scalanie

- **9 slotów** ekwipunku bez typów. Zakładanie/zdejmowanie **tylko w Prep**. Duplikaty dozwolone, plecak bez limitu.
- Artefakt ma **rzadkość** (`common`, `rare`, `epic`: wartość bazowa i waga dropu) oraz **poziom** (1–3: mnożnik siły). To niezależne systemy.
- **Scalanie:** przycisk „Scal” → gracz wybiera stos artefaktu w plecaku → gra zużywa **3 sztuki tego samego `artifactId` i tego samego poziomu** i daje 1 o poziom wyższy. Maks. poziom 3. **Tylko artefakty z plecaka** (założone trzeba najpierw zdjąć).
- **Mnożnik poziomu** `levelMult`: poziom 1 = ×1, poziom 2 = ×2, poziom 3 = ×4.
  - `flat` i `percentAdd`: `value × levelMult`.
  - `percentMult`: `1 + (value − 1) × levelMult`.
  - Parametry efektów (`value`) też mnożymy przez `levelMult`.
- Efekty specjalne tego samego typu z kilku artefaktów **sumują się** (liczniki „co N-ty atak” są osobne dla każdego egzemplarza).

### 6.5 Walka (symulacja)

- **Tik:** 20 Hz (`dt = 0.05 s`), stały krok. `cooldownTicks = round(20 / aspd)`, `ticksPerCell = round(20 / moveSpeed)`.
- **Plansza pokoju:** 9×7 komórek, drzwi w środkach boków: N `(4,0)`, S `(4,6)`, W `(0,3)`, E `(8,3)`. Ruch w 8 kierunkach, A* (bez przecinania rogów), 1 jednostka na komórkę. Zasięg liczony metryką Czebyszewa.
- **Wejście do pokoju:** bohater pojawia się przy drzwiach, którymi wszedł. Wszystkie potwory w pokoju od razu go ścigają (brak promienia agro). Efekty `onEnter` pokoju działają przed pierwszym tikiem walki.
- **Kolejność w tiku:** jednostki w rosnącej kolejności `id` (bohater ma id 0). Śmierci są przetwarzane na końcu tiku, więc obustronne zabójstwa w tym samym tiku są możliwe.
- **Wybór celu:** najbliższy wróg, remis rozstrzyga niższe `id`. Ponowna ocena co 10 tików i po śmierci celu.
- **Dystans:** Łucznik utrzymuje odstęp ≥ 3 komórek (cofa się, jeśli ma gdzie, inaczej strzela). Mag (bohater) atakuje z `range 4`, a trafienie zadaje 60% obrażeń wrogom w promieniu 1 od celu.
- **Pokój oczyszczony** = wszystkie potwory martwe. Wtedy działają efekty `onClear`, a bohater idzie do następnego pokoju trasy.
- **Koniec rajdu:** `RaidWon` (wszystkie pokoje oczyszczone, w rajdzie z Bossem: Boss martwy), `RaidLost` (HP bohatera = 0). **Zabezpieczenie:** limit 6000 tików (300 s symulowanych) → `RaidLost` z powodem `timeout`. W testach timeout nie może wystąpić (0 na 1000 rajdów).
- **Efekty artefaktów:** `everyNthAttack` (co 5. atak: +100% × levelMult obrażeń), `lifesteal` (5% × levelMult zadanych obrażeń), `reflect` (15% × levelMult otrzymanych obrażeń, odbicie nie wyzwala odbicia), `executeBonus` (+50% × levelMult obrażeń wobec wrogów < 30% HP), `firstStrike` (pierwszy atak w każdym pokoju: +100% × levelMult).
- **Log zdarzeń** (typy): `RaidStart`, `RoomEnter`, `Move`, `Attack`, `Damage`, `Heal`, `Death`, `PhaseChange`, `Spawn`, `RoomCleared`, `LootDropped`, `RaidEnd`. Każde zdarzenie ma `tick`. Wystarcza do pełnego odtworzenia walki w widoku.
- **Tryb „Pomiń”:** wynik jest już policzony (log gotowy), więc widok skacze na koniec.

### 6.6 Loot i ulepszenia pokoi

- **Pre-roll dropu na starcie rajdu:** `artifactDrops = rngInt(4, 6)` (zakres w danych, strojony per `dungeonLevel`), ograniczone do liczby potworów. Dropy są **przypisywane losowym potworom** (waga: zwykły 1, elitarny 3, mnożniki pokoi z 8.3), maks. 1 artefakt na potwora. Analogicznie `upgradeDrops = rngInt(1, 2)` ulepszeń pokoi (osobne losowanie). Jeśli bohater zginie, dropy niezabitych potworów przepadają.
- **Rzadkość dropu** zależy od `dungeonLevel` (wagi `common/rare/epic`): poziomy 1–3: 80/18/2, 4–6: 60/32/8, 7–11: 40/42/18. Konkretny artefakt wybierany wagą `dropWeight` z puli danej rzadkości.
- **Wszystko trafia automatycznie do plecaka / magazynu ulepszeń** (bez wyboru).
- **Ulepszenia pokoi:** 1 na pokój, trwałe, wymienne. Zastąpione ulepszenie **wraca do magazynu**. Przypisanie: tylko w Prep.
- Boss nie dropi niczego (koniec runu).

### 6.7 Skalowanie trudności

`dungeonLevel = wavesWon + 1` (1–11). Dotyczy **wszystkich pokoi**, także starych. Mnożnik HP i ATK potworów (Boss też):

| Poziom | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 (rajd z Bossem) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Mnożnik | 1.0 | 1.1 | 1.2 | 1.4 | 1.6 | 1.8 | 2.1 | 2.4 | 2.7 | 3.0 | 3.3 |

Bazowa liczba potworów w Komnacie przy generowaniu kafelka: poziomy 1–3: 2–3, 4–6: 3–4, 7–11: 4–5. Brutal pojawia się dopiero od poziomu 3. Bez dynamicznego dopasowania do siły bohatera.

### 6.8 RNG

- Jeden generator `mulberry32` z ziarna `runSeed` (losowe, widoczne w debug overlay).
- Funkcja `rng.fork(label, index)` wyprowadza niezależne strumienie przez hash `(seed, label, index)`. Używane strumienie: `tiles`, `spawns:<tileUid>`, `drops:<raidAttempt>`, `combat:<raidAttempt>`.
- `raidAttempt` rośnie przy **każdym** rajdzie (też przegranym), więc powtórka tego samego lochu daje inny przebieg, ale odtwarzalny.

---

## 7. Model danych (szkic typów, trzymaj się go)

```ts
type Dir = 'N' | 'E' | 'S' | 'W';
type Rarity = 'common' | 'rare' | 'epic';
type RunPhase = 'ClassSelect' | 'TileOffer' | 'BossOffer' | 'Prep' | 'Action' | 'Resolve' | 'Victory' | 'GameOver';

interface StatBlock { maxHp: number; atk: number; aspd: number; def: number; moveSpeed: number;
                      critChance: number; critMult: number; accuracy: number; range: number; }

interface StatModifier { stat: keyof StatBlock; kind: 'flat' | 'percentAdd' | 'percentMult'; value: number; }

interface ArtifactInstance { uid: string; artifactId: string; level: 1 | 2 | 3; }

interface SpawnSpec { monsterId: string; elite: boolean; }

interface RoomTile { uid: string; roomTypeId: string; doors: Dir[]; spawns: SpawnSpec[];
                     isBoss: boolean; bossId?: string; }

interface RoomInstance extends RoomTile { pos: { x: number; y: number }; order: number; upgradeId: string | null; }

interface DungeonState { rooms: Record<string, RoomInstance>; /* key "x,y" */ startKey: string; }

interface RunStats { raids: number; wins: number; losses: number; merges: number; artifactsFound: number; }

interface RunState {
  saveVersion: number; seed: number; classId: string; phase: RunPhase;
  lives: number;                      // starts at 5
  wavesWon: number;                   // 0..10
  raidAttempts: number;
  dungeon: DungeonState;
  hand: RoomTile[];                   // 0..1 in practice
  tileOffer: RoomTile[];              // 3 tiles or boss tiles
  backpack: ArtifactInstance[];
  equipped: (ArtifactInstance | null)[];   // length 9
  upgradeStorage: string[];           // roomUpgradeIds
  lastRaid: RaidSummary | null;
  stats: RunStats;
}
```

Dane (`packages/data`): `classes`, `artifacts`, `roomTypes`, `monsters`, `bosses`, `roomUpgrades`, `balance` (tabela skalowania, wagi, zakresy dropów). Wszystko po `id` w `snake_case`, nazwy i opisy jako **klucze i18n** (`nameKey`, `descKey`). Loader sprawdza unikalność `id` i istnienie wszystkich referencji (test).

API `sim` (funkcje czyste, `RunState → RunState`): `createRun(seed, classId)`, `generateTileOffer`, `chooseTile`, `legalPlacements`, `placeTile`, `equip`, `unequip`, `mergeArtifacts`, `assignUpgrade`, `startRaid`, `simulateRaid`, `resolveRaid`, `computeHeroStats`, `computeRaidRoute`.

---

## 8. Treść prototypu (wartości startowe, strojone skryptem balansu)

### 8.1 Klasy (3)

| id | HP | ATK | ASPD | DEF | Ruch | Krytyk | Zasięg | Cecha |
|---|---|---|---|---|---|---|---|---|
| `warrior` | 120 | 10 | 1.0 | 8 | 2.5 | 5% ×1.5 | 1 | Leczy 3% maxHP po zabiciu potwora |
| `rogue` | 80 | 12 | 1.6 | 3 | 2.5 | 20% ×2.0 | 1 | Wysoki krytyk |
| `mage` | 70 | 16 | 0.8 | 2 | 2.5 | 5% ×1.5 | 4 | Atak obszarowy (promień 1, 60% obrażeń) |

### 8.2 Potwory (4 + Boss)

| id | HP | ATK | ASPD | DEF | Ruch | Zasięg | Rola |
|---|---|---|---|---|---|---|---|
| `rat` | 20 | 4 | 1.4 | 0 | 3.0 | 1 | Szybki, słaby, w grupach |
| `skeleton` | 45 | 7 | 1.0 | 4 | 2.0 | 1 | Standardowy wojownik |
| `archer` | 30 | 8 | 0.9 | 1 | 1.8 | 5 | Dystans, trzyma odstęp 3 |
| `brute` | 110 | 11 | 0.6 | 8 | 1.4 | 1 | Wolny, dużo HP (od poziomu 3) |
| `warden` (Boss) | 600 | 14 | 0.8 | 10 | 1.6 | 1 | 2 fazy: przy ≤ 50% HP jednorazowo wzywa 2 szkielety i ma ASPD ×1.3 |

**Elita:** HP ×2.5, ATK ×1.5, waga dropu ×3. Wagi wyboru potworu w Komnacie: `rat` 30, `skeleton` 35, `archer` 20, `brute` 15.

### 8.3 Typy pokoi (5 + Boss)

Wagi w ofercie kafelków: Komnata 40, pozostałe po 15. W ofercie 3 kafelków typy różne, jeśli się da.

| id | Skład potworów | Efekt |
|---|---|---|
| `chamber` (Komnata) | bazowa liczba z 6.7 | brak |
| `elite_room` (Pokój elity) | 1 elitarny potwór | waga dropu ×3 (z reguły elity) |
| `treasury` (Skarbiec) | bazowa − 1 (min. 1) | waga dropu potworów ×2, 50% szansy na +1 artefakt po oczyszczeniu |
| `trap_room` (Pułapka) | bazowa − 1 (min. 1) | `onEnter`: 20% maxHP obrażeń (nie zabija, zostawia ≥ 1 HP), `onClear`: gwarantowane +1 ulepszenie pokoju |
| `sanctuary` (Sanktuarium) | bazowa − 1 (min. 1) | `onEnter`: leczy 30% maxHP |
| `boss_room` | Boss | tylko dla Bossa |

### 8.4 Artefakty (15: 10 statystyk + 5 efektów)

Waga dropu w obrębie rzadkości: równa. Tagi (`tank`, `blade`, `swift`, `vampire`) są tylko w danych, bez mechaniki w prototypie.

| id | Rzadkość | Efekt | Tag |
|---|---|---|---|
| `iron_helm` | common | +20 maxHp (flat) | tank |
| `leather_armor` | common | +3 def (flat) | tank |
| `sharp_dagger` | common | +3 atk (flat) | blade |
| `runner_boots` | common | +10% moveSpeed (percentAdd 0.10) | swift |
| `swift_ring` | rare | +15% aspd (percentAdd) | swift |
| `vigor_amulet` | rare | +15% maxHp (percentAdd) | tank |
| `rune_sword` | rare | +20% atk (percentAdd) | blade |
| `hunter_monocle` | rare | +8% critChance (flat 0.08) | blade |
| `guardian_mail` | epic | +6 def (flat), +10% maxHp (percentAdd) | tank |
| `ruler_crown` | epic | +15% atk, +10% aspd (percentAdd) | blade |
| `echo_hammer` | rare | efekt `everyNthAttack` (n=5, +100%) | blade |
| `vampire_stone` | rare | efekt `lifesteal` (5%) | vampire |
| `thorn_spikes` | rare | efekt `reflect` (15%) | tank |
| `headhunter_ring` | epic | efekt `executeBonus` (+50% poniżej 30% HP) | blade |
| `first_blow_signet` | epic | efekt `firstStrike` (+100%) | blade |

### 8.5 Ulepszenia pokoi (8)

| id | Efekt |
|---|---|
| `blood_altar` | +1 potwór (kopia losowego), waga dropu potworów w pokoju +50% |
| `fountain` | po oczyszczeniu leczy 20% maxHP bohatera |
| `anvil` | po oczyszczeniu +1 artefakt o rzadkości ≥ `rare` |
| `fog` | −20% accuracy wszystkich w pokoju (bohater też) |
| `torches` | bohater +15% aspd w tym pokoju |
| `sticky_webs` | potwory −30% moveSpeed |
| `guardian_gate` | potwory +25% HP, po oczyszczeniu +1 artefakt (dowolna rzadkość) |
| `ambush` | pierwszy atak bohatera w pokoju to gwarantowany krytyk |

---

## 9. UI i UX

- **Platforma:** tylko pulpit, mysz. Rozdzielczość projektowa **1920×1080**, skalowana z zachowaniem proporcji (letterbox). Bez mobile i bez kontrolera.
- **Styl do końca M6:** placeholdery (kolorowe kształty + emoji). Sprite'y podmieniane przez manifest `assets` bez zmian w logice. Referencje klimatu: Backpack Hero, Slay the Spire, Dungeon Clawler.
- **Ekrany:**
  1. **Wybór klasy**: 3 karty ze statystykami i cechą.
  2. **Oferta kafelków / bossa**: 3 kafelki z typem, drzwiami i listą potworów widoczną od razu.
  3. **Prep** (główny ekran): siatka lochu 9×9 (React/DOM) z podglądem „ducha” i podświetleniem legalnych pozycji, kafelek z `hand`, plecak (stosy z licznikiem), 9 slotów, magazyn ulepszeń, panel statystyk z różnicą przed/po (zielone/czerwone), przycisk „Scal”, przycisk Start. **Tooltip nad pokojem:** typ, potwory (ikony × liczba, elita oznaczona), ulepszenie.
  4. **Rajd**: płótno Pixi (pokój z góry, kamera za bohaterem), HUD: HP, nazwa pokoju, przyciski 1×/2×/4×/Pomiń, krótki log zdarzeń.
  5. **Podsumowanie rajdu**: wynik, lista lootu, utracone życie.
  6. **Victory / GameOver**: statystyki runu, przycisk „Nowy run”.
- **Stały HUD:** 5 ikon żyć, „Fala X/10”, poziom lochu.
- **Przed Startem:** szacunkowy wskaźnik zagrożenia lochu (np. suma HP potworów vs. HP/DPS bohatera, 3 stopnie), żeby decyzje były świadome.
- **Drag & drop** (dnd-kit): zakładanie artefaktów i przypisywanie ulepszeń. Każda akcja musi działać też **kliknięciem** (wybierz, potem cel), co upraszcza testy Playwright.
- **Debug overlay** (tylko `import.meta.env.DEV`, klawisz `` ` ``): faza, seed, tik, przyciski „wygraj/przegraj rajd”, dodaj artefakt, ustaw `wavesWon`, eksport `RunState` do JSON.
- **Dźwięk:** poza zakresem do końca prototypu. Jeśli zostanie czas w M7: proste SFX przez cienką warstwę `AudioBus`.

---

## 10. Zapis, i18n, pakowanie

- **`SaveStore`** (interfejs w `apps/game/src/save`): `load(): RunState | null`, `save(state)`, `clear()`. Domyślna implementacja: `LocalStorageSaveStore` (try/catch na każdy zapis/odczyt, pusty storage nie może wywalić aplikacji). Pole `saveVersion` + stub migracji. **Autozapis po każdej zmianie fazy.** Przyszła podmiana na zapis do pliku (Electron/Tauri) ma wymagać zmiany tylko tej implementacji.
- **i18n:** własna funkcja `t(key, params?)`, plik `apps/game/src/i18n/pl.json`. **Żadnego polskiego tekstu w komponentach ani w kodzie.** Nazwy/opisy z danych przez klucze, np. `artifact.iron_helm.name`. Opisy w prototypie są **rzeczowe, bez humoru** (humor dopiero po prototypie). Struktura gotowa na `en.json`.
- **Pakowanie pod `.exe` (po prototypie, Electron lub Tauri):** `base: './'` w Vite, brak CDN, wszystkie assety i czcionki w bundlu, sterowanie nie zależy od skrótów przeglądarki (F5, prawy przycisk), zapis przez `SaveStore`.

---

## 11. Milestone'y

Każdy milestone kończy się: zielonym `pnpm check`, raportem (sekcja 2) i aktualizacją sekcji 16.

### M0: Fundament
- Monorepo pnpm, `tsconfig.base.json`, ESLint (reguły z sekcji 3), Prettier, Vitest, skrypty z sekcji 4.
- `packages/data`: schematy Zod, loader z walidacją referencji, pliki JSON z danymi z sekcji 8 (nawet jeśli efekty nie są jeszcze zaimplementowane).
- `packages/sim`: RNG z `fork`, szkielet maszyny stanów `RunPhase`, `createRun`, serializacja/deserializacja `RunState`.
- `apps/game`: pusty ekran z debug overlay (faza, seed, przyciski przejść), `SaveStore`, `t()` z `pl.json`.
- **Gotowe, gdy:** `pnpm dev` pokazuje overlay przełączający fazy, `RunState` zapisuje się i wczytuje (round-trip test), dane przechodzą walidację, `pnpm check` zielony.

### M1: Siatka i budowanie
- `legalPlacements`, `placeTile`, generator ofert kafelków (z gwarancją legalnego położenia), generowanie `spawns` z ziarna, `computeRaidRoute` (DFS + Boss na końcu).
- UI minimalne: siatka Prep z podglądem ducha i klikaniem.
- **Gotowe, gdy:** testy jednostkowe reguł położenia (łącznie z cyklami i brakiem soft locka na 1000 losowych ofert), test trasy na ≥ 20 układach, ten sam seed daje te same oferty.

### M2: Bohater, statystyki, artefakty
- `computeHeroStats` (kolejność z 6.3), 3 klasy, 15 artefaktów, `equip`/`unequip` (9 slotów), `mergeArtifacts` z `levelMult`, efekty jako dane (logika efektów w M3).
- UI minimalne: plecak ze stosami, 9 slotów, panel statystyk z różnicą przed/po, przycisk „Scal”.
- **Gotowe, gdy:** testy każdego typu modyfikatora i ich kolejności, testy scalania (3→1, maks. poziom 3, tylko plecak, brak scalania poniżej 3 sztuk), zmiana slotów natychmiast zmienia statystyki.

### M3: Symulacja walki
- Plansza pokoju, A*, AI wyboru celu, ataki, krytyki, accuracy, efekty artefaktów, efekty pokoi (`onEnter`/`onClear`), przejścia między pokojami, 4 potwory + Boss z fazami, log zdarzeń, limit tików.
- **M3.9:** dev-owa strona `/dev/raid` w Pixi odtwarzająca log (placeholdery, prędkości 1×/2×/4×, „Pomiń”) i screenshot Playwright.
- **Gotowe, gdy:** 1000 rajdów headless bez zawieszenia i **bez timeoutu**, ten sam seed → identyczny hash logu, testy poszczególnych mechanik (zasięg, cooldown, AoE Maga, lifesteal, odbicie, faza Bossa), `tools/simulate.ts` działa.

### M4: Loot i ulepszenia pokoi
- Pre-roll dropów (4–6 artefaktów, 1–2 ulepszenia) i przypisanie potworom, wagi rzadkości z 6.6, 8 ulepszeń pokoi, `assignUpgrade` (wymiana wraca do magazynu), efekty `onClear` (Pułapka, Skarbiec, Kowadło).
- **Gotowe, gdy:** testy rozkładu dropów (liczba, rzadkość względem poziomu), ulepszenie zmienia przebieg rajdu przy tym samym seedzie, zginięcie bohatera gubi dropy niezabitych potworów.

### M5: Run i progresja (cały run w `sim`, bez ładnego UI)
- Pełna maszyna stanów z 6.1 (TileOffer, BossOffer, Prep, Action, Resolve), życia, `wavesWon`, tabela skalowania z 6.7, kafelek Bossa stawiany przez gracza i odwiedzany na końcu, Victory/GameOver, brak kafelka po porażce, zapis/wczytanie między fazami.
- **Gotowe, gdy:** test sterowany botem przechodzi **wygrany run** i **przegrany run** przez wszystkie stany bez ręcznej interwencji, testy niedozwolonych przejść (Start bez postawienia kafelka, scalanie założonych itd.).

### M6: UI i „game feel”
Wykonuj podetapami, każdy z screenshotem i raportem:
- **M6a:** ekran klasy + oferta kafelków (tooltip ze składem potworów).
- **M6b:** pełny Prep (drag & drop + kliknięcia, wskaźnik zagrożenia, panel różnic).
- **M6c:** ekran rajdu (Pixi, HUD, log, prędkości) + podsumowanie rajdu + Victory/GameOver.
- **M6d:** skalowanie 1920×1080, i18n bez twardych tekstów, minimalne VFX (liczby obrażeń, błysk trafienia, animacja dropu).
- **Gotowe, gdy:** test Playwright przechodzi cały run (bot klikający przez UI, tryb „Pomiń”) i zapisuje screenshoty każdego ekranu, bez błędów w konsoli.

### M7: Balans, telemetria, domknięcie
- `tools/balance.ts`: 10 000 runów, boty `random`, `greedy-atk`, `greedy-hp` (wybór kafelka losowy, budowa w losowym legalnym miejscu, ekwipunek wg heurystyki, scalanie zawsze gdy możliwe, ulepszenia losowo).
- Raport do `docs/BALANCE.md`: odsetek wygranych na klasę i bota, zgony per poziom lochu, mediana czasu rajdu, liczba scaleń i artefaktów na run, liczba timeoutów.
- Telemetria lokalna (bez sieci): `track(event, props)` do bufora w pamięci + eksport JSON w debug overlay (fala, życia, klasa, ekwipunek, przyczyna śmierci).
- **Gotowe, gdy:** cele z sekcji 12 spełnione, README z instrukcją uruchomienia, `pnpm build` działa z `base: './'`.

---

## 12. Cele balansu (kryteria dla M7)

| Metryka | Cel |
|---|---|
| Odsetek wygranych runów bota `greedy-atk` / `greedy-hp` | **35–55%** |
| Bot `random` | co najmniej 10 pkt proc. gorszy niż `greedy` (decyzje mają znaczenie) |
| Rozrzut wygranych między klasami | ≤ 15 pkt proc. |
| Mediana rajdu przy poziomie lochu ≥ 4 | 30–90 s (symulowane, 1×); wcześniejsze rajdy mogą być krótsze, ale ≥ 15 s |
| Pełny run | 20–35 min z fazami Prep (szacunek) |
| Timeouty rajdu | 0 |
| Artefakty na run | ~45–65 dropów, scalenie do poziomu 2 typowe, poziomu 3 możliwe dla pospolitych |

Balans zmieniamy **wyłącznie w danych** (`packages/data`), a po każdej zmianie uruchamiamy `pnpm balance` i wklejamy wynik do raportu.

---

## 13. Poza zakresem prototypu (nie implementuj, dopisz do `docs/BACKLOG.md`)

Meta-progresja i odblokowania (ale `RunState` jest tak zaprojektowany, żeby dało się dodać), wiele map, fabuła, multiplayer, kontroler, zapis w chmurze, mobile, humor w opisach, wybór bossa 1 z 3 w UI (dane i `sim` są gotowe, w prototypie jest 1 boss), rotacja/usuwanie/przestawianie pokoi, XP i poziomy bohatera, synergie zestawów artefaktów (tagi są tylko w danych), dźwięk (opcjonalnie w M7), pakowanie Electron/Tauri (po prototypie).

---

## 14. Definition of Done prototypu

1. Pełny run (10 fal + Boss) jest **przechodzalny i przegrywalny** w przeglądarce, od wyboru klasy do Victory/GameOver.
2. 3 klasy, 15 artefaktów ze scalaniem do poziomu 3, 5 typów pokoi + pokój Bossa, 4 potwory + Boss, 8 ulepszeń pokoi.
3. Wszystkie reguły z sekcji 6 zaimplementowane i pokryte testami `sim`.
4. Determinizm: ten sam seed → identyczny przebieg i log.
5. Cele balansu z sekcji 12 spełnione na raporcie `pnpm balance`.
6. Zapis/wczytanie runu działa, teksty po polsku przez i18n, UI skaluje się z 1920×1080.
7. `pnpm check` i `pnpm e2e` zielone, `pnpm build` działa offline.

---

## 15. Założenia domyślne (do weryfikacji, zmiana wymaga mojej zgody)

- Wartości liczbowe z sekcji 6–8 są **startowe**: mają być stroione skryptem balansu, a nie „na czuja”.
- Pokój nr 1 ma wszystkie 4 drzwi i jest Komnatą.
- Zastąpione ulepszenie pokoju wraca do magazynu.
- Trap nie zabija bohatera (zostawia ≥ 1 HP).
- Pokój Bossa łączy się z każdym sąsiadem spełniającym regułę drzwi, ale trasa kończy się w nim.
- Seed runu jest losowy i niewybieralny przez gracza.

---

## 16. Status milestone'ów (aktualizuj po każdym)

- [x] M0: Fundament (tag m0-done)
- [ ] M1: Siatka i budowanie  ← **aktualny**
- [ ] M2: Bohater, statystyki, artefakty
- [ ] M3: Symulacja walki
- [ ] M4: Loot i ulepszenia pokoi
- [ ] M5: Run i progresja
- [ ] M6: UI i „game feel” (a, b, c, d)
- [ ] M7: Balans, telemetria, domknięcie
