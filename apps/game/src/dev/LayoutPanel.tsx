import { useEffect, useMemo, useState } from 'react';
import { roomLayoutSchema, type RoomLayoutDef } from '@loch/data';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { roomTypeName } from '../ui/names';
import {
  blockedFromLayout,
  doorCellOf,
  validateLayout,
  type BoundsSource,
  type ValidationIssue,
} from '../view/layoutTools';
import {
  ROOM_PRESETS,
  SIDES,
  type RoomLayout,
  type RoomPreset,
  type Side,
} from '../view/roomBuilder';
import { presetLabel } from './presetLabel';
import { fetchLayouts, saveLayouts } from './roomLayoutsApi';

const BOARD = gameData.balance.combat.board;
const CHEST = gameData.balance.combat.chest;
const CELL = 38;

interface Props {
  /** What is built now: floors and props (walls and doors follow the chosen door layout). */
  layout: RoomLayout;
  presetId: string;
  onPreset: (id: string) => void;
  /** Puts a saved layout into the builder. */
  onLoad: (layout: RoomLayout) => void;
  bounds: BoundsSource & { floorSize(id: string): { w: number; h: number } };
  /** Loads the prop models (needed to measure props); resolves when they are ready. */
  ensureProps: () => Promise<void>;
  /** Changes whenever more models became available (re-measures the layout). */
  modelsVersion: number;
}

function sameDoors(a: readonly Side[] | null, b: readonly Side[]): boolean {
  return (
    a !== null &&
    a.length === b.length &&
    SIDES.filter((s) => a.includes(s)).join() === SIDES.filter((s) => b.includes(s)).join()
  );
}

/** Stable colour of a floor piece in the 2D preview. */
function floorColour(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 35% 38%)`;
}

/** The first free number for a room type and kind of layout (also the end of its id). */
function nextNumber(roomTypeId: string, presetId: string, taken: ReadonlySet<string>): number {
  const kind = presetId === 'all' ? 'normal' : presetId.toLowerCase().replace(/-/g, '_');
  for (let n = 1; ; n++) {
    if (!taken.has(`${roomTypeId}_${kind}_${n}`)) return n;
  }
}

function layoutId(roomTypeId: string, presetId: string, taken: ReadonlySet<string>): string {
  const kind = presetId === 'all' ? 'normal' : presetId.toLowerCase().replace(/-/g, '_');
  return `${roomTypeId}_${kind}_${nextNumber(roomTypeId, presetId, taken)}`;
}

/** Short name of a kind of layout for the automatic name: Normalny, Start, W-E, Boss-W. */
function kindName(p: RoomPreset): string {
  switch (p.kind) {
    case 'all':
      return t('dev.layout.nameNormal');
    case 'start':
      return t('dev.layout.nameStart');
    case 'boss':
      return t('dev.layout.nameBoss', { entrance: t(`dir.${p.entrance ?? 'W'}`) });
    default:
      return t('dev.layout.nameRegular', {
        entrance: t(`dir.${p.entrance ?? 'W'}`),
        exit: t(`dir.${p.exit ?? 'E'}`),
      });
  }
}

function issueText(i: ValidationIssue): string {
  return t(i.key, i.params);
}

/** Right-hand panel of the room builder: pick the room, save the layout, see it from above. */
export function LayoutPanel({
  layout,
  presetId,
  onPreset,
  onLoad,
  bounds,
  ensureProps,
  modelsVersion,
}: Props) {
  const [roomTypeId, setRoomTypeId] = useState('chamber');
  // A name typed by hand; until then the panel suggests RoomType_Layout_Id by itself.
  const [customName, setCustomName] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState<RoomLayoutDef[]>(() => Object.values(gameData.roomLayouts));
  const [canSave, setCanSave] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLayouts()
      .then((list) => {
        if (!alive) return;
        setSaved(list);
        setCanSave(true);
      })
      .catch(() => alive && setStatus(t('dev.layout.noServer')));
    return () => {
      alive = false;
    };
  }, []);

  const type = gameData.roomTypes[roomTypeId];
  const isBoss = type?.isBoss ?? false;
  const preset = ROOM_PRESETS.find((p) => p.id === presetId) ?? ROOM_PRESETS[0];
  const doors: readonly Side[] = preset?.doors ?? SIDES;
  const normal = presetId === 'all';
  const autoName = `${roomTypeName(roomTypeId)}_${kindName(preset ?? ROOM_PRESETS[0] ?? { id: 'all', kind: 'all', doors: [] })}_${nextNumber(
    roomTypeId,
    presetId,
    new Set(saved.map((l) => l.id)),
  )}`;
  const name = customName ?? autoName;

  // The kinds of layout a room type can have: normal, or one for an exact set of doors.
  const kinds: RoomPreset[] = ROOM_PRESETS.filter((p) =>
    p.kind === 'all'
      ? true
      : isBoss
        ? p.kind === 'boss'
        : p.kind === 'regular' || (p.kind === 'start' && roomTypeId === 'chamber'),
  );
  const countFor = (typeId: string, p: RoomPreset): number =>
    saved.filter(
      (l) =>
        l.roomTypeId === typeId &&
        (p.kind === 'all' ? l.doors === null : sameDoors(l.doors, p.doors)),
    ).length;

  const changeType = (id: string) => {
    setRoomTypeId(id);
    const boss = gameData.roomTypes[id]?.isBoss ?? false;
    const current = ROOM_PRESETS.find((p) => p.id === presetId);
    const allowed =
      current?.kind === 'all' ||
      (boss
        ? current?.kind === 'boss'
        : current?.kind === 'regular' || (current?.kind === 'start' && id === 'chamber'));
    if (!allowed) onPreset('all');
    setEditingId(null);
    setCustomName(null);
  };

  const analysis = useMemo(() => {
    void modelsVersion;
    const blocked = blockedFromLayout(layout, BOARD, bounds, (id) => bounds.floorSize(id));
    const cx = Math.floor(BOARD.width / 2);
    const cy = Math.floor(BOARD.height / 2);
    const hasChest = roomTypeId === 'chest' || roomTypeId === 'trap_room';
    const reserved: [number, number][] = hasChest
      ? [
          [CHEST.x, CHEST.y],
          [CHEST.x, CHEST.y + 1],
        ]
      : isBoss
        ? [[cx, cy]]
        : [];
    const mustReach: [number, number][] = hasChest
      ? [[CHEST.x, CHEST.y + 1]]
      : isBoss
        ? [[cx, cy]]
        : [];
    const result = validateLayout({
      layout,
      board: BOARD,
      blocked,
      doors,
      reserved,
      mustReach,
      floorSize: (id) => bounds.floorSize(id),
    });
    return { blocked, reserved, hasChest, ...result };
  }, [layout, bounds, roomTypeId, isBoss, doors, modelsVersion]);

  const writable = canSave && name.trim().length > 0 && analysis.errors.length === 0;

  const persist = async (asNew: boolean) => {
    const existing = asNew ? null : saved.find((l) => l.id === editingId);
    const id = existing?.id ?? layoutId(roomTypeId, presetId, new Set(saved.map((l) => l.id)));
    const entry = roomLayoutSchema.parse({
      id,
      name: name.trim(),
      roomTypeId,
      doors: normal ? null : SIDES.filter((s) => doors.includes(s)),
      floors: layout.floors.map((f) => ({ id: f.id, x: f.x, y: f.y, rot: f.rot })),
      props: layout.props.map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        rot: p.rot,
        ...(p.y !== undefined ? { y: p.y } : {}),
      })),
      blocked: analysis.blocked,
    } satisfies RoomLayoutDef);
    const next = existing ? saved.map((l) => (l.id === id ? entry : l)) : [...saved, entry];
    try {
      await saveLayouts(next);
      setSaved(next);
      setEditingId(id);
      setCustomName(entry.name);
      setStatus(t('dev.layout.saved', { name: entry.name }));
    } catch (error) {
      setStatus(t('dev.layout.saveFailed', { error: String(error) }));
    }
  };

  const load = (entry: RoomLayoutDef) => {
    setRoomTypeId(entry.roomTypeId);
    setCustomName(entry.name);
    setEditingId(entry.id);
    const match =
      entry.doors === null
        ? undefined
        : ROOM_PRESETS.find((p) => p.kind !== 'all' && sameDoors(entry.doors, p.doors));
    onPreset(match?.id ?? 'all');
    void ensureProps().then(() => onLoad({ floors: entry.floors, props: entry.props }));
    setStatus(null);
  };

  const remove = async (entry: RoomLayoutDef) => {
    const next = saved.filter((l) => l.id !== entry.id);
    try {
      await saveLayouts(next);
      setSaved(next);
      if (editingId === entry.id) setEditingId(null);
      setStatus(t('dev.layout.deleted', { name: entry.name }));
    } catch (error) {
      setStatus(t('dev.layout.saveFailed', { error: String(error) }));
    }
  };

  const forType = saved.filter((l) => l.roomTypeId === roomTypeId);
  const doorCells = doors.map((d) => doorCellOf(d, BOARD));
  const key = (x: number, y: number) => `${x},${y}`;
  const blockedSet = new Set(analysis.blocked.map(([x, y]) => key(x, y)));
  const doorSet = new Set(doorCells.map(([x, y]) => key(x, y)));
  const reservedSet = new Set(analysis.reserved.map(([x, y]) => key(x, y)));
  const w = BOARD.width * CELL;
  const h = BOARD.height * CELL;

  return (
    <aside className="builder-panel" data-testid="layout-panel">
      <h3>{t('dev.layout.title')}</h3>
      <label className="panel-row">
        {t('dev.layout.type')}
        <select
          value={roomTypeId}
          onChange={(e) => changeType(e.target.value)}
          data-testid="layout-type"
        >
          {Object.values(gameData.roomTypes).map((r) => (
            <option key={r.id} value={r.id}>
              {roomTypeName(r.id)} ({saved.filter((l) => l.roomTypeId === r.id).length})
            </option>
          ))}
        </select>
      </label>
      <label className="panel-row">
        {t('dev.layout.kind')}
        <select
          value={presetId}
          onChange={(e) => onPreset(e.target.value)}
          data-testid="layout-kind"
        >
          {kinds.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kind === 'all' ? t('dev.layout.normal') : presetLabel(p)} (
              {countFor(roomTypeId, p)})
            </option>
          ))}
        </select>
      </label>
      <label className="panel-row">
        {t('dev.layout.name')}
        <input
          value={name}
          onChange={(e) => setCustomName(e.target.value)}
          data-testid="layout-name"
        />
      </label>

      <h4>{t('dev.layout.preview')}</h4>
      <svg width={w} height={h} className="layout-preview" data-testid="layout-preview" role="img">
        <rect width={w} height={h} fill="#0b0c10" />
        {layout.floors.map((f, i) => {
          const size = bounds.floorSize(f.id);
          const sw = f.rot % 2 === 1 ? size.h : size.w;
          const sh = f.rot % 2 === 1 ? size.w : size.h;
          return (
            <rect
              key={`f${i}`}
              x={f.x * CELL + 1}
              y={f.y * CELL + 1}
              width={sw * CELL - 2}
              height={sh * CELL - 2}
              fill={floorColour(f.id)}
            >
              <title>{f.id}</title>
            </rect>
          );
        })}
        {Array.from({ length: BOARD.width * BOARD.height }, (_, i) => {
          const x = i % BOARD.width;
          const y = Math.floor(i / BOARD.width);
          const k = key(x, y);
          const isBlocked = blockedSet.has(k);
          const isDoor = doorSet.has(k);
          const isReserved = reservedSet.has(k);
          return (
            <rect
              key={k}
              x={x * CELL}
              y={y * CELL}
              width={CELL}
              height={CELL}
              fill={isBlocked ? 'rgba(220,60,60,0.45)' : 'none'}
              stroke={isDoor ? '#f2c14e' : isReserved ? '#4cc9f0' : 'rgba(255,255,255,0.12)'}
              strokeWidth={isDoor || isReserved ? 3 : 1}
              data-testid={isBlocked ? `blocked-${k}` : undefined}
            />
          );
        })}
        {layout.props.map((p, i) => {
          const px = (p.x + BOARD.width / 2) * CELL;
          const py = (p.z + BOARD.height / 2) * CELL;
          const yaw = (p.rot % 8) * (Math.PI / 4);
          return (
            <g key={`p${i}`}>
              <circle cx={px} cy={py} r={7} fill="#e8e0c8" stroke="#222" strokeWidth={1.5}>
                <title>{p.id}</title>
              </circle>
              <line
                x1={px}
                y1={py}
                x2={px + Math.sin(yaw) * 11}
                y2={py + Math.cos(yaw) * 11}
                stroke="#222"
                strokeWidth={2}
              />
            </g>
          );
        })}
        {analysis.hasChest && (
          <text
            x={CHEST.x * CELL + CELL / 2}
            y={CHEST.y * CELL + CELL / 2 + 6}
            textAnchor="middle"
            fontSize={20}
          >
            🧰
          </text>
        )}
        {isBoss && (
          <text
            x={Math.floor(BOARD.width / 2) * CELL + CELL / 2}
            y={Math.floor(BOARD.height / 2) * CELL + CELL / 2 + 6}
            textAnchor="middle"
            fontSize={20}
          >
            👑
          </text>
        )}
      </svg>
      <p className="hint legend">
        <span style={{ color: '#f2c14e' }}>■</span> {t('dev.layout.legendDoor')}{' '}
        <span style={{ color: '#4cc9f0' }}>■</span> {t('dev.layout.legendReserved')}{' '}
        <span style={{ color: '#dc3c3c' }}>■</span> {t('dev.layout.legendBlocked')}
      </p>

      {analysis.errors.map((e, i) => (
        <p key={`e${i}`} className="issue error" data-testid="layout-error">
          {issueText(e)}
        </p>
      ))}
      {analysis.warnings.map((e, i) => (
        <p key={`w${i}`} className="issue warning">
          {issueText(e)}
        </p>
      ))}

      <div className="panel-row buttons">
        <button disabled={!writable} onClick={() => void persist(false)} data-testid="layout-save">
          {editingId ? t('dev.layout.update') : t('dev.layout.save')}
        </button>
        {editingId && (
          <button
            onClick={() => {
              setEditingId(null);
              setCustomName(null);
              setStatus(null);
            }}
            data-testid="layout-new"
          >
            {t('dev.layout.new')}
          </button>
        )}
        {editingId && (
          <button
            disabled={!writable}
            onClick={() => void persist(true)}
            data-testid="layout-save-new"
          >
            {t('dev.layout.saveNew')}
          </button>
        )}
      </div>
      {editingId && (
        <p className="hint">
          {t('dev.layout.editing', {
            name: saved.find((l) => l.id === editingId)?.name ?? editingId,
          })}
        </p>
      )}
      {status && (
        <p className="hint" data-testid="layout-status">
          {status}
        </p>
      )}

      <h4>{t('dev.layout.list', { n: forType.length })}</h4>
      {forType.length === 0 && <p className="hint">{t('dev.layout.empty')}</p>}
      <ul className="layout-list" data-testid="layout-list">
        {forType.map((l) => (
          <li key={l.id} className={l.id === editingId ? 'active' : ''}>
            <span>
              {l.name}
              <small>
                {' '}
                {l.doors === null
                  ? t('dev.layout.normal')
                  : presetLabel(
                      ROOM_PRESETS.find((p) => p.kind !== 'all' && sameDoors(l.doors, p.doors)) ??
                        ROOM_PRESETS[0] ?? { id: 'all', kind: 'all', doors: [] },
                    )}
              </small>
            </span>
            <button onClick={() => load(l)} data-testid={`layout-load-${l.id}`}>
              {t('dev.layout.load')}
            </button>
            <button onClick={() => void remove(l)} data-testid={`layout-delete-${l.id}`}>
              {t('dev.layout.delete')}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
