import type { Dir, RoomTile } from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { summarizeSpawns } from './spawnSummary';

const DIR_ORDER: Dir[] = ['N', 'E', 'S', 'W'];

export function monsterInfo(monsterId: string): { icon: string; nameKey: string } {
  const m = gameData.monsters[monsterId] ?? gameData.bosses[monsterId];
  return { icon: m?.icon ?? '?', nameKey: m?.nameKey ?? monsterId };
}

/** Compact door indicator: a square with a coloured edge for every open door. */
export function DoorIcon({ doors }: { doors: readonly Dir[] }) {
  return (
    <span className="door-icon" aria-label={doors.map((d) => t(`dir.${d}`)).join(' ')}>
      {DIR_ORDER.map((d) => (
        <i key={d} className={`door door-${d}${doors.includes(d) ? ' open' : ''}`} />
      ))}
    </span>
  );
}

export function SpawnList({ tile }: { tile: RoomTile }) {
  if (tile.isBoss) {
    const boss = tile.bossId ? monsterInfo(tile.bossId) : null;
    return <span>{boss ? `${boss.icon} ${t(boss.nameKey)}` : ''}</span>;
  }
  const groups = summarizeSpawns(tile.spawns);
  if (groups.length === 0) return <span>{t('ui.tile.empty')}</span>;
  return (
    <span className="spawn-list">
      {groups.map((g) => {
        const info = monsterInfo(g.monsterId);
        return (
          <span key={`${g.monsterId}-${g.elite}`} className="spawn-chip" title={t(info.nameKey)}>
            {info.icon}×{g.count}
            {g.elite ? ` (${t('ui.tile.elite')})` : ''}
          </span>
        );
      })}
    </span>
  );
}

/** Full description of a tile: room type, doors and monster composition. */
export function TileView({ tile }: { tile: RoomTile }) {
  const type = gameData.roomTypes[tile.roomTypeId];
  return (
    <div className="tile-view" data-testid={`tile-${tile.uid}`}>
      <div className="tile-title">
        {type?.icon} {t(type?.nameKey ?? tile.roomTypeId)}
      </div>
      <div className="tile-desc">{type ? t(type.descKey) : ''}</div>
      <div>
        {t('ui.tile.doors')}: <DoorIcon doors={tile.doors} />
      </div>
      <div>
        {t('ui.tile.monsters')}: <SpawnList tile={tile} />
      </div>
    </div>
  );
}
