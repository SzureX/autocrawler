import type { RunState } from '@loch/sim';
import { t } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { artifactName, upgradeName } from './names';

/** Resolve phase: result of the raid, loot and lost life. */
export function ResolveScreen({ run }: { run: RunState }) {
  const continueRun = useGameStore((s) => s.continueRun);
  const raid = run.lastRaid;
  if (!raid) return null;
  const empty = raid.lootArtifacts.length === 0 && raid.lootUpgrades.length === 0;
  return (
    <section className="screen" data-testid="resolve-screen">
      <h2 data-testid="resolve-title">
        {t(raid.won ? 'resolve.title.won' : 'resolve.title.lost')}
      </h2>
      <p>{t(`resolve.reason.${raid.reason}`)}</p>
      <p>{t('resolve.rooms', { n: raid.roomsCleared })}</p>
      <h3>{t('resolve.loot')}</h3>
      {empty && <p className="hint">{t('resolve.lootNone')}</p>}
      <ul data-testid="resolve-loot">
        {raid.lootArtifacts.map((a) => (
          <li key={a.uid}>
            {artifactName(a.artifactId)} ({t('ui.inv.level', { level: a.level })})
          </li>
        ))}
        {raid.lootUpgrades.map((u, i) => (
          <li key={`${u}-${i}`}>{upgradeName(u)}</li>
        ))}
      </ul>
      {raid.livesLost > 0 && <p>{t('resolve.lifeLost', { n: raid.livesLost })}</p>}
      <p>{t('resolve.lives', { n: run.lives })}</p>
      <button type="button" onClick={continueRun} data-testid="resolve-continue">
        {t('resolve.continue')}
      </button>
    </section>
  );
}
