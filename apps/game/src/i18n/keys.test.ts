/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasKey } from './index';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('i18n usage', () => {
  const root = join(process.cwd(), 'apps/game/src');
  const files = sources(root);

  it('every literal t("key") used in the code exists in pl.json', () => {
    const missing: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        const key = m[1];
        if (key && !hasKey(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('keys built from a prefix exist for every phase, reason and threat level', () => {
    for (const p of [
      'ClassSelect',
      'TileOffer',
      'BossOffer',
      'Prep',
      'Action',
      'Resolve',
      'Victory',
      'GameOver',
    ]) {
      expect(hasKey(`phase.${p}`)).toBe(true);
    }
    for (const r of ['cleared', 'died', 'timeout'])
      expect(hasKey(`resolve.reason.${r}`)).toBe(true);
    for (const l of ['low', 'medium', 'high']) expect(hasKey(`ui.threat.${l}`)).toBe(true);
    for (const d of ['N', 'E', 'S', 'W']) expect(hasKey(`dir.${d}`)).toBe(true);
    for (const k of [
      'maxHp',
      'atk',
      'aspd',
      'def',
      'moveSpeed',
      'critChance',
      'critMult',
      'accuracy',
      'range',
    ]) {
      expect(hasKey(`ui.stat.${k}`)).toBe(true);
    }
  });

  it('components contain no Polish letters outside pl.json', () => {
    const offenders = files.filter((f) => /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
