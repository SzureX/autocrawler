import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import {
  availableSkillPoints,
  backpackStacks,
  estimateThreat,
  legalPlacements,
  posKey,
  type RoomTile,
  type RunState,
} from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { reducedMotion } from '../view/motion';
import { clearBridge, peekBridge, setBridge } from './bridge';
import { useStageScale } from './Stage';
import { DragButton, parseDrag, parseDrop, upgradeDragId } from './dnd';
import { DungeonMap, MAP_HEIGHT, MAP_WIDTH, type MapHandle } from './DungeonMap';
import { InventoryPanel } from './InventoryPanel';
import { upgradeName } from './names';
import { SkillTreeScreen } from './SkillTreeScreen';
import { TileOfferPopup } from './TileOfferPopup';
import { TileView } from './TileView';

/** Time the chosen card punches before its room takes off. */
const PUNCH_MS = 350;
/** Pause after the map is fully shown again, before the next tile offer pops up. */
const INTRO_PAUSE_MS = 300;

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
  const offer = run.phase === 'TileOffer' || run.phase === 'BossOffer';
  const chooseTile = useGameStore((s) => s.chooseTile);
  const map = useRef<MapHandle | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const mounted = useRef(true);
  const [chosenUid, setChosenUid] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  // Coming back from a raid: the picture of the last room fades out over the map pulling back.
  const [bridge] = useState(peekBridge);
  useEffect(() => {
    clearBridge();
  }, []);
  const [intro, setIntro] = useState(bridge?.roomKey != null);
  const [bridgeShown, setBridgeShown] = useState(bridge !== null);
  const [starting, setStarting] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const skillPoints = availableSkillPoints(gameData, run);
  // A stale choice (from an earlier offer) is ignored.
  const chosen = chosenUid && run.tileOffer.some((t) => t.uid === chosenUid) ? chosenUid : null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Start: the camera flies into the first room, then the raid takes over from that picture. */
  const onStart = () => {
    const start = run.dungeon.startKey;
    if (!map.current || reducedMotion()) {
      startRaid();
      return;
    }
    setStarting(true);
    void map.current.flyToRoom(start).then(() => {
      setBridge(map.current?.snapshot() ?? null, start);
      startRaid();
    });
  };

  /** The card is punched, the room jumps out of it and flies to its place on the map. */
  const onChoose = (picked: RoomTile, card: HTMLElement) => {
    if (chosen) return;
    const spots = legalPlacements(gameData, run.dungeon, picked);
    const only = spots.length === 1 ? spots[0] : undefined;
    if (!only || !map.current || !frame.current || reducedMotion()) {
      chooseTile(picked.uid);
      return;
    }
    const f = frame.current.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const from = {
      x: (c.left + c.width / 2 - f.left) / scale,
      y: (c.top + c.height * 0.3 - f.top) / scale,
    };
    setChosenUid(picked.uid);
    setLeaving(false);
    window.setTimeout(() => {
      if (!mounted.current) return;
      setLeaving(true);
      void map.current?.fly(picked, posKey(only), from).then(() => {
        if (mounted.current) chooseTile(picked.uid);
      });
    }, PUNCH_MS);
  };
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
          <div
            ref={frame}
            className="map-frame"
            style={{
              width: MAP_WIDTH,
              height: MAP_HEIGHT,
              pointerEvents: starting || intro ? 'none' : undefined,
            }}
            data-testid="map-frame"
          >
            <DungeonMap
              run={run}
              tile={tile}
              handleRef={map}
              introRoom={bridge?.roomKey ?? null}
              onIntroDone={() => {
                // A short pause once the whole dungeon is in view, then the offer appears.
                window.setTimeout(() => {
                  if (mounted.current) setIntro(false);
                }, INTRO_PAUSE_MS);
              }}
              onPlace={(pos) => tile && placeTile(tile.uid, pos)}
              selectedUpgrade={selected}
              onRoomClick={(key) => {
                if (selected) {
                  assignUpgrade(key, selected);
                  setSelectedUpgrade(null);
                } else removeUpgrade(key);
              }}
            />
            {bridgeShown && bridge && (
              <img
                className="bridge-fade"
                src={bridge.image}
                alt=""
                onAnimationEnd={() => setBridgeShown(false)}
              />
            )}
            {offer && !intro && (
              <TileOfferPopup
                tiles={run.tileOffer}
                title={t(run.phase === 'BossOffer' ? 'ui.offer.bossTitle' : 'ui.offer.title')}
                chosen={chosen}
                leaving={leaving && chosen !== null}
                onChoose={onChoose}
              />
            )}
          </div>
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
            <button type="button" onClick={() => setSkillsOpen(true)} data-testid="skills-open">
              {t('ui.skills.open')}
              {skillPoints > 0 && (
                <span className="skills-badge" data-testid="skills-badge">
                  {skillPoints}
                </span>
              )}
            </button>
            <ThreatBadge run={run} />
            <button
              type="button"
              disabled={offer || run.hand.length > 0 || starting || intro}
              onClick={onStart}
              data-testid="start-raid"
            >
              {t('ui.prep.start')}
            </button>
            {run.hand.length > 0 && <p>{t('ui.prep.startBlocked')}</p>}
          </aside>
          <InventoryPanel run={run} />
        </div>
      </section>
      {skillsOpen && <SkillTreeScreen run={run} onClose={() => setSkillsOpen(false)} />}
    </DndContext>
  );
}
