import { t } from '../i18n';
import { dungeonLevel } from '@loch/sim';
import { gameData, useGameStore } from '../store/gameStore';
import { ClassSelectScreen } from './ClassSelectScreen';
import { PrepScreen } from './PrepScreen';
import { TileOfferScreen } from './TileOfferScreen';

export function App() {
  const run = useGameStore((s) => s.run);
  return (
    <main className="app">
      <header className="hud">
        <h1>{t('app.title')}</h1>
        {run && (
          <span data-testid="hud">
            {t('app.lives')}: {'♥'.repeat(run.lives)} ·{' '}
            {t('app.wave', { wave: run.wavesWon, max: gameData.balance.wavesToBoss })} ·{' '}
            {t('app.dungeonLevel', { level: dungeonLevel(run) })}
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
      {run && !['TileOffer', 'BossOffer', 'Prep'].includes(run.phase) && (
        <p>{t('app.placeholder')}</p>
      )}
    </main>
  );
}
