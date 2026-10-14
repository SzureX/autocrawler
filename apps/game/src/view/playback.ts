import type { Cell, RaidEvent } from '@loch/sim';

export interface ViewUnit {
  id: number;
  monsterId: string;
  elite: boolean;
  boss: boolean;
  /** Fractional board position (interpolated while moving). */
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  /** Tick of the last hit received (drives hit flashes). */
  hitTick: number;
  /** Tick of the last attack made (drives attack lunges). */
  attackTick: number;
}

export interface Floater {
  id: number;
  unit: number;
  tick: number;
  text: string;
  kind: 'damage' | 'crit' | 'heal' | 'miss' | 'trap';
}

interface Mover {
  from: Cell;
  to: Cell;
  start: number;
  duration: number;
}

export interface PlaybackState {
  tick: number;
  roomKey: string | null;
  roomTypeId: string | null;
  upgradeId: string | null;
  units: ViewUnit[];
  floaters: Floater[];
  ended: boolean;
  won: boolean | null;
  reason: string | null;
  heroMaxHp: number;
  heroHp: number;
}

/**
 * Replays a raid log. It never computes combat: it only applies events in order and
 * interpolates movement between them. `advanceTo` only moves forward; `skipToEnd` finishes.
 */
export class RaidPlayback {
  readonly log: readonly RaidEvent[];
  private cursor = 0;
  private units: Record<number, ViewUnit> = {};
  private movers: Record<number, Mover> = {};
  private floaters: Floater[] = [];
  private floaterId = 0;
  private current = 0;
  private roomKey: string | null = null;
  private roomTypeId: string | null = null;
  private upgradeId: string | null = null;
  private ended = false;
  private won: boolean | null = null;
  private reason: string | null = null;
  private heroMaxHp = 0;
  readonly lastTick: number;

  constructor(log: readonly RaidEvent[]) {
    this.log = log;
    this.lastTick = log.length > 0 ? (log[log.length - 1]?.tick ?? 0) : 0;
  }

  get tick(): number {
    return this.current;
  }

  get done(): boolean {
    return this.ended;
  }

  /** Applies every event up to (and including) `tick`; fractional ticks interpolate movement. */
  advanceTo(tick: number): void {
    this.current = Math.max(this.current, tick);
    const whole = Math.floor(this.current);
    while (this.cursor < this.log.length) {
      const e = this.log[this.cursor];
      if (!e || e.tick > whole) break;
      this.apply(e);
      this.cursor++;
    }
    this.floaters = this.floaters.filter((f) => this.current - f.tick < 24);
    for (const [id, m] of Object.entries(this.movers)) {
      const u = this.units[Number(id)];
      if (!u) continue;
      const p =
        m.duration > 0 ? Math.min(1, Math.max(0, (this.current - m.start) / m.duration)) : 1;
      u.x = m.from.x + (m.to.x - m.from.x) * p;
      u.y = m.from.y + (m.to.y - m.from.y) * p;
    }
  }

  skipToEnd(): void {
    this.advanceTo(this.lastTick);
  }

  snapshot(): PlaybackState {
    return {
      tick: this.current,
      roomKey: this.roomKey,
      roomTypeId: this.roomTypeId,
      upgradeId: this.upgradeId,
      units: Object.values(this.units).filter((u) => u.alive),
      floaters: [...this.floaters],
      ended: this.ended,
      won: this.won,
      reason: this.reason,
      heroMaxHp: this.heroMaxHp,
      heroHp: this.units[0]?.hp ?? 0,
    };
  }

  private float(unit: number, tick: number, text: string, kind: Floater['kind']): void {
    this.floaters.push({ id: this.floaterId++, unit, tick, text, kind });
  }

  private apply(e: RaidEvent): void {
    switch (e.type) {
      case 'RaidStart':
        this.heroMaxHp = e.heroMaxHp;
        this.units[0] = {
          id: 0,
          monsterId: 'hero',
          elite: false,
          boss: false,
          x: 0,
          y: 0,
          hp: e.heroMaxHp,
          maxHp: e.heroMaxHp,
          alive: true,
          hitTick: -100,
          attackTick: -100,
        };
        break;
      case 'RoomEnter': {
        // A new room: drop every monster, put the hero on his entry cell.
        const hero = this.units[0];
        this.units = hero ? { 0: hero } : {};
        this.movers = {};
        this.floaters = [];
        if (hero) {
          hero.x = e.entry.x;
          hero.y = e.entry.y;
        }
        this.roomKey = e.roomKey;
        this.roomTypeId = e.roomTypeId;
        this.upgradeId = e.upgradeId;
        break;
      }
      case 'Spawn':
        this.units[e.unit] = {
          id: e.unit,
          monsterId: e.monsterId,
          elite: e.elite,
          boss: e.boss,
          x: e.x,
          y: e.y,
          hp: e.hp,
          maxHp: e.maxHp,
          alive: true,
          hitTick: -100,
          attackTick: -100,
        };
        break;
      case 'Move':
        this.movers[e.unit] = { from: e.from, to: e.to, start: e.tick, duration: e.duration };
        break;
      case 'Attack': {
        const u = this.units[e.unit];
        if (u) u.attackTick = e.tick;
        if (!e.hit) this.float(e.target, e.tick, 'miss', 'miss');
        break;
      }
      case 'Damage': {
        const u = this.units[e.unit];
        if (u) {
          u.hp = e.hp;
          u.hitTick = e.tick;
        }
        this.float(
          e.unit,
          e.tick,
          String(Math.round(e.amount)),
          e.crit ? 'crit' : e.kind === 'trap' ? 'trap' : 'damage',
        );
        break;
      }
      case 'Heal': {
        const u = this.units[e.unit];
        if (u) u.hp = e.hp;
        this.float(e.unit, e.tick, `+${Math.round(e.amount)}`, 'heal');
        break;
      }
      case 'Death': {
        const u = this.units[e.unit];
        if (u) u.alive = false;
        delete this.movers[e.unit];
        break;
      }
      case 'RaidEnd':
        this.ended = true;
        this.won = e.won;
        this.reason = e.reason;
        break;
      default:
        break;
    }
  }
}
