# Decisions

Format: data, decyzja, powód.

- 2026-10-14: pnpm nie jest zainstalowany, `corepack enable` wymaga uprawnień admina (EPERM). Użyto `corepack enable --install-directory <katalog tymczasowy>` (pnpm 12 przez corepack); brak instalacji globalnej. Powód: zgodność z CLAUDE.md (pnpm workspaces).
