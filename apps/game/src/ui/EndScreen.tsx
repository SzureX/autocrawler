import type { RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';

/** Victory / GameOver: run statistics and "new run". */
export function EndScreen({ run }: { run: RunState }) {
  const resetRun = useGameStore((s) => s.resetRun);
  const victory = run.phase === 'Victory';
  return (
    <section className="screen" data-testid="end-screen" data-outcome={run.phase}>
      <h2 data-testid="end-title">{t(victory ? 'end.victory' : 'end.gameOver')}</h2>
      <h3>{t('end.stats')}</h3>
      <ul>
        <li>{t('end.waves', { n: run.wavesWon, max: gameData.balance.wavesToBoss })}</li>
        <li>{t('end.raids', { n: run.stats.raids })}</li>
        <li>{t('end.wins', { n: run.stats.wins })}</li>
        <li>{t('end.losses', { n: run.stats.losses })}</li>
        <li>{t('end.merges', { n: run.stats.merges })}</li>
        <li>{t('end.artifacts', { n: run.stats.artifactsFound })}</li>
      </ul>
      <button type="button" onClick={resetRun} data-testid="new-run">
        {t('end.newRun')}
      </button>
    </section>
  );
}
