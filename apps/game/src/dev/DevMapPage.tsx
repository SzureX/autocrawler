import { useMemo, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import {
  chainTail,
  chooseTile,
  computeRaidRoute,
  createRng,
  createRun,
  generateBossOffer,
  generateTileOffer,
  legalPlacements,
  nextSlot,
  openExit,
  placeTile,
  posKey,
  type Pos,
  type RunState,
} from '@loch/sim';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import { DungeonGrid } from '../ui/DungeonGrid';
import { TileView } from '../ui/TileView';

const CLASS_ID = 'warrior';

/** After a tile is built: pretend the wave was won and offer the next tile (or the boss). */
function advance(run: RunState): RunState {
  const wavesWon = run.wavesWon + 1;
  if (Object.values(run.dungeon.rooms).some((r) => r.isBoss)) return run;
  if (wavesWon > gameData.balance.wavesToBoss) return run;
  if (wavesWon === gameData.balance.wavesToBoss) {
    return generateBossOffer(gameData, { ...run, wavesWon, phase: 'BossOffer' });
  }
  return generateTileOffer(gameData, { ...run, wavesWon, phase: 'TileOffer' });
}

/** DEV-only page (/dev/map): only the map-building phase, to check the chain rules by hand. */
export function DevMapPage() {
  const [seed, setSeed] = useState(1);
  const [run, setRun] = useState<RunState>(() => createRun(gameData, 1, CLASS_ID));
  const [autoPlace, setAutoPlace] = useState(true);

  const tile = run.hand[0];
  const done = Object.values(run.dungeon.rooms).some((r) => r.isBoss);
  const route = useMemo(() => computeRaidRoute(run.dungeon), [run.dungeon]);
  const slot = nextSlot(gameData, run.dungeon);
  const tail = chainTail(run.dungeon);

  const build = (state: RunState, pos: Pos): RunState => {
    const hand = state.hand[0];
    if (!hand) return state;
    return advance({ ...placeTile(gameData, { ...state, phase: 'Prep' }, hand.uid, pos) });
  };

  const pick = (uid: string) => {
    let next = chooseTile(run, uid);
    const hand = next.hand[0];
    if (autoPlace && hand) {
      const [spot] = legalPlacements(gameData, next.dungeon, hand);
      if (spot) next = build(next, spot);
    }
    setRun(next);
  };

  const reset = (s: number) => {
    setSeed(s);
    setRun(createRun(gameData, s, CLASS_ID));
  };

  const buildAll = () => {
    const rng = createRng(seed).fork('dev-map');
    let cur = run;
    for (
      let guard = 0;
      guard < 30 && !Object.values(cur.dungeon.rooms).some((r) => r.isBoss);
      guard++
    ) {
      if (cur.hand.length === 0) {
        if (cur.tileOffer.length === 0) break;
        cur = chooseTile(cur, rng.pick(cur.tileOffer).uid);
      }
      const hand = cur.hand[0];
      const [spot] = hand ? legalPlacements(gameData, cur.dungeon, hand) : [];
      if (!spot) break;
      cur = build(cur, spot);
    }
    setRun(cur);
  };

  return (
    <DndContext>
      <main className="app" data-testid="dev-map">
        <h2>{t('dev.map.title')}</h2>
        <div className="dev-controls">
          <label>
            {t('app.seed')}{' '}
            <input
              type="number"
              value={seed}
              onChange={(e) => reset(Number(e.target.value))}
              data-testid="map-seed"
            />
          </label>
          <button onClick={() => window.location.assign('../')} data-testid="map-back">
            {t('dev.map.back')}
          </button>
          <button onClick={() => reset(seed)} data-testid="map-reset">
            {t('dev.map.reset')}
          </button>
          <button onClick={() => reset(Math.floor(Math.random() * 1e6))} data-testid="map-random">
            {t('dev.map.randomSeed')}
          </button>
          <button onClick={buildAll} disabled={done} data-testid="map-build-all">
            {t('dev.map.buildAll')}
          </button>
          <label>
            <input
              type="checkbox"
              checked={autoPlace}
              onChange={(e) => setAutoPlace(e.target.checked)}
              data-testid="map-auto"
            />{' '}
            {t('dev.map.auto')}
          </label>
        </div>
        <div className="prep-layout">
          <DungeonGrid run={run} tile={tile} onPlace={(pos) => setRun(build(run, pos))} />
          <aside className="side">
            <p data-testid="map-info">
              {t('dev.map.info', {
                rooms: Object.keys(run.dungeon.rooms).length,
                wave: run.wavesWon,
                max: gameData.balance.wavesToBoss,
              })}
            </p>
            <p data-testid="map-slot">
              {done
                ? t('dev.map.done')
                : slot
                  ? t('dev.map.slot', {
                      from: tail ? posKey(tail.pos) : '-',
                      exit: openExit(run.dungeon) ?? '-',
                      cell: posKey(slot.cell),
                    })
                  : t('dev.map.noSlot')}
            </p>
            <h3>{t('ui.prep.hand')}</h3>
            {tile ? <TileView tile={tile} /> : <p>{t('ui.prep.handEmpty')}</p>}
            {run.tileOffer.length > 0 && (
              <>
                <h3>{t('ui.offer.title')}</h3>
                {run.tileOffer.map((offered) => (
                  <div key={offered.uid}>
                    <TileView tile={offered} />
                    <button
                      onClick={() => pick(offered.uid)}
                      data-testid={`map-take-${offered.uid}`}
                    >
                      {t('ui.offer.take')}
                    </button>
                  </div>
                ))}
              </>
            )}
            <h3>{t('dev.map.route')}</h3>
            <p data-testid="map-route">{route.stops.join(' → ')}</p>
          </aside>
        </div>
      </main>
    </DndContext>
  );
}
