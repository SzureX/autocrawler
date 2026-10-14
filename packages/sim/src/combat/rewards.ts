import type { RoomTypeDef } from '@loch/data';
import { rollArtifact, rollUpgradeId, type DropSpec } from '../loot';
import { emit, type RaidContext } from './context';
import type { Unit } from './types';
import type { RoomMods } from './units';

function giveDrop(ctx: RaidContext, drop: DropSpec, unit: number | null): void {
  if (drop.kind === 'artifact') {
    const artifact = {
      uid: `art-${ctx.loot.nextUid++}`,
      artifactId: drop.artifactId,
      level: 1 as const,
    };
    ctx.loot.artifacts.push(artifact);
    emit(ctx, { type: 'LootDropped', tick: ctx.tick, unit, item: { kind: 'artifact', artifact } });
  } else {
    ctx.loot.upgrades.push(drop.upgradeId);
    emit(ctx, {
      type: 'LootDropped',
      tick: ctx.tick,
      unit,
      item: { kind: 'upgrade', upgradeId: drop.upgradeId },
    });
  }
}

/** A killed monster hands over everything it carried (drops of unkilled monsters are lost). */
export function collectDrops(ctx: RaidContext, monster: Unit): void {
  const drops = ctx.unitDrops[monster.id];
  if (!drops) return;
  for (const d of drops) giveDrop(ctx, d, monster.id);
  delete ctx.unitDrops[monster.id];
}

/** Rewards for clearing a room: room type effects and upgrades (Treasury, Trap, Anvil, Gate). */
export function grantClearRewards(ctx: RaidContext, type: RoomTypeDef, mods: RoomMods): void {
  const { data, rewardRng } = ctx;
  for (const e of type.onClear) {
    if (e.kind === 'bonusArtifactChance') {
      if (rewardRng.chance(e.chance)) {
        for (let i = 0; i < e.count; i++) {
          giveDrop(
            ctx,
            { kind: 'artifact', artifactId: rollArtifact(data, rewardRng, ctx.level) },
            null,
          );
        }
      }
    } else if (e.kind === 'grantRoomUpgrade') {
      for (let i = 0; i < e.count; i++) {
        giveDrop(ctx, { kind: 'upgrade', upgradeId: rollUpgradeId(data, rewardRng) }, null);
      }
    }
  }
  for (const minRarity of mods.clearArtifacts) {
    giveDrop(
      ctx,
      { kind: 'artifact', artifactId: rollArtifact(data, rewardRng, ctx.level, minRarity) },
      null,
    );
  }
}
