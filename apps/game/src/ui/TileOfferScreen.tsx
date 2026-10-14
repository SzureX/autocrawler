import type { RunState } from '@loch/sim';
import { t } from '../i18n';
import { useGameStore } from '../store/gameStore';
import { TileView } from './TileView';

export function TileOfferScreen({ run }: { run: RunState }) {
  const chooseTile = useGameStore((s) => s.chooseTile);
  return (
    <section className="screen">
      <h2>{t(run.phase === 'BossOffer' ? 'ui.offer.bossTitle' : 'ui.offer.title')}</h2>
      <div className="card-row">
        {run.tileOffer.map((tile) => (
          <article key={tile.uid} className="card">
            <TileView tile={tile} />
            <button onClick={() => chooseTile(tile.uid)} data-testid={`take-${tile.uid}`}>
              {t('ui.offer.take')}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
