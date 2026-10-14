import { describe, expect, it } from 'vitest';
import { collectI18nKeys, loadGameData } from '@loch/data';
import { hasKey, t } from './index';

describe('i18n', () => {
  it('has every key referenced by the game data', () => {
    const missing = collectI18nKeys(loadGameData()).filter((k) => !hasKey(k));
    expect(missing).toEqual([]);
  });

  it('interpolates params and falls back to the key', () => {
    expect(t('app.wave', { wave: 3, max: 10 })).toBe('Fala 3/10');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
