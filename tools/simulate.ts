// Single-raid simulator: builds a random dungeon and prints the raid log.
// Usage: pnpm sim:raid -- --seed 123 --class warrior [--waves 5] [--artifacts 4] [--quiet]
import { loadGameData } from '@loch/data';
import { hashRaidLog, randomRaidReadyRun, simulateRaid, type RaidEvent } from '@loch/sim';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : fallback;
}

function describe(e: RaidEvent): string {
  switch (e.type) {
    case 'RaidStart':
      return `RaidStart hp=${e.heroMaxHp} level=${e.dungeonLevel} route=${e.route.join(' > ')}`;
    case 'RoomEnter':
      return `RoomEnter ${e.roomKey} ${e.roomTypeId}${e.transit ? ' (transit)' : ''} walk=${e.duration}${e.chest ? ' chest' : ''}`;
    case 'Spawn':
      return `Spawn #${e.unit} ${e.monsterId}${e.elite ? '*' : ''}${e.summoned ? ' (summoned)' : ''} hp=${e.maxHp} at ${e.x},${e.y}`;
    case 'Move':
      return `Move #${e.unit} ${e.from.x},${e.from.y} -> ${e.to.x},${e.to.y}`;
    case 'Attack':
      return `Attack #${e.unit} -> #${e.target} ${e.hit ? (e.crit ? 'CRIT' : 'hit') : 'miss'}`;
    case 'Damage':
      return `Damage #${e.unit} -${e.amount} (${e.kind}) hp=${e.hp}/${e.maxHp}`;
    case 'Heal':
      return `Heal #${e.unit} +${e.amount} (${e.source}) hp=${e.hp}/${e.maxHp}`;
    case 'Death':
      return `Death #${e.unit} killer=#${e.killer}`;
    case 'PhaseChange':
      return `PhaseChange #${e.unit} -> ${e.phase}`;
    case 'ChestOpen':
      return `ChestOpen ${e.cell.x},${e.cell.y}`;
    case 'RoomCleared':
      return `RoomCleared ${e.roomKey}`;
    case 'LootDropped':
      return `LootDropped ${JSON.stringify(e.item)}`;
    case 'RaidEnd':
      return `RaidEnd won=${e.won} reason=${e.reason}`;
  }
}

const data = loadGameData();
const seed = Number(arg('seed', '1'));
const classId = arg('class', 'warrior');
const waves = Number(arg('waves', '3'));
const artifacts = Number(arg('artifacts', String(waves)));
const quiet = process.argv.includes('--quiet');

const run = randomRaidReadyRun(data, seed, classId, waves, artifacts);
const result = simulateRaid(data, run);

if (!quiet) {
  for (const e of result.log) console.log(`[${String(e.tick).padStart(5)}] ${describe(e)}`);
}
console.log('---');
console.log(
  `seed=${seed} class=${classId} rooms=${result.roomsTotal} won=${result.won} reason=${result.reason} ` +
    `ticks=${result.ticks} (${(result.ticks / 20).toFixed(1)}s) kills=${result.kills} ` +
    `hp=${result.heroHp}/${result.heroMaxHp} events=${result.log.length} hash=${hashRaidLog(result.log)}`,
);
