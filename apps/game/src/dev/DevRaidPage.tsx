import { useEffect, useRef, useState } from 'react';
import { randomRaidReadyRun, simulateRaid, hashRaidLog, type RaidResult } from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import type { PlaybackState } from '../view/playback';
import { RaidCanvas } from '../view/RaidCanvas';

/** DEV-only page (/dev/raid): simulates a raid and replays its log on the Three.js canvas. */
export function DevRaidPage() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<RaidCanvas | null>(null);
  const [seed, setSeed] = useState(1);
  const [classId, setClassId] = useState('warrior');
  const [waves, setWaves] = useState(3);
  const [artifacts, setArtifacts] = useState(3);
  const [speed, setSpeed] = useState(1);
  const [result, setResult] = useState<RaidResult | null>(null);
  const [hud, setHud] = useState<PlaybackState | null>(null);

  useEffect(() => {
    if (!host.current) return;
    const c = new RaidCanvas(host.current);
    canvas.current = c;
    void c.init().then(() => {
      c.onState(setHud);
    });
    return () => {
      c.destroy();
      canvas.current = null;
    };
  }, []);

  const simulate = () => {
    const run = randomRaidReadyRun(gameData, seed, classId, waves, artifacts);
    const r = simulateRaid(gameData, run);
    setResult(r);
    canvas.current?.setSpeed(speed);
    canvas.current?.load(r.log);
  };

  const changeSpeed = (s: number) => {
    setSpeed(s);
    canvas.current?.setSpeed(s);
  };

  return (
    <main className="app" data-testid="dev-raid">
      <h2>{t('dev.raid.title')}</h2>
      <div className="dev-controls">
        <label>
          {t('app.seed')}{' '}
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            data-testid="dev-seed"
          />
        </label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          data-testid="dev-class"
        >
          {Object.values(gameData.classes).map((c) => (
            <option key={c.id} value={c.id}>
              {t(c.nameKey)}
            </option>
          ))}
        </select>
        <label>
          {t('dev.raid.rooms')}{' '}
          <input
            type="number"
            min={0}
            max={11}
            value={waves}
            onChange={(e) => setWaves(Number(e.target.value))}
          />
        </label>
        <label>
          {t('dev.raid.artifacts')}{' '}
          <input
            type="number"
            min={0}
            max={9}
            value={artifacts}
            onChange={(e) => setArtifacts(Number(e.target.value))}
          />
        </label>
        <button onClick={simulate} data-testid="dev-simulate">
          {t('dev.raid.simulate')}
        </button>
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            className={speed === s ? 'active' : ''}
            onClick={() => changeSpeed(s)}
            data-testid={`speed-${s}`}
          >
            {s}×
          </button>
        ))}
        <button onClick={() => canvas.current?.skip()} data-testid="dev-skip">
          {t('dev.raid.skip')}
        </button>
      </div>
      <div ref={host} className="raid-canvas" data-testid="raid-canvas" />
      <div data-testid="raid-hud">
        {hud && (
          <span>
            HP {Math.round(hud.heroHp)}/{Math.round(hud.heroMaxHp)} ·{' '}
          </span>
        )}
        {hud && <span>{t('dev.raid.tick', { tick: Math.floor(hud.tick) })}</span>}
        {hud?.ended && (
          <strong data-testid="raid-outcome">
            {' '}
            · {hud.won ? t('dev.raid.won') : t('dev.raid.lost', { reason: hud.reason ?? '' })}
          </strong>
        )}
      </div>
      {result && (
        <div className="hint">
          {t('dev.raid.hash', { hash: hashRaidLog(result.log), events: result.log.length })}
        </div>
      )}
    </main>
  );
}
