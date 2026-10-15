import { useEffect, useMemo, useRef, useState } from 'react';
import { hasBossRoom, simulateRaid, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { reducedMotion } from '../view/motion';
import type { LogLine, PlaybackState } from '../view/playback';
import { RaidCanvas } from '../view/RaidCanvas';
import { clearBridge, peekBridge, setBridge } from './bridge';
import { artifactName, monsterName, roomTypeName, upgradeName } from './names';

/** How long the "Fala x/10" popup stays before the raid starts moving. */
const WAVE_POPUP_MS = 1000;

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

/** Action phase: replays the (already simulated) raid on the Three.js canvas. */
export function RaidScreen({ run }: { run: RunState }) {
  const finishRaid = useGameStore((s) => s.finishRaid);
  const continueRun = useGameStore((s) => s.continueRun);
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<RaidCanvas | null>(null);
  const [speed, setSpeed] = useState(1);
  const [hud, setHud] = useState<PlaybackState | null>(null);
  // Coming from the map: its last picture fades out over the first frame of the raid.
  const [bridge] = useState(peekBridge);
  const [bridgeShown, setBridgeShown] = useState(bridge !== null);
  const [wave, setWave] = useState(false);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    clearBridge();
  }, []);
  // The result is a pure function of the run state, so a reload mid-raid replays the same raid.
  const result = useMemo(() => simulateRaid(gameData, run), [run]);

  useEffect(() => {
    if (!host.current) return;
    const c = new RaidCanvas(host.current);
    canvas.current = c;
    let timer: number | undefined;
    void c.init().then(() => {
      c.onState(setHud);
      c.setSpeed(speedRef.current);
      c.load(result.log);
      if (!reducedMotion()) {
        // The raid waits, with the hero outside the door, while the wave popup shows.
        c.setPaused(true);
        setWave(true);
        timer = window.setTimeout(() => {
          c.setPaused(false);
          setWave(false);
        }, WAVE_POPUP_MS);
      }
    });
    return () => {
      window.clearTimeout(timer);
      c.destroy();
      canvas.current = null;
    };
  }, [result]);

  const changeSpeed = (s: number) => {
    setSpeed(s);
    canvas.current?.setSpeed(s);
  };

  /** Applies the result and goes on; the next screen blends in from a picture of this room. */
  const onContinue = () => {
    const picture = reducedMotion() ? null : (canvas.current?.snapshot() ?? null);
    setBridge(picture, canvas.current?.currentRoomKey() ?? null);
    finishRaid();
    continueRun();
  };

  const frac = hud && hud.heroMaxHp > 0 ? Math.max(0, hud.heroHp / hud.heroMaxHp) : 1;
  const ended = hud?.ended === true;
  const won = hud?.won === true;
  const waveText = hasBossRoom(run)
    ? t('raid.waveBoss')
    : t('raid.wave', { wave: run.wavesWon + 1, max: gameData.balance.wavesToBoss });
  const lootNames = [
    ...result.lootArtifacts.map(
      (a) => `${artifactName(a.artifactId)} (${t('ui.inv.level', { level: a.level })})`,
    ),
    ...result.lootUpgrades.map((u) => upgradeName(u)),
  ];

  return (
    <section className="screen raid" data-testid="raid-screen">
      <div className="raid-layout">
        <div>
          <div className="raid-stage">
            <div ref={host} className="raid-canvas" data-testid="raid-canvas" />
            {bridgeShown && bridge && (
              <img
                className="bridge-fade raid-bridge"
                src={bridge.image}
                alt=""
                onAnimationEnd={() => setBridgeShown(false)}
              />
            )}
            {wave && (
              <div className="wave-popup" data-testid="wave-popup">
                {waveText}
              </div>
            )}
            {ended && (
              <div className="summary-popup" data-testid="raid-summary">
                <h2 data-testid="raid-outcome">
                  {t(won ? 'resolve.title.won' : 'resolve.title.lost')}
                </h2>
                <p>{t(won ? 'raid.won' : 'raid.lost')}</p>
                <p data-testid="summary-gold">{t('raid.gold', { gold: 'xxx' })}</p>
                {lootNames.length > 0 && (
                  <ul data-testid="summary-loot">
                    {lootNames.map((name, i) => (
                      <li key={`${name}-${i}`}>{name}</li>
                    ))}
                  </ul>
                )}
                {!won && <p>{t('resolve.lifeLost', { n: 1 })}</p>}
                <button type="button" onClick={onContinue} data-testid="summary-continue">
                  {t('resolve.continue')}
                </button>
              </div>
            )}
          </div>
          <div className="raid-hud" data-testid="raid-hud">
            <div className="hp-bar" aria-label={t('raid.hp')}>
              <div className="hp-fill" style={{ width: `${frac * 100}%` }} />
              <span data-testid="raid-hp">
                {t('raid.hp')} {Math.round(hud?.heroHp ?? 0)}/{Math.round(hud?.heroMaxHp ?? 0)}
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
                disabled={ended || wave}
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
        </aside>
      </div>
    </section>
  );
}
