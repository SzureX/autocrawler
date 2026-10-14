import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';

const STAT_ORDER = ['maxHp', 'atk', 'aspd', 'def', 'moveSpeed', 'critChance', 'range'] as const;

export function ClassSelectScreen() {
  const startRun = useGameStore((s) => s.startRun);
  return (
    <section className="screen">
      <h2>{t('ui.classSelect.title')}</h2>
      <div className="card-row">
        {Object.values(gameData.classes).map((c) => (
          <article key={c.id} className="card" data-testid={`class-${c.id}`}>
            <h3>{t(c.nameKey)}</h3>
            <p>{t(c.descKey)}</p>
            <p>{t(c.traitKey)}</p>
            <ul>
              {STAT_ORDER.map((k) => (
                <li key={k}>
                  {t(`ui.stat.${k}`)}:{' '}
                  {k === 'critChance' ? `${Math.round(c.stats[k] * 100)}%` : c.stats[k]}
                </li>
              ))}
            </ul>
            <button onClick={() => startRun(c.id)}>{t('ui.classSelect.pick')}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
