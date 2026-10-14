# Balans

Zasady: zmieniam wyłącznie dane (`packages/data/src/json`), maks. 12 iteracji, boty zamrożone od początku M7
(`packages/sim/src/bots.ts`, commit 484700f). Każdy pomiar pełnym harnessem (`pnpm balance`) na zmienionych
danych liczę jako iterację i wpisuję tutaj. Pomiar bazowy (iteracja 0) nie wlicza się do limitu.
Czas runu = suma symulowanych rajdów (1×) + 45 s Prep na rajd (szacunek).

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
