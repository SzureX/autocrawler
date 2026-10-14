import { Application, Container, Graphics, Text } from 'pixi.js';
import type { RaidEvent } from '@loch/sim';
import { gameData } from '../store/gameStore';
import { RaidPlayback, type PlaybackState } from './playback';

const CELL = 96;
const TICK_RATE = 20;

const COLORS = {
  bg: 0x14161c,
  floor: 0x232836,
  floorAlt: 0x20242f,
  grid: 0x2e3445,
  door: 0xf2c14e,
  hero: 0x4caf70,
  monster: 0xc75c5c,
  elite: 0xe08a3c,
  boss: 0x9a4cc7,
  hpBack: 0x3a1f1f,
  hpFill: 0x5fd38a,
  hpLow: 0xe05252,
};

const FLOATER_COLORS: Record<string, number> = {
  damage: 0xffffff,
  crit: 0xffd24a,
  heal: 0x5fd38a,
  miss: 0x9aa6bf,
  trap: 0xff9a4a,
  loot: 0xffffff,
};

function icon(monsterId: string): string {
  if (monsterId === 'hero') return '🧙';
  return gameData.monsters[monsterId]?.icon ?? gameData.bosses[monsterId]?.icon ?? '?';
}

/** Pixi view that replays a raid log. All combat numbers come from the log. */
export class RaidCanvas {
  private app = new Application();
  private ready = false;
  private destroyed = false;
  private gfx = new Graphics();
  private labels = new Container();
  private labelPool: Record<string, Text> = {};
  private playback: RaidPlayback | null = null;
  private speed = 1;
  private paused = false;
  private listeners: ((s: PlaybackState) => void)[] = [];

  constructor(private readonly host: HTMLElement) {}

  async init(): Promise<void> {
    const { width, height } = gameData.balance.combat.board;
    await this.app.init({
      width: width * CELL,
      height: height * CELL,
      background: COLORS.bg,
      antialias: true,
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.gfx);
    this.app.stage.addChild(this.labels);
    this.app.ticker.add((ticker) => this.frame(ticker.deltaMS));
    this.ready = true;
    this.draw();
  }

  load(log: readonly RaidEvent[]): void {
    this.playback = new RaidPlayback(log);
    this.paused = false;
    this.playback.advanceTo(0);
    this.draw();
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  skip(): void {
    this.playback?.skipToEnd();
    this.draw();
    this.emit();
  }

  onState(cb: (s: PlaybackState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners = [];
    if (this.ready) this.app.destroy(true, { children: true });
  }

  private emit(): void {
    if (!this.playback) return;
    const s = this.playback.snapshot();
    for (const l of this.listeners) l(s);
  }

  private frame(deltaMs: number): void {
    const pb = this.playback;
    if (!pb || this.paused || pb.done) return;
    pb.advanceTo(pb.tick + (deltaMs / 1000) * TICK_RATE * this.speed);
    this.draw();
    this.emit();
  }

  private label(key: string, text: string, size: number): Text {
    let t = this.labelPool[key];
    if (!t) {
      t = new Text({ text, style: { fontSize: size, fill: 0xffffff, fontFamily: 'sans-serif' } });
      t.anchor.set(0.5);
      this.labelPool[key] = t;
      this.labels.addChild(t);
    }
    if (t.text !== text) t.text = text;
    t.visible = true;
    return t;
  }

  private draw(): void {
    if (!this.ready) return;
    const { width, height } = gameData.balance.combat.board;
    const g = this.gfx;
    g.clear();
    for (const t of Object.values(this.labelPool)) t.visible = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        g.rect(x * CELL, y * CELL, CELL, CELL).fill(
          (x + y) % 2 === 0 ? COLORS.floor : COLORS.floorAlt,
        );
      }
    }
    g.rect(0, 0, width * CELL, height * CELL).stroke({ width: 2, color: COLORS.grid });
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    for (const [x, y] of [
      [cx, 0],
      [cx, height - 1],
      [0, cy],
      [width - 1, cy],
    ] as const) {
      g.rect(x * CELL + 4, y * CELL + 4, CELL - 8, CELL - 8).stroke({
        width: 2,
        color: COLORS.door,
      });
    }

    const state = this.playback?.snapshot();
    if (!state) return;
    for (const u of state.units) {
      const px = u.x * CELL + CELL / 2;
      const py = u.y * CELL + CELL / 2;
      const color =
        u.id === 0 ? COLORS.hero : u.boss ? COLORS.boss : u.elite ? COLORS.elite : COLORS.monster;
      const flash = state.tick - u.hitTick < 3;
      const radius = (u.boss ? 0.42 : 0.32) * CELL;
      g.circle(px, py, radius).fill(flash ? 0xffffff : color);
      const barW = CELL * 0.7;
      const frac = Math.max(0, u.hp / u.maxHp);
      g.rect(px - barW / 2, py - radius - 10, barW, 5).fill(COLORS.hpBack);
      g.rect(px - barW / 2, py - radius - 10, barW * frac, 5).fill(
        frac < 0.3 ? COLORS.hpLow : COLORS.hpFill,
      );
      this.label(`u${u.id}`, icon(u.monsterId), u.boss ? 48 : 34).position.set(px, py);
    }
    for (const f of state.floaters) {
      const age = state.tick - f.tick;
      const t = this.label(`f${f.id}`, f.text, f.kind === 'crit' ? 30 : 22);
      t.style.fill = FLOATER_COLORS[f.kind] ?? 0xffffff;
      t.alpha = Math.max(0, 1 - age / 24);
      t.position.set(f.x * CELL + CELL / 2, f.y * CELL - age * 1.2);
    }
  }
}
