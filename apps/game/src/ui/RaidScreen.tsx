import { useEffect, useMemo, useRef, useState } from 'react';
import { simulateRaid, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import type { LogLine, PlaybackState } from '../view/playback';
import { RaidCanvas } from '../view/RaidCanvas';
import { artifactName, monsterName, roomTypeName, upgradeName } from './names';

function lineText(l: LogLine): string {
  switch (l.kind) {
    case 'room':
      return t('raid.log.room', { room: roomTypeName(l.roomTypeId) });
    case 'death':
      return t(l.boss ? 'raid.log.boss' : 'raid.log.death', { name: monsterName(l.monsterId) });
    case 'phase':
      return t('raid.log.phase', { name: monsterName(l.monsterId) });
    case 'cleared':
      return t('raid.log.cleared');
    case 'loot':
      return t('raid.log.loot', {
        name: l.item === 'artifact' ? artifactName(l.ref) : upgradeName(l.ref),
      });
    case 'heroDied':
      return t('raid.log.heroDied');
  }
}

/** Action phase: replays the (already simulated) raid on the Pixi canvas. */
export function RaidScreen({ run }: { run: RunState }) {
  const finishRaid = useGameStore((s) => s.finishRaid);
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<RaidCanvas | null>(null);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState<PlaybackState | null>(null);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  // The result is a pure function of the run state, so a reload mid-raid replays the same raid.
  const result = useMemo(() => simulateRaid(gameData, run), [run]);

  useEffect(() => {
    if (!host.current) return;
    const c = new RaidCanvas(host.current);
    canvas.current = c;
    void c.init().then(() => {
      c.onState(setHud);
      c.setSpeed(speedRef.current);
      c.load(result.log);
    });
    return () => {
      c.destroy();
      canvas.current = null;
    };
  }, [result]);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    canvas.current?.setSpeed(s);
  };
  const frac = hud && hud.heroMaxHp > 0 ? Math.max(0, hud.heroHp / hud.heroMaxHp) : 1;

  return (
    <section className="screen raid" data-testid="raid-screen">
      <div className="raid-layout">
        <div>
          <div ref={host} className="raid-canvas" data-testid="raid-canvas" />
          <div className="raid-hud" data-testid="raid-hud">
            <div className="hp-bar" aria-label={t('raid.hp')}>
              <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
              <span data-testid="raid-hp">
                {t('raid.hp')} {Math.round(hud?.heroHp ?? 0)}/{hud?.heroMaxHp ?? 0}
              </span>
            </div>
            <span data-testid="raid-room">
              {t('raid.room')}: {hud?.roomTypeId ? roomTypeName(hud.roomTypeId) : '-'}
              {hud?.upgradeId ? ` · ${upgradeName(hud.upgradeId)}` : ''}
            </span>
            <span className="raid-controls">
              {t('raid.speed')}:{' '}
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={speed === s ? 'active' : ''}
                  onClick={() => changeSpeed(s)}
                  data-testid={`speed-${s}`}
                >
                  {s}×
                </button>
              ))}
              <button
                type="button"
                onClick={() => canvas.current?.skip()}
                disabled={hud?.ended === true}
                data-testid="raid-skip"
              >
                {t('raid.skip')}
              </button>
            </span>
          </div>
        </div>
        <aside className="raid-side">
          <h3>{t('raid.running')}</h3>
          <ul className="event-log" data-testid="raid-log">
            {(hud?.lines ?? []).map((l) => (
              <li key={l.id}>{lineText(l)}</li>
            ))}
          </ul>
          {hud?.ended && (
            <div>
              <strong data-testid="raid-outcome">{t(hud.won ? 'raid.won' : 'raid.lost')}</strong>
              <div>
                <button type="button" onClick={finishRaid} data-testid="to-summary">
                  {t('raid.summary')}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
