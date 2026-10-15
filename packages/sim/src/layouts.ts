import type { GameData, RoomLayoutDef } from '@loch/data';
import { canonicalDoors } from './grid';
import type { Rng } from './rng';
import type { Dir } from './types';

/** True when a layout fits a room with exactly these doors ("normal" layouts fit every room). */
export function layoutFits(
  layout: RoomLayoutDef,
  roomTypeId: string,
  doors: readonly Dir[],
): boolean {
  if (layout.roomTypeId !== roomTypeId) return false;
  if (layout.doors === null) return true;
  const a = canonicalDoors(layout.doors);
  const b = canonicalDoors(doors);
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/**
 * Picks the layout of a new tile: a random one among the normal layouts of its room type and the
 * specific ones made for exactly its doors. Undefined when the type has none (the room then keeps
 * the default look).
 */
export function pickLayoutId(
  data: GameData,
  rng: Rng,
  roomTypeId: string,
  doors: readonly Dir[],
): string | undefined {
  const fitting = Object.values(data.roomLayouts).filter((l) => layoutFits(l, roomTypeId, doors));
  if (fitting.length === 0) return undefined;
  return fitting[rng.int(0, fitting.length - 1)]?.id;
}

/** Board cells the props of a room's layout occupy, as a lookup by `"x,y"` (empty without one). */
export function blockedCells(
  data: GameData,
  layoutId: string | undefined,
): Record<string, boolean> {
  const blocked: Record<string, boolean> = {};
  const layout = layoutId ? data.roomLayouts[layoutId] : undefined;
  if (layout) for (const [x, y] of layout.blocked) blocked[`${x},${y}`] = true;
  return blocked;
}
