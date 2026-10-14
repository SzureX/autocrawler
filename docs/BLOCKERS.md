# Blockers

## Niestabilny test e2e (zauważony w etapie porządkowym, 2026-10-15)

- Co: `apps/game/e2e/full-run.spec.ts` (bot przechodzi cały run przez UI) raz padł na timeout 2 min przy pierwszym uruchomieniu `pnpm e2e` (stan wyjściowy); w 4 kolejnych pełnych uruchomieniach i 2 pojedynczych przeszedł (ok. 22–27 s).
- Co próbowano: powtórne uruchomienia (pojedynczo i razem z resztą). Nie zmieniano kodu ani testów (poza zakresem porządków).
- Hipoteza: rzadkie zawieszenie przy równoległym starcie 3 workerów z renderowaniem WebGL (SwiftShader) albo zimny start serwera Vite; test nie ma retry.
- Status: do zbadania osobno (wpisane też do docs/BACKLOG.md).
