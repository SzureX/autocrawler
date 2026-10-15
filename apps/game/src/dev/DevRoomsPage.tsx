import { useEffect, useRef, useState } from 'react';
import {
  blockedCells,
  createRng,
  createRun,
  generateSpawns,
  pickLayoutId,
  pickMonsterId,
  simulateRaid,
  type RaidEvent,
  type RoomTile,
} from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { roomTypeName } from '../ui/names';
import { TileView } from '../ui/TileView';
import { RaidCanvas } from '../view/RaidCanvas';
import { ROOM_PRESETS } from '../view/roomBuilder';
import { DevRoomBuilder } from './DevRoomBuilder';

const ANY = 'any';

interface Generated {
  tile: RoomTile;
  log: RaidEvent[];
  seed: number;
}

/**
 * Builds a "raid log" for one room. Fights are a still picture (the hero stands in the door, every
 * monster at a random cell); a room with a chest is played by the real simulation, so the hero
 * walks up to the chest, opens it and takes the artifact.
 */
function generateRoom(seed: number, roomTypeId: string, level: number): Generated {
  const rng = createRng(seed);
  const regular = Object.values(gameData.roomTypes).filter((r) => !r.isBoss);
  const type =
    gameData.roomTypes[roomTypeId] ?? regular[rng.int(0, regular.length - 1)] ?? regular[0];
  if (!type) throw new Error('No room types in the data');
  const isBoss = type.isBoss;
  const bossId = Object.keys(gameData.bosses)[0];
  let spawns = generateSpawns(gameData, rng.fork('spawns'), type, level);
  // Rooms like the Trap are decided anew in every raid: a chest or a fight.
  let chest = type.onEnter.some((e) => e.kind === 'chestLoot');
  if (type.outcome) {
    chest = rng.fork('outcome').chance(type.outcome.chestChance);
    if (!chest) {
      spawns = Array.from({ length: type.outcome.monsters }, () => ({
        monsterId: pickMonsterId(gameData, rng.fork('trap-monster'), level),
        elite: false,
      }));
    }
  }
  // A door layout this type of room can really have, and the layout (floors, props) it would get.
  const kinds = ROOM_PRESETS.filter((p) => (isBoss ? p.kind === 'boss' : p.kind === 'regular'));
  const doors = kinds[rng.fork('doors').int(0, kinds.length - 1)]?.doors ?? ['N', 'E', 'S', 'W'];
  const layoutId = pickLayoutId(gameData, rng.fork('layout'), type.id, doors);
  const blocked = blockedCells(gameData, layoutId);
  const tile: RoomTile = {
    uid: `dev-${seed}`,
    roomTypeId: type.id,
    doors: [],
    spawns,
    isBoss,
    ...(isBoss && bossId ? { bossId } : {}),
  };

  if (chest) {
    const run = createRun(gameData, seed, 'warrior');
    const start = run.dungeon.rooms[run.dungeon.startKey];
    if (!start) throw new Error('The new run has no start room');
    const room = {
      ...start,
      roomTypeId: type.id,
      spawns: [],
      doors: [...doors],
      ...(layoutId ? { layoutId } : {}),
    };
    const alone = {
      ...run,
      phase: 'Prep' as const,
      dungeon: { rooms: { [run.dungeon.startKey]: room }, startKey: run.dungeon.startKey },
    };
    // A trap rolls chest or fight in every raid; replay raids until the chest comes up.
    for (let attempt = 0; attempt < 100; attempt++) {
      const log = simulateRaid(gameData, alone, { attempt }).log;
      const enter = log.find((e) => e.type === 'RoomEnter');
      if (enter?.type === 'RoomEnter' && enter.chest) return { tile, log, seed };
    }
    throw new Error('No raid with a chest found');
  }

  const board = gameData.balance.combat.board;
  const entry = { x: Math.floor(board.width / 2), y: board.height - 1 };
  const taken: Record<string, boolean> = { [`${entry.x},${entry.y}`]: true };
  const freeCell = (): { x: number; y: number } => {
    for (let guard = 0; guard < 200; guard++) {
      const c = { x: rng.int(1, board.width - 2), y: rng.int(0, board.height - 3) };
      if (!taken[`${c.x},${c.y}`] && !blocked[`${c.x},${c.y}`]) {
        taken[`${c.x},${c.y}`] = true;
        return c;
      }
    }
    return { x: board.width - 2, y: 1 };
  };

  const log: RaidEvent[] = [
    { type: 'RaidStart', tick: 0, heroMaxHp: 100, dungeonLevel: level, route: [] },
    {
      type: 'RoomEnter',
      tick: 0,
      roomKey: 'dev',
      roomTypeId: type.id,
      upgradeId: null,
      entry,
      transit: false,
      exit: null,
      duration: 0,
      from: null,
      chest: null,
      layoutId: layoutId ?? null,
      doors: [...doors],
    },
  ];
  let unit = 1;
  const add = (monsterId: string, elite: boolean, boss: boolean, at: { x: number; y: number }) => {
    const def = gameData.monsters[monsterId] ?? gameData.bosses[monsterId];
    const hp = def?.stats.maxHp ?? 1;
    log.push({
      type: 'Spawn',
      tick: 0,
      unit: unit++,
      monsterId,
      elite,
      boss,
      summoned: false,
      x: at.x,
      y: at.y,
      hp,
      maxHp: hp,
    });
  };
  if (isBoss && bossId) {
    add(bossId, false, true, {
      x: Math.floor(board.width / 2) + 1,
      y: Math.floor(board.height / 2),
    });
  }
  for (const s of spawns) add(s.monsterId, s.elite, false, freeCell());
  return { tile, log, seed };
}

/** DEV-only page (/dev/rooms): generate rooms and look at them in 3D, or build one by hand. */
export function DevRoomsPage() {
  const [building, setBuilding] = useState(false);
  return building ? (
    <DevRoomBuilder onClose={() => setBuilding(false)} />
  ) : (
    <RoomGenerator onBuild={() => setBuilding(true)} />
  );
}

function RoomGenerator({ onBuild }: { onBuild: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<RaidCanvas | null>(null);
  const ready = useRef<Promise<void> | null>(null);
  const [roomType, setRoomType] = useState(ANY);
  const [level, setLevel] = useState(1);
  const [current, setCurrent] = useState<Generated | null>(null);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!host.current) return;
    const c = new RaidCanvas(host.current);
    canvas.current = c;
    ready.current = c.init();
    return () => {
      c.destroy();
      canvas.current = null;
    };
  }, []);

  const generate = () => {
    const seed = Math.floor(Math.random() * 1_000_000);
    const room = generateRoom(seed, roomType, level);
    setCurrent(room);
    void ready.current?.then(() => {
      canvas.current?.setSpeed(speed);
      canvas.current?.load(room.log);
    });
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    canvas.current?.setSpeed(s);
  };

  return (
    <main className="app" data-testid="dev-rooms">
      <h2>{t('dev.rooms.title')}</h2>
      <div className="dev-controls">
        <button onClick={() => window.location.assign('../')} data-testid="rooms-back">
          {t('dev.map.back')}
        </button>
        <select
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
          data-testid="rooms-type"
        >
          <option value={ANY}>{t('dev.rooms.anyType')}</option>
          {Object.values(gameData.roomTypes).map((r) => (
            <option key={r.id} value={r.id}>
              {roomTypeName(r.id)}
            </option>
          ))}
        </select>
        <label>
          {t('dev.rooms.level')}{' '}
          <input
            type="number"
            min={1}
            max={gameData.balance.wavesToBoss + 1}
            value={level}
            onChange={(e) => setLevel(Math.max(1, Number(e.target.value) || 1))}
            data-testid="rooms-level"
          />
        </label>
        <button onClick={onBuild} data-testid="rooms-build">
          {t('dev.rooms.build')}
        </button>
        <button onClick={generate} data-testid="rooms-generate">
          {t('dev.rooms.generate')}
        </button>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            className={speed === s ? 'active' : ''}
            onClick={() => changeSpeed(s)}
            data-testid={`rooms-speed-${s}`}
          >
            {s}×
          </button>
        ))}
        <button onClick={() => canvas.current?.skip()} data-testid="rooms-skip">
          {t('dev.raid.skip')}
        </button>
        {current && (
          <span data-testid="rooms-seed">{t('dev.rooms.seed', { seed: current.seed })}</span>
        )}
      </div>
      <div ref={host} className="raid-canvas" data-testid="raid-canvas" />
      {current && (
        <div data-testid="rooms-info">
          <TileView tile={current.tile} />
        </div>
      )}
      {current?.tile.isBoss && <p className="hint">{t('dev.rooms.bossHint')}</p>}
    </main>
  );
}
