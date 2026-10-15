import { useState } from 'react';
import { dungeonLevel } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { ClassSelectScreen } from './ClassSelectScreen';
import { EndScreen } from './EndScreen';
import { MainMenu } from './MainMenu';
import { PrepScreen } from './PrepScreen';
import { RaidScreen } from './RaidScreen';
import { ResolveScreen } from './ResolveScreen';
import { TileOfferScreen } from './TileOfferScreen';

export function App() {
  const run = useGameStore((s) => s.run);
  const [started, setStarted] = useState(false);
  // The menu shows first; it also yields when a run is created from elsewhere (debug overlay).
  const [firstRun] = useState(run);
  const resetRun = useGameStore((s) => s.resetRun);
  if (!started && run === firstRun) {
    return (
      <MainMenu
        canContinue={firstRun !== null}
        onContinue={() => setStarted(true)}
        onNewGame={() => {
          resetRun();
          setStarted(true);
        }}
      />
    );
  }
  return (
    <main className="app">
      <header className="hud">
        <h1>{t('app.title')}</h1>
        {run && (
          <span data-testid="hud">
            <span data-testid="hud-lives" aria-label={t('app.lives')}>
              {Array.from({ length: gameData.balance.startLives }, (_, i) => (
                <span key={i} className={i < run.lives ? 'life' : 'life lost'}>
                  ♥
                </span>
              ))}
            </span>{' '}
            ·{' '}
            <span data-testid="hud-wave">
              {t('app.wave', { wave: run.wavesWon, max: gameData.balance.wavesToBoss })}
            </span>{' '}
            · {t('app.dungeonLevel', { level: dungeonLevel(run) })}
          </span>
        )}
        <span data-testid="phase-label">
          {run ? t(`phase.${run.phase}`) : t('phase.ClassSelect')}
        </span>
      </header>
      {!run && <ClassSelectScreen />}
      {run && (run.phase === 'TileOffer' || run.phase === 'BossOffer') && (
        <TileOfferScreen run={run} />
      )}
      {run && run.phase === 'Prep' && <PrepScreen run={run} />}
      {run && run.phase === 'Action' && <RaidScreen run={run} />}
      {run && run.phase === 'Resolve' && <ResolveScreen run={run} />}
      {run && (run.phase === 'Victory' || run.phase === 'GameOver') && <EndScreen run={run} />}
    </main>
  );
}
