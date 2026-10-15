import { describe, expect, it } from 'vitest';
import {
  defaultLayout,
  emptyLayout,
  floorWorld,
  nearestWallMount,
  placeFloor,
  placeProp,
  propYaw,
  removeFloorAt,
  removePropNear,
  ROOM_PRESETS,
  snapProp,
  type PieceCatalog,
} from './roomBuilder';
import { wallPlacements } from './wallLayout';

const board = { width: 9, height: 7 };

/** Sizes as measured from the real models. */
const catalog: PieceCatalog = {
  floorSize: (id) => {
    if (id === 'large') return { w: 2, h: 2 };
    if (id === 'huge') return { w: 4, h: 4 };
    if (id === 'grate') return { w: 2, h: 1 };
    return { w: 1, h: 1 };
  },
};

describe('floors', () => {
  it('a quarter turn swaps the footprint of a 2x1 piece', () => {
    const grate = { id: 'grate', y: 0, rot: 0 };
    expect(placeFloor(emptyLayout(), { ...grate, x: 7 }, board, catalog)).not.toBeNull();
    expect(placeFloor(emptyLayout(), { ...grate, x: 8 }, board, catalog)).toBeNull();
    // Turned, it needs 1 cell of width and 2 of height.
    expect(placeFloor(emptyLayout(), { ...grate, x: 8, rot: 1 }, board, catalog)).not.toBeNull();
  });

  it('rejects pieces that leave the board and accepts ones that just fit', () => {
    const huge = { id: 'huge', rot: 0 };
    expect(placeFloor(emptyLayout(), { ...huge, x: 6, y: 0 }, board, catalog)).toBeNull();
    expect(placeFloor(emptyLayout(), { ...huge, x: 0, y: 4 }, board, catalog)).toBeNull();
    expect(placeFloor(emptyLayout(), { ...huge, x: 5, y: 3 }, board, catalog)).not.toBeNull();
  });

  it('a new piece replaces whatever it overlaps', () => {
    let layout = defaultLayout(board);
    expect(layout.floors).toHaveLength(63);
    layout = placeFloor(layout, { id: 'large', x: 3, y: 2, rot: 0 }, board, catalog) ?? layout;
    expect(layout.floors).toHaveLength(63 - 4 + 1);
    // A 1x1 on a cell of the large piece replaces the whole large piece.
    layout = placeFloor(layout, { id: 'tile_small', x: 4, y: 3, rot: 0 }, board, catalog) ?? layout;
    expect(layout.floors).toHaveLength(63 - 4 + 1 - 1 + 1);
    expect(layout.floors.some((f) => f.id === 'large')).toBe(false);
  });

  it('erasing a cell removes the piece that covers it', () => {
    const layout = placeFloor(emptyLayout(), { id: 'large', x: 1, y: 1, rot: 0 }, board, catalog);
    const erased = removeFloorAt(layout ?? emptyLayout(), { x: 2, y: 2 }, catalog);
    expect(erased.floors).toHaveLength(0);
  });

  it('puts a piece at the centre of its footprint', () => {
    const w = floorWorld({ id: 'large', x: 0, y: 0, rot: 0 }, board, catalog);
    expect(w.x).toBeCloseTo(-3.5);
    expect(w.z).toBeCloseTo(-2.5);
    expect(floorWorld({ id: 'tile_small', x: 4, y: 3, rot: 0 }, board, catalog)).toEqual({
      x: 0,
      z: 0,
      yaw: 0,
    });
  });
});

describe('room presets', () => {
  it('lists the preview, the start room, seven regular rooms and three boss rooms', () => {
    expect(ROOM_PRESETS.map((p) => p.kind)).toEqual([
      'all',
      'start',
      ...Array<string>(7).fill('regular'),
      ...Array<string>(3).fill('boss'),
    ]);
    expect(new Set(ROOM_PRESETS.map((p) => p.id)).size).toBe(ROOM_PRESETS.length);
    // No exit ever points west (the chain never turns back) and every room has an entrance.
    for (const p of ROOM_PRESETS.filter((x) => x.kind === 'regular')) {
      expect(p.exit).not.toBe('W');
      expect(p.doors).toHaveLength(2);
      expect(p.doors).toContain(p.entrance);
      expect(p.doors).toContain(p.exit);
    }
    expect(ROOM_PRESETS.find((p) => p.id === 'start')?.doors).toEqual(['E']);
  });

  it('every preset draws exactly its doors and the same walls otherwise', () => {
    const base = wallPlacements(board, []).length;
    for (const preset of ROOM_PRESETS) {
      const walls = wallPlacements(board, preset.doors);
      expect(walls).toHaveLength(base);
      expect(walls.filter((w) => w.model === 'door:doorway')).toHaveLength(preset.doors.length);
    }
  });
});

describe('props', () => {
  it('snaps to the half-cell grid and stays on the board', () => {
    expect(snapProp({ x: 0.3, z: -1.1 }, board)).toEqual({ x: 0.5, z: -1 });
    expect(snapProp({ x: 9, z: 9 }, board)).toEqual({ x: 4.5, z: 3.5 });
  });

  it('props may share a spot and are rejected outside the board', () => {
    let layout = emptyLayout();
    layout = placeProp(layout, { id: 'table_small', x: 1, z: 1, rot: 0 }, board) ?? layout;
    layout = placeProp(layout, { id: 'candle', x: 1, z: 1, rot: 0 }, board) ?? layout;
    expect(layout.props).toHaveLength(2);
    expect(placeProp(layout, { id: 'candle', x: 5.5, z: 0, rot: 0 }, board)).toBeNull();
    // A wall-mounted prop on the wall's centre line is fine.
    expect(placeProp(layout, { id: 'banner_red', x: 0, z: -3.75, rot: 0 }, board)).not.toBeNull();
  });

  it('erasing removes the nearest prop, the last placed on a tie, and ignores far clicks', () => {
    let layout = emptyLayout();
    layout = placeProp(layout, { id: 'table_small', x: 1, z: 1, rot: 0 }, board) ?? layout;
    layout = placeProp(layout, { id: 'candle', x: 1, z: 1, rot: 0 }, board) ?? layout;
    layout = placeProp(layout, { id: 'barrel_small', x: -2, z: 1, rot: 0 }, board) ?? layout;
    const once = removePropNear(layout, { x: 1, z: 1 });
    expect(once.props.map((p) => p.id)).toEqual(['table_small', 'barrel_small']);
    expect(removePropNear(layout, { x: 3, z: -3 })).toBe(layout);
  });

  it('has eight turns of 45 degrees', () => {
    expect(propYaw(0)).toBe(0);
    expect(propYaw(1)).toBeCloseTo(Math.PI / 4);
    expect(propYaw(7)).toBeCloseTo((7 * Math.PI) / 4);
    expect(propYaw(8)).toBe(0);
  });

  it('snaps wall-mounted props to the nearest wall, facing the room', () => {
    expect(nearestWallMount({ x: 0.3, z: -3.3 }, board)).toEqual({ x: 0.5, z: -3.75, rot: 0 });
    expect(nearestWallMount({ x: 4.2, z: 0.2 }, board)).toEqual({ x: 4.75, z: 0, rot: 6 });
    expect(nearestWallMount({ x: 1, z: 3.4 }, board)).toEqual({ x: 1, z: 3.75, rot: 4 });
    expect(nearestWallMount({ x: -4.4, z: -1.2 }, board)).toEqual({ x: -4.75, z: -1, rot: 2 });
    // A prop modelled on the wall's face sits a quarter cell in front of the centre line.
    expect(nearestWallMount({ x: 0, z: -3.3 }, board, 0.25)).toEqual({ x: 0, z: -3.5, rot: 0 });
    expect(nearestWallMount({ x: 4.2, z: 0 }, board, 0.25)).toEqual({ x: 4.5, z: 0, rot: 6 });
  });
});
