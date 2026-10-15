import { findStep } from './board';
import { emit, type RaidContext } from './context';
import { grantChestLoot } from './rewards';

/**
 * The hero walks to the front of the room's chest (it faces south, so he stands one cell below
 * it), opens it and takes `items` artifacts. Returns false when the tick limit is hit on the way.
 */
export function visitChest(ctx: RaidContext, items: number): boolean {
  const { x, y, openTicks } = ctx.data.balance.combat.chest;
  const hero = ctx.hero;
  const front = { x, y: y + 1 };
  const blocked = (bx: number, by: number): boolean =>
    (bx === x && by === y) || ctx.blocked[`${bx},${by}`] === true;
  while (hero.x !== front.x || hero.y !== front.y) {
    if (ctx.tick >= ctx.tickLimit) return false;
    const step = findStep(ctx.board, hero, front, 0, blocked);
    if (!step) break; // cannot happen on the empty board; open the chest from where he stands
    emit(ctx, {
      type: 'Move',
      tick: ctx.tick,
      unit: hero.id,
      from: { x: hero.x, y: hero.y },
      to: step,
      duration: hero.ticksPerCell,
    });
    hero.x = step.x;
    hero.y = step.y;
    ctx.tick += hero.ticksPerCell;
  }
  emit(ctx, { type: 'ChestOpen', tick: ctx.tick, cell: { x, y } });
  ctx.tick += openTicks;
  grantChestLoot(ctx, items);
  return true;
}
