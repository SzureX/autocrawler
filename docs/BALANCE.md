# Balans

Zasady: zmieniam wyłącznie dane (`packages/data/src/json`), maks. 12 iteracji, boty zamrożone od początku M7
(`packages/sim/src/bots.ts`, commit 484700f). Każdy pomiar pełnym harnessem (`pnpm balance`) na zmienionych
danych liczę jako iterację i wpisuję tutaj. Pomiar bazowy (iteracja 0) nie wlicza się do limitu.
Czas runu = suma symulowanych rajdów (1×) + 45 s Prep na rajd (szacunek).

## Wynik końcowy (iteracja 12, 10 000 runów na bota)

| Metryka (cel z sekcji 12)                         | Wynik                                                                | Status                                                |
| ------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Wygrane greedy-atk / greedy-hp (35–55%)           | 50,0% / 37,6%                                                        | spełnione                                             |
| random co najmniej 10 pkt proc. gorszy niż greedy | 2,5%                                                                 | spełnione                                             |
| Rozrzut wygranych między klasami (≤ 15 pkt proc.) | greedy-atk 14,8; random 7,0; greedy-hp 37,5                          | niespełnione dla greedy-hp (mag 17,6%, łotrzyk 55,1%) |
| Mediana rajdu na poz. ≥ 4 (30–90 s)               | 41,0 s (atk), 78,8 s (hp), 43,3 s (random)                           | spełnione                                             |
| Rajdy na poz. 1–3 (≥ 15 s)                        | mediana 9–18 s (poz. 1: ok. 9 s, poz. 2: ok. 14 s, poz. 3: ok. 18 s) | częściowo niespełnione (poz. 1–2 poniżej 15 s)        |
| Pełny run (20–35 min, szacunek)                   | 17,1 min (atk), 24,4 min (hp), 17,0 min (random)                     | spełnione dla hp; atk i random ok. 3 min poniżej      |
| Timeouty                                          | 0 na ok. 390 000 rajdów                                              | spełnione                                             |
| Artefakty na run (45–65)                          | 74–87 (z nagrodami za oczyszczenie pokoi)                            | niespełnione (za dużo o 15–30%)                       |

Przyczyna niespełnień: wyczerpany limit 12 iteracji. Klasa Mag jest silna przy stylu „atak” i słaba przy stylu
„HP” (jej siła zależy od tempa zabijania), a dźwignie danych (HP, ATK, ASPD, AoE) działają na oba style podobnie,
więc nie udało się ich rozdzielić. Boty były zamrożone i nie były dopasowywane do wyników.

Poprawka sim wykryta w trakcie pomiarów: w ok. 1 na 10 000 runów loch był „zamknięty” (żadne drzwi nie prowadziły
do wolnego pola), więc kafelek bossa nie miał legalnego położenia. Wprowadzono wyjątek wyłącznie dla bossa
(patrz DECISIONS.md); pomiary iteracji 1–11 powstały przed poprawką (runy z tym przypadkiem kończyły się błędem
harnessu), iteracja 12 już po niej.

Tabela iteracji (wygrane: random / greedy-atk / greedy-hp; ziarna od 1; iteracje 1–11 po 3000 runów na bota):

| #   | Zmiana w danych                                                                         | random | greedy-atk | greedy-hp |
| --- | --------------------------------------------------------------------------------------- | ------ | ---------- | --------- |
| 1   | potwory i boss: ATK ×0,5, HP ×0,8                                                       | 0,0%   | 0,0%       | 0,0%      |
| 2   | wartości artefaktów i efektów ×2                                                        | 0,0%   | 0,0%       | 0,2%      |
| 3   | tabela skalowania poziomów: przyrost ×0,5 (do 2,15)                                     | 0,0%   | 5,2%       | 20,5%     |
| 4   | bohater: ATK ×1,4, HP ×1,3                                                              | 0,1%   | 21,2%      | 54,9%     |
| 5   | łotrzyk HP156/DEF6, mag HP120/DEF4, łucznik ATK 3,2, boss HP 360                        | 2,1%   | 44,0%      | 72,0%     |
| 6   | artefakty tank/vampire ×0,7, leczenie Wojownika 2%, łotrzyk HP185/DEF7, boss HP300/DEF8 | 1,4%   | 43,4%      | 23,2%     |
| 7   | tank/vampire ×1,2, Wojownik ATK 17, Mag ATK 26                                          | 2,4%   | 46,4%      | 57,8%     |
| 8   | vampire_stone 5%, łotrzyk HP195, mag ATK 24, boss HP260                                 | 1,9%   | 47,9%      | 36,7%     |
| 9   | łotrzyk HP175/ATK18,5, mag HP150/ATK21, boss HP220, brutal HP80                         | 1,9%   | 50,2%      | 41,8%     |
| 10  | łotrzyk HP205/ATK17, mag AoE45%/DEF8/ATK22                                              | 3,2%   | 55,1%      | 43,2%     |
| 11  | łotrzyk ATK16, mag AoE30%/ASPD1.0/ATK20                                                 | 2,6%   | 59,8%      | 43,6%     |
| 12  | łotrzyk HP195, mag HP135/ATK20/ASPD0.8/AoE45% (10 000 runów)                            | 2,5%   | 50,0%      | 37,6%     |

Szczegółowe raporty każdej iteracji poniżej.

## Iteracja 0: dane startowe z CLAUDE.md (300 runów na bota)

Wyniki: wszystkie boty 0,0% wygranych; ok. 65% rajdów na poz. 1 kończy się porażką (hero bez artefaktów
przegrywa z 5 potworami z dwóch pierwszych pokoi); mediana rajdu ≈ 17 s na poz. ≥ 4; 0 timeoutów.
Wniosek: moc bohatera (HP i obrażenia) jest o rząd wielkości za mała względem potworów, trzeba skalować dane.

## Iteracja 1: potwory i boss ATK x0.5, HP x0.8 (3000 runów na bota, ziarna od 1, 17 s)

Podsumowanie: random: 0.0%, greedy-atk: 0.0%, greedy-hp: 0.0%

### Bot `random`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3160  | 161     | 5.1%      | 11.6              |
| 2            | 3449  | 466     | 13.5%     | 17.4              |
| 3            | 3942  | 1123    | 28.5%     | 22.7              |
| 4            | 7768  | 6142    | 79.1%     | 26.8              |
| 5            | 5716  | 5264    | 92.1%     | 28.8              |
| 6            | 1637  | 1553    | 94.9%     | 29.9              |
| 7            | 290   | 289     | 99.7%     | 25.9              |
| 8            | 2     | 2       | 100.0%    | 28.3              |
| 9            | 0     | 0       | -         | 0.0               |
| 10           | 0     | 0       | -         | 0.0               |
| 11           | 0     | 0       | -         | 0.0               |

Mediana rajdu na poz. ≥ 4: **27.6 s**, na poz. 1–3: 17.5 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **9.9 min**.
Na run: rajdów 8.7, scaleń 3.1, artefaktów 38.6. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5617, archer: 4435, brute: 2780, rat: 2168.

### Bot `greedy-atk`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3152  | 152     | 4.8%      | 11.6              |
| 2            | 3439  | 441     | 12.8%     | 17.3              |
| 3            | 3422  | 443     | 12.9%     | 23.0              |
| 4            | 5095  | 2550    | 50.0%     | 27.7              |
| 5            | 7259  | 5945    | 81.9%     | 24.5              |
| 6            | 4483  | 4090    | 91.2%     | 24.6              |
| 7            | 1326  | 1290    | 97.3%     | 22.1              |
| 8            | 87    | 83      | 95.4%     | 25.9              |
| 9            | 6     | 6       | 100.0%    | 33.9              |
| 10           | 0     | 0       | -         | 0.0               |
| 11           | 0     | 0       | -         | 0.0               |

Mediana rajdu na poz. ≥ 4: **25.6 s**, na poz. 1–3: 17.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **10.5 min**.
Na run: rajdów 9.4, scaleń 7.9, artefaktów 43.8. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 5489, skeleton: 5044, brute: 2511, rat: 1956.

### Bot `greedy-hp`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3179  | 179     | 5.6%      | 11.6              |
| 2            | 3422  | 426     | 12.4%     | 17.4              |
| 3            | 3600  | 665     | 18.5%     | 23.9              |
| 4            | 6406  | 4212    | 65.8%     | 35.5              |
| 5            | 7168  | 6279    | 87.6%     | 41.4              |
| 6            | 2730  | 2506    | 91.8%     | 44.4              |
| 7            | 705   | 692     | 98.2%     | 45.8              |
| 8            | 41    | 41      | 100.0%    | 38.6              |
| 9            | 0     | 0       | -         | 0.0               |
| 10           | 0     | 0       | -         | 0.0               |
| 11           | 0     | 0       | -         | 0.0               |

Mediana rajdu na poz. ≥ 4: **39.1 s**, na poz. 1–3: 17.7 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **11.5 min**.
Na run: rajdów 9.1, scaleń 7.0, artefaktów 41.9. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5440, archer: 4456, brute: 3021, rat: 2083.

## Iteracja 2: wartości artefaktów i efektów x2 (3000 runów na bota, ziarna od 1, 25 s)

Podsumowanie: random: 0.0%, greedy-atk: 0.0%, greedy-hp: 0.2%

### Bot `random`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3146  | 146     | 4.6%      | 11.6              |
| 2            | 3123  | 125     | 4.0%      | 15.6              |
| 3            | 3129  | 149     | 4.8%      | 19.4              |
| 4            | 4171  | 1416    | 33.9%     | 27.3              |
| 5            | 6214  | 4255    | 68.5%     | 32.5              |
| 6            | 5136  | 4000    | 77.9%     | 36.4              |
| 7            | 4128  | 3855    | 93.4%     | 35.3              |
| 8            | 956   | 920     | 96.2%     | 36.0              |
| 9            | 128   | 125     | 97.7%     | 39.1              |
| 10           | 9     | 9       | 100.0%    | 61.6              |
| 11           | 0     | 0       | -         | 0.0               |

Mediana rajdu na poz. ≥ 4: **32.5 s**, na poz. 1–3: 15.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **12.1 min**.
Na run: rajdów 10.0, scaleń 4.7, artefaktów 49.8. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5091, archer: 4663, brute: 3154, rat: 2092.

### Bot `greedy-atk`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 0.1%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.1 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3139  | 139     | 4.4%      | 11.6              |
| 2            | 3113  | 113     | 3.6%      | 15.4              |
| 3            | 3031  | 31      | 1.0%      | 19.3              |
| 4            | 3164  | 185     | 5.8%      | 27.1              |
| 5            | 4543  | 1869    | 41.1%     | 27.9              |
| 6            | 6590  | 4728    | 71.7%     | 26.2              |
| 7            | 5971  | 5230    | 87.6%     | 24.1              |
| 8            | 2342  | 2128    | 90.9%     | 24.4              |
| 9            | 511   | 472     | 92.4%     | 26.8              |
| 10           | 92    | 79      | 85.9%     | 39.8              |
| 11           | 24    | 23      | 95.8%     | 32.5              |

Mediana rajdu na poz. ≥ 4: **26.3 s**, na poz. 1–3: 15.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **12.2 min**.
Na run: rajdów 10.8, scaleń 11.4, artefaktów 54.7. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 6593, skeleton: 4154, brute: 2330, rat: 1917, warden: 3.

### Bot `greedy-hp`: 3000 runów, wygrane 0.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.2%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.4%    |

Rozrzut między klasami: 0.4 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3160  | 160     | 5.1%      | 11.6              |
| 2            | 3098  | 98      | 3.2%      | 15.7              |
| 3            | 3043  | 43      | 1.4%      | 19.8              |
| 4            | 3344  | 379     | 11.3%     | 33.3              |
| 5            | 4928  | 2206    | 44.8%     | 54.0              |
| 6            | 5840  | 3644    | 62.4%     | 66.8              |
| 7            | 5907  | 4650    | 78.7%     | 72.4              |
| 8            | 2852  | 2201    | 77.2%     | 88.9              |
| 9            | 1228  | 921     | 75.0%     | 107.3             |
| 10           | 536   | 382     | 71.3%     | 117.8             |
| 11           | 313   | 307     | 98.1%     | 156.8             |

Mediana rajdu na poz. ≥ 4: **64.0 s**, na poz. 1–3: 15.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **18.0 min**.
Na run: rajdów 11.4, scaleń 14.1, artefaktów 62.9. Timeouty: **1**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5010, archer: 4125, brute: 3614, rat: 2119, warden: 122, timeout: 1.

## Iteracja 3: tabela skalowania poziomów: przyrost x0.5 (1.0 ... 2.15) (3000 runów na bota, ziarna od 1, 34 s)

Podsumowanie: random: 0.0%, greedy-atk: 5.2%, greedy-hp: 20.5%

### Bot `random`: 3000 runów, wygrane 0.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.1%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.1 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3146  | 146     | 4.6%      | 11.6              |
| 2            | 3082  | 82      | 2.7%      | 15.5              |
| 3            | 3069  | 78      | 2.5%      | 18.7              |
| 4            | 3442  | 536     | 15.6%     | 26.5              |
| 5            | 4455  | 1845    | 41.4%     | 33.1              |
| 6            | 4989  | 2955    | 59.2%     | 38.6              |
| 7            | 5447  | 4294    | 78.8%     | 41.9              |
| 8            | 3450  | 2946    | 85.4%     | 45.5              |
| 9            | 1598  | 1415    | 88.5%     | 51.6              |
| 10           | 561   | 513     | 91.4%     | 53.0              |
| 11           | 188   | 187     | 99.5%     | 57.2              |

Mediana rajdu na poz. ≥ 4: **37.1 s**, na poz. 1–3: 15.1 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **14.2 min**.
Na run: rajdów 11.1, scaleń 5.9, artefaktów 60.1. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 4852, skeleton: 4766, brute: 3281, rat: 2061, warden: 37.

### Bot `greedy-atk`: 3000 runów, wygrane 5.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.0%    |
| mage    | 1000 | 3.7%    |
| warrior | 1000 | 11.9%   |

Rozrzut między klasami: 11.9 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3139  | 139     | 4.4%      | 11.6              |
| 2            | 3081  | 81      | 2.6%      | 15.3              |
| 3            | 3020  | 20      | 0.7%      | 18.6              |
| 4            | 3063  | 69      | 2.3%      | 25.9              |
| 5            | 3682  | 808     | 21.9%     | 29.3              |
| 6            | 5080  | 2619    | 51.6%     | 30.3              |
| 7            | 5981  | 4275    | 71.5%     | 30.9              |
| 8            | 4173  | 3094    | 74.1%     | 35.0              |
| 9            | 2427  | 1768    | 72.8%     | 40.0              |
| 10           | 1372  | 990     | 72.2%     | 46.6              |
| 11           | 904   | 748     | 82.7%     | 57.3              |

Mediana rajdu na poz. ≥ 4: **31.1 s**, na poz. 1–3: 15.2 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **14.1 min**.
Na run: rajdów 12.0, scaleń 15.9, artefaktów 67.9. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 6659, skeleton: 3756, brute: 2178, rat: 1834, warden: 184.

### Bot `greedy-hp`: 3000 runów, wygrane 20.5%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 25.2%   |
| mage    | 1000 | 10.5%   |
| warrior | 1000 | 25.8%   |

Rozrzut między klasami: 15.3 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3160  | 160     | 5.1%      | 11.6              |
| 2            | 3064  | 64      | 2.1%      | 15.5              |
| 3            | 3025  | 25      | 0.8%      | 18.9              |
| 4            | 3096  | 99      | 3.2%      | 30.9              |
| 5            | 3574  | 619     | 17.3%     | 51.2              |
| 6            | 4029  | 1189    | 29.5%     | 67.0              |
| 7            | 5156  | 2644    | 51.3%     | 78.5              |
| 8            | 4676  | 2547    | 54.5%     | 93.8              |
| 9            | 3773  | 2032    | 53.9%     | 109.6             |
| 10           | 2771  | 1399    | 50.5%     | 130.2             |
| 11           | 3373  | 2758    | 81.8%     | 178.6             |

Mediana rajdu na poz. ≥ 4: **82.7 s**, na poz. 1–3: 15.2 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **26.0 min**.
Na run: rajdów 13.2, scaleń 21.4, artefaktów 84.1. Timeouty: **83**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4207, archer: 3419, brute: 2843, rat: 1594, warden: 1390, timeout: 83.

## Iteracja 4: bohater: atk x1.4, maxHp x1.3 (wszystkie klasy) (3000 runów na bota, ziarna od 1, 37 s)

Podsumowanie: random: 0.1%, greedy-atk: 21.2%, greedy-hp: 54.9%

### Bot `random`: 3000 runów, wygrane 0.1%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 0.3%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 0.3 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3007  | 7       | 0.2%      | 13.7              |
| 3            | 3004  | 4       | 0.1%      | 17.4              |
| 4            | 3096  | 105     | 3.4%      | 24.3              |
| 5            | 3542  | 634     | 17.9%     | 31.7              |
| 6            | 4221  | 1567    | 37.1%     | 38.1              |
| 7            | 5733  | 3769    | 65.7%     | 43.2              |
| 8            | 5031  | 3857    | 76.7%     | 47.4              |
| 9            | 3372  | 2829    | 83.9%     | 50.4              |
| 10           | 1588  | 1363    | 85.8%     | 58.3              |
| 11           | 857   | 854     | 99.6%     | 71.7              |

Mediana rajdu na poz. ≥ 4: **39.6 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **15.9 min**.
Na run: rajdów 12.2, scaleń 7.1, artefaktów 69.3. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 4884, skeleton: 4638, brute: 3267, rat: 2001, warden: 199.

### Bot `greedy-atk`: 3000 runów, wygrane 21.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 1.1%    |
| mage    | 1000 | 16.5%   |
| warrior | 1000 | 45.9%   |

Rozrzut między klasami: 44.8 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3008  | 8       | 0.3%      | 13.4              |
| 3            | 3002  | 2       | 0.1%      | 17.4              |
| 4            | 3017  | 18      | 0.6%      | 24.9              |
| 5            | 3282  | 322     | 9.8%      | 29.4              |
| 6            | 4068  | 1265    | 31.1%     | 32.7              |
| 7            | 5423  | 3119    | 57.5%     | 34.3              |
| 8            | 4736  | 2964    | 62.6%     | 38.3              |
| 9            | 3573  | 2270    | 63.5%     | 43.0              |
| 10           | 2496  | 1532    | 61.4%     | 48.8              |
| 11           | 2161  | 1526    | 70.6%     | 61.4              |

Mediana rajdu na poz. ≥ 4: **34.6 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **15.7 min**.
Na run: rajdów 12.6, scaleń 18.8, artefaktów 76.6. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 5924, skeleton: 3182, brute: 1866, rat: 1693, warden: 361.

### Bot `greedy-hp`: 3000 runów, wygrane 54.9%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 64.5%   |
| mage    | 1000 | 40.3%   |
| warrior | 1000 | 59.9%   |

Rozrzut między klasami: 24.2 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3001  | 1       | 0.0%      | 9.6               |
| 2            | 3006  | 6       | 0.2%      | 13.6              |
| 3            | 3002  | 2       | 0.1%      | 17.6              |
| 4            | 3011  | 11      | 0.4%      | 27.9              |
| 5            | 3107  | 111     | 3.6%      | 43.8              |
| 6            | 3279  | 300     | 9.1%      | 58.7              |
| 7            | 3967  | 1067    | 26.9%     | 72.3              |
| 8            | 4280  | 1527    | 35.7%     | 85.3              |
| 9            | 4138  | 1571    | 38.0%     | 100.5             |
| 10           | 3685  | 1307    | 35.5%     | 118.0             |
| 11           | 5656  | 4009    | 70.9%     | 170.9             |

Mediana rajdu na poz. ≥ 4: **84.2 s**, na poz. 1–3: 13.6 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **26.3 min**.
Na run: rajdów 13.4, scaleń 23.3, artefaktów 90.0. Timeouty: **129**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3151, archer: 2137, warden: 1992, brute: 1572, rat: 931, timeout: 129.

## Iteracja 5: rogue HP156/def6, mage HP120/def4, archer ATK 3.2, boss HP 360 (3000 runów na bota, ziarna od 1, 38 s)

Podsumowanie: random: 2.1%, greedy-atk: 44.0%, greedy-hp: 72.0%

### Bot `random`: 3000 runów, wygrane 2.1%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 5.8%    |
| mage    | 1000 | 0.2%    |
| warrior | 1000 | 0.2%    |

Rozrzut między klasami: 5.6 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3000  | 0       | 0.0%      | 13.7              |
| 3            | 3001  | 1       | 0.0%      | 17.4              |
| 4            | 3030  | 34      | 1.1%      | 24.4              |
| 5            | 3219  | 254     | 7.9%      | 32.6              |
| 6            | 3566  | 697     | 19.5%     | 40.1              |
| 7            | 5235  | 2846    | 54.4%     | 46.6              |
| 8            | 5316  | 3649    | 68.6%     | 50.4              |
| 9            | 4343  | 3379    | 77.8%     | 55.0              |
| 10           | 2659  | 2170    | 81.6%     | 59.9              |
| 11           | 1793  | 1731    | 96.5%     | 74.3              |

Mediana rajdu na poz. ≥ 4: **44.1 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.5 min**.
Na run: rajdów 12.7, scaleń 7.8, artefaktów 75.3. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4913, archer: 4008, brute: 3311, rat: 2115, warden: 414.

### Bot `greedy-atk`: 3000 runów, wygrane 44.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 19.4%   |
| mage    | 1000 | 49.6%   |
| warrior | 1000 | 62.9%   |

Rozrzut między klasami: 43.5 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3000  | 0       | 0.0%      | 13.4              |
| 3            | 3000  | 0       | 0.0%      | 17.4              |
| 4            | 3003  | 3       | 0.1%      | 25.0              |
| 5            | 3034  | 36      | 1.2%      | 30.1              |
| 6            | 3289  | 314     | 9.5%      | 34.6              |
| 7            | 4020  | 1168    | 29.1%     | 39.1              |
| 8            | 4647  | 2097    | 45.1%     | 42.9              |
| 9            | 4645  | 2478    | 53.3%     | 46.8              |
| 10           | 3868  | 2154    | 55.7%     | 50.6              |
| 11           | 3392  | 2073    | 61.1%     | 60.4              |

Mediana rajdu na poz. ≥ 4: **39.8 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.1 min**.
Na run: rajdów 13.0, scaleń 21.3, artefaktów 84.1. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 4075, skeleton: 2753, brute: 1613, rat: 1455, warden: 427.

### Bot `greedy-hp`: 3000 runów, wygrane 72.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 84.0%   |
| mage    | 1000 | 61.8%   |
| warrior | 1000 | 70.3%   |

Rozrzut między klasami: 22.2 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3000  | 0       | 0.0%      | 13.6              |
| 3            | 3000  | 0       | 0.0%      | 17.6              |
| 4            | 3001  | 1       | 0.0%      | 27.9              |
| 5            | 3049  | 51      | 1.7%      | 44.1              |
| 6            | 3139  | 148     | 4.7%      | 59.5              |
| 7            | 3570  | 605     | 16.9%     | 75.3              |
| 8            | 3976  | 1098    | 27.6%     | 87.8              |
| 9            | 3997  | 1261    | 31.5%     | 103.0             |
| 10           | 3721  | 1116    | 30.0%     | 120.9             |
| 11           | 5132  | 2971    | 57.9%     | 167.9             |

Mediana rajdu na poz. ≥ 4: **86.7 s**, na poz. 1–3: 13.6 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **25.1 min**.
Na run: rajdów 12.9, scaleń 22.0, artefaktów 87.2. Timeouty: **89**, utknięte runy: 0.
Przyczyny porażek: skeleton: 2454, archer: 1422, warden: 1345, brute: 1210, rat: 731, timeout: 89.

## Iteracja 6: artefakty tank/vampire x0.7, Wojownik leczenie 2%, rogue HP185/def7, boss HP300/def8 (3000 runów na bota, ziarna od 1, 36 s)

Podsumowanie: random: 1.4%, greedy-atk: 43.4%, greedy-hp: 23.2%

### Bot `random`: 3000 runów, wygrane 1.4%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 4.3%    |
| mage    | 1000 | 0.0%    |
| warrior | 1000 | 0.0%    |

Rozrzut między klasami: 4.3 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3002  | 2       | 0.1%      | 13.7              |
| 3            | 3001  | 1       | 0.0%      | 17.4              |
| 4            | 3062  | 69      | 2.3%      | 24.5              |
| 5            | 3442  | 513     | 14.9%     | 32.6              |
| 6            | 4106  | 1374    | 33.5%     | 39.8              |
| 7            | 5743  | 3716    | 64.7%     | 44.1              |
| 8            | 5002  | 3739    | 74.8%     | 47.5              |
| 9            | 3588  | 2946    | 82.1%     | 51.2              |
| 10           | 1770  | 1476    | 83.4%     | 52.8              |
| 11           | 1060  | 1017    | 95.9%     | 68.3              |

Mediana rajdu na poz. ≥ 4: **41.0 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **16.3 min**.
Na run: rajdów 12.3, scaleń 7.3, artefaktów 70.9. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5066, archer: 4124, brute: 3323, rat: 2092, warden: 248.

### Bot `greedy-atk`: 3000 runów, wygrane 43.4%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 36.2%   |
| mage    | 1000 | 49.9%   |
| warrior | 1000 | 44.2%   |

Rozrzut między klasami: 13.7 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3000  | 0       | 0.0%      | 13.4              |
| 3            | 3000  | 0       | 0.0%      | 17.4              |
| 4            | 3008  | 8       | 0.3%      | 25.0              |
| 5            | 3047  | 50      | 1.6%      | 30.1              |
| 6            | 3262  | 282     | 8.6%      | 34.8              |
| 7            | 3985  | 1113    | 27.9%     | 39.3              |
| 8            | 4644  | 2040    | 43.9%     | 43.4              |
| 9            | 4726  | 2523    | 53.4%     | 46.7              |
| 10           | 4052  | 2328    | 57.5%     | 50.3              |
| 11           | 3261  | 1958    | 60.0%     | 59.2              |

Mediana rajdu na poz. ≥ 4: **40.1 s**, na poz. 1–3: 13.4 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.2 min**.
Na run: rajdów 13.0, scaleń 21.4, artefaktów 84.5. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 4091, skeleton: 2773, brute: 1577, rat: 1524, warden: 337.

### Bot `greedy-hp`: 3000 runów, wygrane 23.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 52.0%   |
| mage    | 1000 | 11.2%   |
| warrior | 1000 | 6.3%    |

Rozrzut między klasami: 45.7 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.6               |
| 2            | 3000  | 0       | 0.0%      | 13.6              |
| 3            | 3000  | 0       | 0.0%      | 17.6              |
| 4            | 3022  | 23      | 0.8%      | 28.0              |
| 5            | 3273  | 284     | 8.7%      | 44.9              |
| 6            | 3724  | 812     | 21.8%     | 59.8              |
| 7            | 5126  | 2506    | 48.9%     | 72.2              |
| 8            | 5061  | 2890    | 57.1%     | 83.3              |
| 9            | 4081  | 2398    | 58.8%     | 96.0              |
| 10           | 2910  | 1611    | 55.4%     | 110.7             |
| 11           | 3066  | 2371    | 77.3%     | 144.2             |

Mediana rajdu na poz. ≥ 4: **75.0 s**, na poz. 1–3: 13.6 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **23.5 min**.
Na run: rajdów 13.1, scaleń 21.0, artefaktów 83.0. Timeouty: **1**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4280, archer: 3048, brute: 2952, rat: 1655, warden: 959, timeout: 1.

## Iteracja 7: tank/vampire x1.2, Wojownik ATK 17, Mag ATK 26 (3000 runów na bota, ziarna od 1, 37 s)

Podsumowanie: random: 2.4%, greedy-atk: 46.4%, greedy-hp: 57.8%

### Bot `random`: 3000 runów, wygrane 2.4%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 6.6%    |
| mage    | 1000 | 0.2%    |
| warrior | 1000 | 0.3%    |

Rozrzut między klasami: 6.4 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.3               |
| 2            | 3000  | 0       | 0.0%      | 13.2              |
| 3            | 3000  | 0       | 0.0%      | 16.8              |
| 4            | 3026  | 28      | 0.9%      | 23.7              |
| 5            | 3225  | 257     | 8.0%      | 31.5              |
| 6            | 3646  | 788     | 21.6%     | 38.9              |
| 7            | 5350  | 2996    | 56.0%     | 44.8              |
| 8            | 5296  | 3677    | 69.4%     | 48.9              |
| 9            | 4291  | 3371    | 78.6%     | 53.5              |
| 10           | 2573  | 2134    | 82.9%     | 56.3              |
| 11           | 1531  | 1460    | 95.4%     | 70.8              |

Mediana rajdu na poz. ≥ 4: **42.3 s**, na poz. 1–3: 12.8 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.0 min**.
Na run: rajdów 12.6, scaleń 7.6, artefaktów 74.7. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4790, archer: 4128, brute: 3308, rat: 2120, warden: 365.

### Bot `greedy-atk`: 3000 runów, wygrane 46.4%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 36.2%   |
| mage    | 1000 | 55.0%   |
| warrior | 1000 | 48.1%   |

Rozrzut między klasami: 18.8 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.4               |
| 2            | 3000  | 0       | 0.0%      | 13.0              |
| 3            | 3000  | 0       | 0.0%      | 16.9              |
| 4            | 3003  | 3       | 0.1%      | 24.6              |
| 5            | 3032  | 32      | 1.1%      | 29.8              |
| 6            | 3210  | 226     | 7.0%      | 34.5              |
| 7            | 3939  | 1054    | 26.8%     | 39.1              |
| 8            | 4542  | 1910    | 42.1%     | 43.3              |
| 9            | 4709  | 2478    | 52.6%     | 46.6              |
| 10           | 4014  | 2204    | 54.9%     | 50.5              |
| 11           | 3467  | 2074    | 59.8%     | 59.1              |

Mediana rajdu na poz. ≥ 4: **40.0 s**, na poz. 1–3: 12.8 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.1 min**.
Na run: rajdów 13.0, scaleń 21.4, artefaktów 84.5. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 4025, skeleton: 2696, rat: 1462, brute: 1435, warden: 363.

### Bot `greedy-hp`: 3000 runów, wygrane 57.8%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 74.6%   |
| mage    | 1000 | 50.1%   |
| warrior | 1000 | 48.8%   |

Rozrzut między klasami: 25.8 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.3               |
| 2            | 3000  | 0       | 0.0%      | 13.2              |
| 3            | 3000  | 0       | 0.0%      | 17.0              |
| 4            | 3001  | 1       | 0.0%      | 27.1              |
| 5            | 3067  | 69      | 2.2%      | 42.4              |
| 6            | 3224  | 238     | 7.4%      | 57.5              |
| 7            | 3877  | 951     | 24.5%     | 71.8              |
| 8            | 4370  | 1605    | 36.7%     | 84.1              |
| 9            | 4407  | 1881    | 42.7%     | 98.1              |
| 10           | 3851  | 1575    | 40.9%     | 114.9             |
| 11           | 4617  | 2882    | 62.4%     | 152.1             |

Mediana rajdu na poz. ≥ 4: **80.8 s**, na poz. 1–3: 12.9 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.7 min**.
Na run: rajdów 13.1, scaleń 22.4, artefaktów 87.7. Timeouty: **3**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3106, archer: 2017, brute: 1864, warden: 1209, rat: 1003, timeout: 3.

## Iteracja 8: vampire_stone 5%, rogue HP195, mage ATK 24, boss HP260 (3000 runów na bota, ziarna od 1, 38 s)

Podsumowanie: random: 1.9%, greedy-atk: 47.9%, greedy-hp: 36.7%

### Bot `random`: 3000 runów, wygrane 1.9%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 5.4%    |
| mage    | 1000 | 0.1%    |
| warrior | 1000 | 0.3%    |

Rozrzut między klasami: 5.3 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.9               |
| 2            | 3000  | 0       | 0.0%      | 13.4              |
| 3            | 3001  | 1       | 0.0%      | 16.9              |
| 4            | 3027  | 31      | 1.0%      | 23.9              |
| 5            | 3276  | 314     | 9.6%      | 31.9              |
| 6            | 3818  | 993     | 26.0%     | 39.3              |
| 7            | 5445  | 3185    | 58.5%     | 44.8              |
| 8            | 5176  | 3644    | 70.4%     | 48.8              |
| 9            | 4174  | 3341    | 80.0%     | 53.0              |
| 10           | 2356  | 1972    | 83.7%     | 56.0              |
| 11           | 1358  | 1300    | 95.7%     | 69.1              |

Mediana rajdu na poz. ≥ 4: **42.0 s**, na poz. 1–3: 12.9 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **16.8 min**.
Na run: rajdów 12.5, scaleń 7.6, artefaktów 73.7. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4890, archer: 4134, brute: 3327, rat: 2121, warden: 309.

### Bot `greedy-atk`: 3000 runów, wygrane 47.9%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 41.9%   |
| mage    | 1000 | 53.3%   |
| warrior | 1000 | 48.5%   |

Rozrzut między klasami: 11.4 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.1               |
| 2            | 3000  | 0       | 0.0%      | 13.2              |
| 3            | 3000  | 0       | 0.0%      | 17.0              |
| 4            | 3003  | 3       | 0.1%      | 24.7              |
| 5            | 3038  | 38      | 1.3%      | 29.9              |
| 6            | 3236  | 254     | 7.8%      | 34.6              |
| 7            | 3875  | 980     | 25.3%     | 39.3              |
| 8            | 4557  | 1915    | 42.0%     | 43.4              |
| 9            | 4658  | 2391    | 51.3%     | 47.0              |
| 10           | 4080  | 2230    | 54.7%     | 50.8              |
| 11           | 3453  | 2016    | 58.4%     | 59.4              |

Mediana rajdu na poz. ≥ 4: **40.4 s**, na poz. 1–3: 12.9 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.1 min**.
Na run: rajdów 13.0, scaleń 21.5, artefaktów 84.7. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 3974, skeleton: 2641, brute: 1450, rat: 1417, warden: 345.

### Bot `greedy-hp`: 3000 runów, wygrane 36.7%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 53.7%   |
| mage    | 1000 | 20.8%   |
| warrior | 1000 | 35.7%   |

Rozrzut między klasami: 32.9 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.0               |
| 2            | 3000  | 0       | 0.0%      | 13.3              |
| 3            | 3000  | 0       | 0.0%      | 17.1              |
| 4            | 3002  | 2       | 0.1%      | 27.4              |
| 5            | 3099  | 103     | 3.3%      | 43.4              |
| 6            | 3348  | 369     | 11.0%     | 58.6              |
| 7            | 4279  | 1427    | 33.3%     | 71.7              |
| 8            | 4730  | 2154    | 45.5%     | 82.7              |
| 9            | 4749  | 2598    | 54.7%     | 94.9              |
| 10           | 3837  | 2109    | 55.0%     | 107.5             |
| 11           | 3982  | 2880    | 72.3%     | 138.9             |

Mediana rajdu na poz. ≥ 4: **77.5 s**, na poz. 1–3: 13.1 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.4 min**.
Na run: rajdów 13.3, scaleń 22.3, artefaktów 87.3. Timeouty: **2**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3868, archer: 2746, brute: 2450, rat: 1470, warden: 1106, timeout: 2.

## Iteracja 9: rogue HP175/ATK18.5, mage HP150/ATK21, boss HP220, brute HP80 (3000 runów na bota, ziarna od 1, 37 s)

Podsumowanie: random: 1.9%, greedy-atk: 50.2%, greedy-hp: 41.8%

### Bot `random`: 3000 runów, wygrane 1.9%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 5.1%    |
| mage    | 1000 | 0.3%    |
| warrior | 1000 | 0.4%    |

Rozrzut między klasami: 4.8 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.1               |
| 2            | 3000  | 0       | 0.0%      | 13.4              |
| 3            | 3001  | 1       | 0.0%      | 17.0              |
| 4            | 3021  | 23      | 0.8%      | 24.1              |
| 5            | 3199  | 220     | 6.9%      | 31.9              |
| 6            | 3645  | 770     | 21.1%     | 39.7              |
| 7            | 5323  | 2957    | 55.6%     | 45.3              |
| 8            | 5444  | 3837    | 70.5%     | 49.3              |
| 9            | 4280  | 3369    | 78.7%     | 52.2              |
| 10           | 2645  | 2255    | 85.3%     | 54.4              |
| 11           | 1398  | 1340    | 95.9%     | 66.9              |

Mediana rajdu na poz. ≥ 4: **42.7 s**, na poz. 1–3: 13.0 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.1 min**.
Na run: rajdów 12.7, scaleń 7.7, artefaktów 74.8. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4988, archer: 4232, brute: 3217, rat: 2083, warden: 252.

### Bot `greedy-atk`: 3000 runów, wygrane 50.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 32.6%   |
| mage    | 1000 | 69.5%   |
| warrior | 1000 | 48.4%   |

Rozrzut między klasami: 36.9 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.2               |
| 2            | 3000  | 0       | 0.0%      | 13.2              |
| 3            | 3000  | 0       | 0.0%      | 17.1              |
| 4            | 3000  | 0       | 0.0%      | 24.8              |
| 5            | 3019  | 21      | 0.7%      | 29.9              |
| 6            | 3204  | 225     | 7.0%      | 34.6              |
| 7            | 3783  | 892     | 23.6%     | 39.5              |
| 8            | 4422  | 1754    | 39.7%     | 43.7              |
| 9            | 4623  | 2325    | 50.3%     | 47.1              |
| 10           | 4150  | 2297    | 55.3%     | 51.0              |
| 11           | 3323  | 1818    | 54.7%     | 60.3              |

Mediana rajdu na poz. ≥ 4: **40.5 s**, na poz. 1–3: 13.0 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.0 min**.
Na run: rajdów 12.8, scaleń 21.1, artefaktów 84.0. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 3754, skeleton: 2564, rat: 1377, brute: 1348, warden: 289.

### Bot `greedy-hp`: 3000 runów, wygrane 41.8%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 58.7%   |
| mage    | 1000 | 24.3%   |
| warrior | 1000 | 42.4%   |

Rozrzut między klasami: 34.4 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.1               |
| 2            | 3000  | 0       | 0.0%      | 13.3              |
| 3            | 3000  | 0       | 0.0%      | 17.3              |
| 4            | 3001  | 1       | 0.0%      | 27.5              |
| 5            | 3071  | 72      | 2.3%      | 43.4              |
| 6            | 3360  | 381     | 11.3%     | 58.8              |
| 7            | 4158  | 1296    | 31.2%     | 72.0              |
| 8            | 4650  | 2050    | 44.1%     | 82.8              |
| 9            | 4633  | 2418    | 52.2%     | 94.0              |
| 10           | 3946  | 2126    | 53.9%     | 106.2             |
| 11           | 3950  | 2696    | 68.3%     | 136.7             |

Mediana rajdu na poz. ≥ 4: **77.5 s**, na poz. 1–3: 13.2 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.1 min**.
Na run: rajdów 13.3, scaleń 22.1, artefaktów 87.0. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3787, archer: 2674, brute: 2217, rat: 1406, warden: 956.

## Iteracja 10: rogue HP205/ATK17, mage AoE 45%/def8/ATK22 (3000 runów na bota, ziarna od 1, 37 s)

Podsumowanie: random: 3.2%, greedy-atk: 55.1%, greedy-hp: 43.2%

### Bot `random`: 3000 runów, wygrane 3.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 8.9%    |
| mage    | 1000 | 0.3%    |
| warrior | 1000 | 0.4%    |

Rozrzut między klasami: 8.6 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.1               |
| 2            | 3000  | 0       | 0.0%      | 13.5              |
| 3            | 3000  | 0       | 0.0%      | 17.1              |
| 4            | 3018  | 20      | 0.7%      | 24.3              |
| 5            | 3181  | 202     | 6.4%      | 32.3              |
| 6            | 3619  | 739     | 20.4%     | 40.1              |
| 7            | 5248  | 2864    | 54.6%     | 46.2              |
| 8            | 5269  | 3576    | 67.9%     | 50.5              |
| 9            | 4379  | 3386    | 77.3%     | 53.6              |
| 10           | 2778  | 2309    | 83.1%     | 57.3              |
| 11           | 1640  | 1544    | 94.1%     | 68.7              |

Mediana rajdu na poz. ≥ 4: **43.8 s**, na poz. 1–3: 13.1 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.3 min**.
Na run: rajdów 12.7, scaleń 7.8, artefaktów 75.6. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 4992, archer: 4075, brute: 3104, rat: 2163, warden: 306.

### Bot `greedy-atk`: 3000 runów, wygrane 55.1%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 48.0%   |
| mage    | 1000 | 68.9%   |
| warrior | 1000 | 48.4%   |

Rozrzut między klasami: 20.9 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.2               |
| 2            | 3000  | 0       | 0.0%      | 13.3              |
| 3            | 3000  | 0       | 0.0%      | 17.3              |
| 4            | 3000  | 0       | 0.0%      | 24.9              |
| 5            | 3014  | 14      | 0.5%      | 30.1              |
| 6            | 3159  | 172     | 5.4%      | 34.9              |
| 7            | 3634  | 707     | 19.5%     | 40.0              |
| 8            | 4280  | 1540    | 36.0%     | 44.1              |
| 9            | 4511  | 2076    | 46.0%     | 48.3              |
| 10           | 4246  | 2221    | 52.3%     | 51.8              |
| 11           | 3562  | 1909    | 53.6%     | 61.0              |

Mediana rajdu na poz. ≥ 4: **41.5 s**, na poz. 1–3: 13.1 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.0 min**.
Na run: rajdów 12.8, scaleń 21.3, artefaktów 84.4. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 3374, skeleton: 2436, rat: 1265, brute: 1253, warden: 311.

### Bot `greedy-hp`: 3000 runów, wygrane 43.2%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 62.1%   |
| mage    | 1000 | 25.0%   |
| warrior | 1000 | 42.4%   |

Rozrzut między klasami: 37.1 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 9.2               |
| 2            | 3000  | 0       | 0.0%      | 13.4              |
| 3            | 3000  | 0       | 0.0%      | 17.4              |
| 4            | 3001  | 1       | 0.0%      | 27.8              |
| 5            | 3074  | 76      | 2.5%      | 43.6              |
| 6            | 3326  | 345     | 10.4%     | 59.5              |
| 7            | 4100  | 1221    | 29.8%     | 73.3              |
| 8            | 4649  | 2031    | 43.7%     | 84.1              |
| 9            | 4590  | 2346    | 51.1%     | 96.4              |
| 10           | 3938  | 2061    | 52.3%     | 108.8             |
| 11           | 4110  | 2815    | 68.5%     | 138.9             |

Mediana rajdu na poz. ≥ 4: **79.3 s**, na poz. 1–3: 13.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.4 min**.
Na run: rajdów 13.3, scaleń 22.2, artefaktów 87.3. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3812, archer: 2524, brute: 2190, rat: 1360, warden: 1010.

## Iteracja 11: rogue ATK16, mage AoE 30%/ASPD 1.0/ATK20 (3000 runów na bota, ziarna od 1, 37 s)

Podsumowanie: random: 2.6%, greedy-atk: 59.8%, greedy-hp: 43.6%

### Bot `random`: 3000 runów, wygrane 2.6%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 6.4%    |
| mage    | 1000 | 1.0%    |
| warrior | 1000 | 0.4%    |

Rozrzut między klasami: 6.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.7               |
| 2            | 3000  | 0       | 0.0%      | 13.2              |
| 3            | 3000  | 0       | 0.0%      | 16.7              |
| 4            | 3010  | 11      | 0.4%      | 23.6              |
| 5            | 3138  | 151     | 4.8%      | 31.4              |
| 6            | 3461  | 549     | 15.9%     | 39.1              |
| 7            | 5011  | 2515    | 50.2%     | 45.8              |
| 8            | 5418  | 3613    | 66.7%     | 50.0              |
| 9            | 4810  | 3767    | 78.3%     | 53.1              |
| 10           | 2934  | 2449    | 83.5%     | 56.6              |
| 11           | 1713  | 1635    | 95.4%     | 68.5              |

Mediana rajdu na poz. ≥ 4: **43.7 s**, na poz. 1–3: 12.8 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.5 min**.
Na run: rajdów 12.8, scaleń 7.9, artefaktów 76.8. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 5015, archer: 3943, brute: 3213, rat: 2159, warden: 360.

### Bot `greedy-atk`: 3000 runów, wygrane 59.8%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 48.1%   |
| mage    | 1000 | 82.8%   |
| warrior | 1000 | 48.4%   |

Rozrzut między klasami: 34.7 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.8               |
| 2            | 3000  | 0       | 0.0%      | 12.9              |
| 3            | 3000  | 0       | 0.0%      | 16.8              |
| 4            | 3000  | 0       | 0.0%      | 24.3              |
| 5            | 3013  | 13      | 0.4%      | 29.3              |
| 6            | 3121  | 132     | 4.2%      | 34.1              |
| 7            | 3535  | 599     | 16.9%     | 39.4              |
| 8            | 4127  | 1358    | 32.9%     | 43.8              |
| 9            | 4407  | 1918    | 43.5%     | 47.6              |
| 10           | 4193  | 2061    | 49.2%     | 51.2              |
| 11           | 3595  | 1802    | 50.1%     | 60.3              |

Mediana rajdu na poz. ≥ 4: **41.1 s**, na poz. 1–3: 12.7 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **16.7 min**.
Na run: rajdów 12.7, scaleń 21.0, artefaktów 84.0. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 3144, skeleton: 2186, rat: 1143, brute: 1119, warden: 291.

### Bot `greedy-hp`: 3000 runów, wygrane 43.6%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 1000 | 56.6%   |
| mage    | 1000 | 31.9%   |
| warrior | 1000 | 42.4%   |

Rozrzut między klasami: 24.7 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 3000  | 0       | 0.0%      | 8.8               |
| 2            | 3000  | 0       | 0.0%      | 13.1              |
| 3            | 3000  | 0       | 0.0%      | 16.9              |
| 4            | 3001  | 1       | 0.0%      | 27.2              |
| 5            | 3051  | 53      | 1.7%      | 43.3              |
| 6            | 3267  | 279     | 8.5%      | 58.9              |
| 7            | 4015  | 1119    | 27.9%     | 72.3              |
| 8            | 4581  | 1924    | 42.0%     | 83.5              |
| 9            | 4729  | 2450    | 51.8%     | 95.2              |
| 10           | 4022  | 2151    | 53.5%     | 108.2             |
| 11           | 4234  | 2925    | 69.1%     | 138.7             |

Mediana rajdu na poz. ≥ 4: **79.3 s**, na poz. 1–3: 12.9 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.5 min**.
Na run: rajdów 13.3, scaleń 22.4, artefaktów 87.8. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 3883, archer: 2448, brute: 2181, rat: 1364, warden: 1026.

## Iteracja 12 (końcowa): rogue HP195, mage HP135/ATK20/ASPD0.8/AoE45% (po poprawce zamkniętego lochu dla bossa) (10000 runów na bota, ziarna od 1, 112 s)

Podsumowanie: random: 2.5%, greedy-atk: 50.0%, greedy-hp: 37.6%

### Bot `random`: 10000 runów, wygrane 2.5%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 3334 | 7.1%    |
| mage    | 3333 | 0.1%    |
| warrior | 3333 | 0.4%    |

Rozrzut między klasami: 7.0 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 10000 | 0       | 0.0%      | 9.2               |
| 2            | 10000 | 0       | 0.0%      | 13.8              |
| 3            | 10002 | 2       | 0.0%      | 17.4              |
| 4            | 10086 | 90      | 0.9%      | 24.6              |
| 5            | 10842 | 942     | 8.7%      | 32.8              |
| 6            | 12657 | 3222    | 25.5%     | 40.4              |
| 7            | 17997 | 10414   | 57.9%     | 46.2              |
| 8            | 17521 | 12366   | 70.6%     | 50.3              |
| 9            | 14016 | 11203   | 79.9%     | 52.9              |
| 10           | 7801  | 6485    | 83.1%     | 56.0              |
| 11           | 4517  | 4264    | 94.4%     | 67.8              |

Mediana rajdu na poz. ≥ 4: **43.3 s**, na poz. 1–3: 13.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.0 min**.
Na run: rajdów 12.5, scaleń 7.6, artefaktów 74.1. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 16694, archer: 13717, brute: 10600, rat: 7170, warden: 807.

### Bot `greedy-atk`: 10000 runów, wygrane 50.0%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 3334 | 43.9%   |
| mage    | 3333 | 58.7%   |
| warrior | 3333 | 47.3%   |

Rozrzut między klasami: 14.8 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 10000 | 0       | 0.0%      | 9.2               |
| 2            | 10000 | 0       | 0.0%      | 13.7              |
| 3            | 10001 | 1       | 0.0%      | 17.5              |
| 4            | 10003 | 3       | 0.0%      | 25.1              |
| 5            | 10079 | 82      | 0.8%      | 30.2              |
| 6            | 10624 | 678     | 6.4%      | 34.9              |
| 7            | 12626 | 2944    | 23.3%     | 39.9              |
| 8            | 14736 | 5784    | 39.3%     | 44.0              |
| 9            | 15304 | 7510    | 49.1%     | 48.0              |
| 10           | 14221 | 7898    | 55.5%     | 51.3              |
| 11           | 11436 | 6441    | 56.3%     | 60.1              |

Mediana rajdu na poz. ≥ 4: **41.0 s**, na poz. 1–3: 13.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **17.1 min**.
Na run: rajdów 12.9, scaleń 21.4, artefaktów 84.7. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: archer: 12717, skeleton: 8687, brute: 4561, rat: 4334, warden: 1042.

### Bot `greedy-hp`: 10000 runów, wygrane 37.6%

| Klasa   | Runy | Wygrane |
| ------- | ---- | ------- |
| rogue   | 3334 | 55.1%   |
| mage    | 3333 | 17.6%   |
| warrior | 3333 | 40.1%   |

Rozrzut między klasami: 37.5 pkt proc.

| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |
| ------------ | ----- | ------- | --------- | ----------------- |
| 1            | 10000 | 0       | 0.0%      | 9.2               |
| 2            | 10000 | 0       | 0.0%      | 13.8              |
| 3            | 10000 | 0       | 0.0%      | 17.6              |
| 4            | 10004 | 4       | 0.0%      | 28.3              |
| 5            | 10368 | 382     | 3.7%      | 45.4              |
| 6            | 11517 | 1640    | 14.2%     | 61.1              |
| 7            | 14418 | 5039    | 34.9%     | 74.1              |
| 8            | 15818 | 7479    | 47.3%     | 85.2              |
| 9            | 15001 | 7999    | 53.3%     | 97.5              |
| 10           | 12703 | 7085    | 55.8%     | 109.5             |
| 11           | 12486 | 8729    | 69.9%     | 141.4             |

Mediana rajdu na poz. ≥ 4: **78.8 s**, na poz. 1–3: 13.3 s. Mediana długości runu (rajdy 1× + 45 s Prep na rajd): **24.4 min**.
Na run: rajdów 13.2, scaleń 22.0, artefaktów 86.4. Timeouty: **0**, utknięte runy: 0.
Przyczyny porażek: skeleton: 13382, archer: 9126, brute: 7712, rat: 5053, warden: 3084.
