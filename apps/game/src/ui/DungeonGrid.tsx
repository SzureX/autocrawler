import { useMemo, useState } from 'react';
import {
  legalPlacements,
  posKey,
  type Dir,
  type Pos,
  type RoomTile,
  type RunState,
} from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { DoorIcon, SpawnList } from './TileView';

interface Props {
  run: RunState;
  /** Tile that would be built on click (first tile of the hand). */
  tile: RoomTile | undefined;
  onPlace: (pos: Pos) => void;
}

/** 9x9 dungeon grid with legal-position highlighting and a ghost preview of the hand tile. */
export function DungeonGrid({ run, tile, onPlace }: Props) {
  const { width, height } = gameData.balance.grid;
  const [hover, setHover] = useState<string | null>(null);
  const legal = useMemo(() => {
    const keys: Record<string, boolean> = {};
    if (tile) for (const p of legalPlacements(gameData, run.dungeon, tile)) keys[posKey(p)] = true;
    return keys;
  }, [run.dungeon, tile]);

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = posKey({ x, y });
      const room = run.dungeon.rooms[key];
      const isLegal = legal[key] === true;
      const ghost = !room && tile && isLegal && hover === key;
      const doors: readonly Dir[] = room ? room.doors : ghost && tile ? tile.doors : [];
      const type = room
        ? gameData.roomTypes[room.roomTypeId]
        : ghost && tile
          ? gameData.roomTypes[tile.roomTypeId]
          : undefined;
      const classes = ['cell', room ? 'room' : '', isLegal ? 'legal' : '', ghost ? 'ghost' : '']
        .filter(Boolean)
        .join(' ');
      cells.push(
        <button
          key={key}
          type="button"
          className={classes}
          data-testid={`cell-${key}`}
          data-legal={isLegal ? 'true' : 'false'}
          disabled={!isLegal}
          onMouseEnter={() => setHover(key)}
          onMouseLeave={() => setHover((h) => (h === key ? null : h))}
          onClick={() => onPlace({ x, y })}
          title={room ? undefined : isLegal ? t('ui.prep.placeHint') : undefined}
        >
          {type && <span className="cell-icon">{type.icon}</span>}
          {doors.length > 0 && <DoorIcon doors={doors} />}
          {room && room.spawns.length > 0 && (
            <span className="cell-spawns">
              <SpawnList tile={room} />
            </span>
          )}
        </button>,
      );
    }
  }
  return (
    <div
      className="dungeon-grid"
      style={{ gridTemplateColumns: `repeat(${width}, 1fr)` }}
      data-testid="dungeon-grid"
    >
      {cells}
    </div>
  );
}
