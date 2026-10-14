import { describe, expect, it } from 'vitest';
import { loadGameData } from '@loch/data';
import { chooseTile, createRun, equip, grantArtifact } from '@loch/sim';
import { previewStatDiff } from './previewStats';

const data = loadGameData();

function prepRun() {
  const run = createRun(data, 1, 'warrior');
  const first = run.tileOffer[0];
  if (!first) throw new Error('no offer');
  return grantArtifact(data, chooseTile(run, first.uid), 'sharp_dagger');
}

describe('previewStatDiff', () => {
  it('shows a positive delta for equipping and negative for unequipping', () => {
    const run = prepRun();
    const uid = run.backpack[0]?.uid ?? '';
    const up = previewStatDiff(data, run, { kind: 'equip', artifactUid: uid, slot: 0 });
    expect(up).toEqual([{ stat: 'atk', before: 10, after: 13, delta: 3 }]);
    const equipped = equip(run, uid, 0);
    const down = previewStatDiff(data, equipped, { kind: 'unequip', slot: 0 });
    expect(down[0]?.delta).toBe(-3);
  });

  it('returns nothing for impossible actions', () => {
    expect(previewStatDiff(data, prepRun(), { kind: 'unequip', slot: 2 })).toEqual([]);
  });
});
