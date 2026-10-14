import { useMemo, useState } from 'react';
import {
  legalPlacements,
  posKey,
  type Dir,
  type Pos,
  type RoomInstance,
  type RoomTile,
  type RunState,
} from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { DropButton, roomDropId } from './dnd';
import { roomTypeName, upgradeName } from './names';
import { DoorIcon, SpawnList } from './TileView';

interface Props {
  run: RunState;
  /** Tile that would be built on click (first tile of the hand). */
  tile: RoomTile | undefined;
  onPlace: (pos: Pos) => void;
  /** Upgrade picked from the storage: clicking a room assigns it. */
  selectedUpgrade?: string | null;
  /** Called when a built room is clicked (assign or remove its upgrade). */
  onRoomClick?: (roomKey: string) => void;
}

/** Hover card over a built room: type, monsters (icons x count, elites marked) and upgrade. */
export function RoomTooltip({ room }: { room: RoomInstance }) {
  return (
    <span className="tooltip" role="tooltip" data-testid="room-tooltip">
      <strong>{roomTypeName(room.roomTypeId)}</strong>
      <span>
        {t('ui.tile.monsters')}: <SpawnList tile={room} />
      </span>
      <span>
        {t('ui.tooltip.upgrade')}:{' '}
        {room.upgradeId ? upgradeName(room.upgradeId) : t('ui.tooltip.none')}
      </span>
    </span>
  );
}

/** 9x9 dungeon grid with legal-position highlighting, a ghost preview and room tooltips. */
export function DungeonGrid({ run, tile, onPlace, selectedUpgrade, onRoomClick }: Props) {
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
      const active = isLegal || (room && onRoomClick && (selectedUpgrade || room.upgradeId));
      const classes = [
        'cell',
        room ? 'room' : '',
        isLegal ? 'legal' : '',
        ghost ? 'ghost' : '',
        active ? '' : 'inactive',
      ]
        .filter(Boolean)
        .join(' ');
      cells.push(
        <DropButton
          key={key}
          dropId={roomDropId(key)}
          type="button"
          className={classes}
          data-testid={`cell-${key}`}
          data-legal={isLegal ? 'true' : 'false'}
          aria-disabled={!active}
          onMouseEnter={() => setHover(key)}
          onMouseLeave={() => setHover((h) => (h === key ? null : h))}
          onClick={() => {
            if (room) {
              if (active) onRoomClick?.(key);
            } else if (isLegal) onPlace({ x, y });
          }}
        >
          {type && <span className="cell-icon">{type.icon}</span>}
          {doors.length > 0 && <DoorIcon doors={doors} />}
          {room?.upgradeId && (
            <span className="cell-upgrade" data-testid={`upgrade-${key}`}>
              {gameData.roomUpgrades[room.upgradeId]?.icon}
            </span>
          )}
          {room && room.spawns.length > 0 && (
            <span className="cell-spawns">
              <SpawnList tile={room} />
            </span>
          )}
          {room && <RoomTooltip room={room} />}
        </DropButton>,
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
