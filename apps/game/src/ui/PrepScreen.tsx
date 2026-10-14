import { useState } from 'react';
import { legalPlacements, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { DungeonGrid } from './DungeonGrid';
import { InventoryPanel } from './InventoryPanel';
import { TileView } from './TileView';

export function PrepScreen({ run }: { run: RunState }) {
  const placeTile = useGameStore((s) => s.placeTile);
  const assignUpgrade = useGameStore((s) => s.assignUpgrade);
  const removeUpgrade = useGameStore((s) => s.removeUpgrade);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);
  const selected =
    selectedUpgrade && run.upgradeStorage.includes(selectedUpgrade) ? selectedUpgrade : null;
  const storage = Object.entries(
    run.upgradeStorage.reduce<Record<string, number>>(
      (acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }),
      {},
    ),
  );
  const tile = run.hand[0];
  const noSpot = tile ? legalPlacements(gameData, run.dungeon, tile).length === 0 : false;
  return (
    <section className="screen prep">
      <h2>{t('ui.prep.title')}</h2>
      <div className="prep-layout">
        <DungeonGrid
          run={run}
          tile={tile}
          onPlace={(pos) => tile && placeTile(tile.uid, pos)}
          selectedUpgrade={selected}
          onRoomClick={(key) => {
            if (selected) {
              assignUpgrade(key, selected);
              setSelectedUpgrade(null);
            } else removeUpgrade(key);
          }}
        />
        <aside className="side">
          <h3>{t('ui.prep.hand')}</h3>
          {tile ? <TileView tile={tile} /> : <p>{t('ui.prep.handEmpty')}</p>}
          {tile && <p>{noSpot ? t('ui.prep.noSpot') : t('ui.prep.placeHint')}</p>}
          <h3>{t('ui.upgrades.title')}</h3>
          {storage.length === 0 && <p className="hint">{t('ui.upgrades.empty')}</p>}
          <div className="stack-list" data-testid="upgrade-storage">
            {storage.map(([id, count]) => (
              <button
                key={id}
                type="button"
                className={`stack${selected === id ? ' selected' : ''}`}
                data-testid={`storage-${id}`}
                title={t(gameData.roomUpgrades[id]?.descKey ?? id)}
                onClick={() => setSelectedUpgrade(selected === id ? null : id)}
              >
                <span>
                  {gameData.roomUpgrades[id]?.icon} {t(gameData.roomUpgrades[id]?.nameKey ?? id)}
                </span>
                <small>×{count}</small>
              </button>
            ))}
          </div>
          <p className="hint">{t(selected ? 'ui.upgrades.assignHint' : 'ui.upgrades.pickHint')}</p>
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
