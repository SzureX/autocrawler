import { useMemo, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { backpackStacks, estimateThreat, legalPlacements, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { useStageScale } from './Stage';
import { DragButton, parseDrag, parseDrop, upgradeDragId } from './dnd';
import { DungeonGrid } from './DungeonGrid';
import { InventoryPanel } from './InventoryPanel';
import { upgradeName } from './names';
import { TileView } from './TileView';

function ThreatBadge({ run }: { run: RunState }) {
  const threat = useMemo(() => estimateThreat(gameData, run), [run]);
  return (
    <p data-testid="threat" data-level={threat.level}>
      {t('ui.threat.label')}:{' '}
      <span
        className={`threat threat-${threat.level}`}
        title={t('ui.threat.detail', { ratio: Math.round(threat.ratio * 100) })}
      >
        {t(`ui.threat.${threat.level}`)}
      </span>
    </p>
  );
}

export function PrepScreen({ run }: { run: RunState }) {
  const placeTile = useGameStore((s) => s.placeTile);
  const assignUpgrade = useGameStore((s) => s.assignUpgrade);
  const removeUpgrade = useGameStore((s) => s.removeUpgrade);
  const equipArtifact = useGameStore((s) => s.equipArtifact);
  const startRaid = useGameStore((s) => s.startRaid);
  const discardTile = useGameStore((s) => s.discardTile);
  const [selectedUpgrade, setSelectedUpgrade] = useState<string | null>(null);
  const scale = useStageScale();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const tile = run.hand[0];
  const noSpot = tile ? legalPlacements(gameData, run.dungeon, tile).length === 0 : false;
  const selected =
    selectedUpgrade && run.upgradeStorage.includes(selectedUpgrade) ? selectedUpgrade : null;
  const storage = Object.entries(
    run.upgradeStorage.reduce<Record<string, number>>(
      (acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }),
      {},
    ),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const from = parseDrag(String(e.active.id));
    const to = parseDrop(String(e.over.id));
    if (!from || !to) return;
    if (from.kind === 'stack' && to.kind === 'slot') {
      const stack = backpackStacks(run).find(
        (s) => s.artifactId === from.artifactId && s.level === from.level,
      );
      const uid = stack?.uids[0];
      if (uid) equipArtifact(uid, to.slot);
    } else if (from.kind === 'upgrade' && to.kind === 'room') {
      assignUpgrade(to.roomKey, from.upgradeId);
      setSelectedUpgrade(null);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={onDragEnd}
      modifiers={[
        ({ transform }) => ({ ...transform, x: transform.x / scale, y: transform.y / scale }),
      ]}
    >
      <section className="screen prep" data-testid="prep-screen">
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
            {tile && noSpot && !tile.isBoss && (
              <button type="button" onClick={discardTile} data-testid="discard-tile">
                {t('ui.prep.discard')}
              </button>
            )}
            <h3>{t('ui.upgrades.title')}</h3>
            {storage.length === 0 && <p className="hint">{t('ui.upgrades.empty')}</p>}
            <div className="stack-list" data-testid="upgrade-storage">
              {storage.map(([id, count]) => (
                <DragButton
                  key={id}
                  dragId={upgradeDragId(id)}
                  type="button"
                  className={`stack${selected === id ? ' selected' : ''}`}
                  data-testid={`storage-${id}`}
                  title={t(gameData.roomUpgrades[id]?.descKey ?? id)}
                  onClick={() => setSelectedUpgrade(selected === id ? null : id)}
                >
                  <span>
                    {gameData.roomUpgrades[id]?.icon} {upgradeName(id)}
                  </span>
                  <small>×{count}</small>
                </DragButton>
              ))}
            </div>
            <p className="hint">
              {t(selected ? 'ui.upgrades.assignHint' : 'ui.upgrades.pickHint')}
            </p>
            <ThreatBadge run={run} />
            <button
              type="button"
              disabled={run.hand.length > 0}
              onClick={startRaid}
              data-testid="start-raid"
            >
              {t('ui.prep.start')}
            </button>
            {run.hand.length > 0 && <p>{t('ui.prep.startBlocked')}</p>}
          </aside>
          <InventoryPanel run={run} />
        </div>
      </section>
    </DndContext>
  );
}
