import type { ModelLibrary } from './models';
import { PROP_IDS } from './propIds';
import type { PieceCatalog } from './roomBuilder';

/** The kinds of pieces the room builder offers (the walls are generated, not placed by hand). */
export type PieceGroup = 'floor' | 'prop';

export interface AssetEntry {
  /** File stem without the `floor_` prefix (floors) or the file name (props). */
  id: string;
  group: PieceGroup;
  file: string;
}

const FLOORS = [
  'tile_small',
  'tile_small_broken_A',
  'tile_small_broken_B',
  'tile_small_corner',
  'tile_small_decorated',
  'tile_small_weeds_A',
  'tile_small_weeds_B',
  'tile_large',
  'tile_large_rocks',
  'tile_grate',
  'tile_grate_open',
  'tile_big_grate',
  'tile_big_grate_open',
  'tile_big_spikes',
  'tile_extralarge_grates',
  'tile_extralarge_grates_open',
  'wood_small',
  'wood_small_dark',
  'wood_large',
  'wood_large_dark',
  'dirt_small_A',
  'dirt_small_B',
  'dirt_small_C',
  'dirt_small_D',
  'dirt_small_corner',
  'dirt_small_weeds',
  'dirt_large',
  'dirt_large_rocky',
  'foundation_allsides',
  'foundation_corner',
  'foundation_diagonal_corner',
  'foundation_front',
  'foundation_front_and_back',
  'foundation_front_and_sides',
];

const BASE = 'environment/';

/** Every piece the builder can place, with the file it comes from. */
export const BUILDER_ASSETS: AssetEntry[] = [
  ...FLOORS.map((id): AssetEntry => ({
    id,
    group: 'floor',
    file: `${BASE}floors/floor_${id}.gltf`,
  })),
];

/** Props (OBJ + MTL) are loaded on demand: there are many of them. */
export const PROP_ASSETS: AssetEntry[] = PROP_IDS.map((id): AssetEntry => ({
  id,
  group: 'prop',
  file: `${BASE}props/${id}.obj`,
}));

/** Category of a prop: the file name up to the first underscore (`barrel_small` -> `barrel`). */
export function propCategory(id: string): string {
  return id.split('_')[0] ?? id;
}

/**
 * Wall-mounted props: the height of their origin (model units) and how far it sits in front of the
 * wall's centre line (world units), or null for props that stand on the floor. Banners and
 * bookcases are modelled on the centre line; torches, shelves and hangings on the wall's face.
 */
export function propMount(id: string): { y: number; depth: number } | null {
  if (id.startsWith('banner_') || id === 'shelves') return { y: 0, depth: 0 };
  if (id.startsWith('shelf_')) return { y: 1.6, depth: 0.25 };
  if (id === 'torch_mounted' || id.startsWith('sword_shield')) return { y: 2.2, depth: 0.25 };
  if (id === 'keyring_hanging') return { y: 2.4, depth: 0.25 };
  return null;
}

/** Library key of a piece. */
export function assetKey(entry: Pick<AssetEntry, 'id' | 'group'>): string {
  return `${entry.group}:${entry.id}`;
}

export function propFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const e of PROP_ASSETS) files[assetKey(e)] = e.file;
  return files;
}

export function builderFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const e of BUILDER_ASSETS) files[assetKey(e)] = e.file;
  return files;
}

/** Floor sizes in cells, measured from the loaded models. */
export function measuredCatalog(models: ModelLibrary): PieceCatalog {
  return {
    floorSize(id) {
      const b = models.bounds(`floor:${id}`);
      return {
        w: Math.max(1, Math.round((b.max.x - b.min.x) / 2)),
        h: Math.max(1, Math.round((b.max.z - b.min.z) / 2)),
      };
    },
  };
}
