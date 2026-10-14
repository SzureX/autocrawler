import { legalPlacements, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { DungeonGrid } from './DungeonGrid';
import { InventoryPanel } from './InventoryPanel';
import { TileView } from './TileView';

export function PrepScreen({ run }: { run: RunState }) {
  const placeTile = useGameStore((s) => s.placeTile);
  const tile = run.hand[0];
  const noSpot = tile ? legalPlacements(gameData, run.dungeon, tile).length === 0 : false;
  return (
    <section className="screen prep">
      <h2>{t('ui.prep.title')}</h2>
      <div className="prep-layout">
        <DungeonGrid run={run} tile={tile} onPlace={(pos) => tile && placeTile(tile.uid, pos)} />
        <aside className="side">
          <h3>{t('ui.prep.hand')}</h3>
          {tile ? <TileView tile={tile} /> : <p>{t('ui.prep.handEmpty')}</p>}
          {tile && <p>{noSpot ? t('ui.prep.noSpot') : t('ui.prep.placeHint')}</p>}
          <button disabled={run.hand.length > 0} data-testid="start-raid">
            {t('ui.prep.start')}
          </button>
          {run.hand.length > 0 && <p>{t('ui.prep.startBlocked')}</p>}
        </aside>
        <InventoryPanel run={run} />
      </div>
    </section>
  );
}
