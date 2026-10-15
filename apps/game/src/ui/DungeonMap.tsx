import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import {
  legalPlacements,
  posKey,
  type Pos,
  type RoomInstance,
  type RoomTile,
  type RunState,
} from '@loch/sim';
import { gameData } from '../store/gameStore';
import { DungeonMapCanvas } from '../view/DungeonMapCanvas';
import { DropButton, roomDropId } from './dnd';
import { RoomTooltip } from './DungeonGrid';

export const MAP_WIDTH = 900;
export const MAP_HEIGHT = 720;

/** What the screen can ask of the map. */
export interface MapHandle {
  /** Flies the tile in from a position on the map (canvas pixels); resolves when it has landed. */
  fly: (tile: RoomTile, targetKey: string, from: { x: number; y: number }) => Promise<void>;
  /** Zooms into a room the way the raid camera sees it; resolves when the camera has arrived. */
  flyToRoom: (key: string) => Promise<void>;
  /** The current frame as a picture (to blend into the next screen). */
  snapshot: () => string | null;
}

interface Props {
  run: RunState;
  /** Tile in hand: its legal positions are marked and can be clicked (only a boss in a closed dungeon). */
  tile: RoomTile | undefined;
  onPlace: (pos: Pos) => void;
  /** Upgrade picked from the storage: clicking a room assigns it. */
  selectedUpgrade?: string | null;
  /** Called when a built room is clicked (assign or remove its upgrade). */
  onRoomClick?: (roomKey: string) => void;
  handleRef?: MutableRefObject<MapHandle | null>;
  /** The map opens zoomed into this room and pulls back to the whole dungeon. */
  introRoom?: string | null;
  /** Called when that pull-back is over. */
  onIntroDone?: () => void;
}

function polygonCss(points: [number, number][]): string {
  return `polygon(${points.map(([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`).join(',')})`;
}

/**
 * The dungeon as a 3D map (the rooms look exactly like in the raid) with a transparent layer of
 * buttons over every room, so rooms can be clicked, hovered and dropped on like before.
 */
export function DungeonMap({
  run,
  tile,
  onPlace,
  selectedUpgrade,
  onRoomClick,
  handleRef,
  introRoom,
  onIntroDone,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<DungeonMapCanvas | null>(null);
  const cells = useRef<Record<string, HTMLDivElement | null>>({});

  const legal = useMemo(
    () => (tile ? legalPlacements(gameData, run.dungeon, tile).map((p) => posKey(p)) : []),
    [run.dungeon, tile],
  );

  const layoutCells = () => {
    const c = canvas.current;
    if (!c) return;
    for (const [key, el] of Object.entries(cells.current)) {
      if (!el) continue;
      const r = c.cellRect(key);
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.setProperty('--poly', polygonCss(r.polygon));
    }
  };

  useEffect(() => {
    if (!host.current) return;
    const c = new DungeonMapCanvas(host.current, MAP_WIDTH, MAP_HEIGHT);
    canvas.current = c;
    c.onCamera(layoutCells);
    void c.init().then(() => {
      layoutCells();
      if (introRoom) {
        c.startClose(introRoom);
        void c.overview().then(() => onIntroDone?.());
      }
    });
    if (handleRef) {
      handleRef.current = {
        fly: (t, key, from) => c.flyTile(t, key, from),
        flyToRoom: (key) => c.flyToRoom(key),
        snapshot: () => c.snapshot(),
      };
    }
    return () => {
      if (handleRef) handleRef.current = null;
      c.destroy();
      canvas.current = null;
    };
    // The canvas lives as long as the screen; later changes arrive through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    canvas.current?.setRooms(run.dungeon.rooms);
    canvas.current?.setLegal(legal);
  }, [run.dungeon.rooms, legal]);

  const rooms = Object.entries(run.dungeon.rooms);
  const keys = [...rooms.map(([key]) => key), ...legal.filter((k) => !run.dungeon.rooms[k])];
  useEffect(() => {
    layoutCells();
  });

  const cell = (key: string, room: RoomInstance | undefined) => {
    const isLegal = !room && legal.includes(key);
    const assignable = room && onRoomClick && (selectedUpgrade || room.upgradeId);
    const active = isLegal || assignable;
    const [x, y] = key.split(',').map(Number);
    return (
      <div
        key={key}
        ref={(el) => {
          cells.current[key] = el;
        }}
        className="map-cell"
        data-testid={`cell-${key}`}
        data-legal={isLegal ? 'true' : 'false'}
      >
        <DropButton
          dropId={roomDropId(key)}
          type="button"
          className={`map-hit${isLegal ? ' legal' : ''}${assignable ? ' assignable' : ''}`}
          aria-disabled={!active}
          aria-label={key}
          onClick={() => {
            if (room) {
              if (active) onRoomClick?.(key);
            } else if (isLegal && x !== undefined && y !== undefined) onPlace({ x, y });
          }}
        >
          {null}
        </DropButton>
        {room?.upgradeId && (
          <span className="map-upgrade" data-testid={`upgrade-${key}`}>
            {gameData.roomUpgrades[room.upgradeId]?.icon}
          </span>
        )}
        {room && <RoomTooltip room={room} />}
      </div>
    );
  };

  return (
    <div className="dungeon-map" style={{ width: MAP_WIDTH, height: MAP_HEIGHT }}>
      <div ref={host} className="dungeon-map-canvas" data-testid="dungeon-map" />
      {keys.map((key) => cell(key, run.dungeon.rooms[key]))}
    </div>
  );
}
