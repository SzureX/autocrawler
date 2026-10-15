import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../i18n';
import { gameData } from '../store/gameStore';
import {
  BUILDER_ASSETS,
  PROP_ASSETS,
  assetKey,
  propCategory,
  type AssetEntry,
} from '../view/builderCatalog';
import { LayoutPanel } from './LayoutPanel';
import { RoomBuilderCanvas, type BuilderAction, type BuilderTool } from '../view/RoomBuilderCanvas';
import {
  defaultLayout,
  emptyLayout,
  placeFloor,
  placeProp,
  removeFloorAt,
  removePropNear,
  ROOM_PRESETS,
  type Side,
  type RoomLayout,
} from '../view/roomBuilder';

const BOARD = gameData.balance.combat.board;

const START_TOOL: BuilderTool = { layer: 'floor', pieceId: 'tile_small', rot: 0, pool: null };
const ALL_SIZES = 'all';
const NO_DOORS: Side[] = [];

/** Applies one click to a layout; null when it does not fit (nothing changes). */
function applyAction(
  layout: RoomLayout,
  a: BuilderAction,
  catalog: RoomBuilderCanvas['catalog'],
): RoomLayout | null {
  const at = a.target;
  if (at.type === 'floor') return placeFloor(layout, at.piece, BOARD, catalog);
  if (at.type === 'floorCell') return removeFloorAt(layout, at, catalog);
  if (at.type === 'prop') return placeProp(layout, at.piece, BOARD);
  return removePropNear(layout, at);
}

/**
 * DEV-only room builder: lay out floors and props. The walls and doors are generated from the
 * chosen room, so only the doors that room really has are drawn (the preview shows all four).
 */
export function DevRoomBuilder({ onClose }: { onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<RoomBuilderCanvas | null>(null);
  // The canvas callbacks outlive renders, so they read the latest state through these refs.
  const layoutRef = useRef<RoomLayout | null>(null);
  const toolRef = useRef<BuilderTool>(START_TOOL);
  const [layout, setLayoutState] = useState<RoomLayout>(() => defaultLayout(BOARD));
  const [presetId, setPresetId] = useState('all');
  const [tool, setToolState] = useState<BuilderTool>(START_TOOL);
  const [topDown, setTopDown] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [sizeFilter, setSizeFilter] = useState(ALL_SIZES);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propFilter, setPropFilter] = useState(ALL_SIZES);
  const propsPromise = useRef<Promise<void> | null>(null);
  const [modelsVersion, setModelsVersion] = useState(0);
  // Measures models for the layout panel (the canvas owns them; it exists after the first render).
  const provider = useMemo(
    () => ({
      bounds: (key: string) =>
        canvas.current?.bounds(key) ?? {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
        },
      floorSize: (id: string) => canvas.current?.catalog.floorSize(id) ?? { w: 1, h: 1 },
    }),
    [],
  );

  useEffect(() => {
    layoutRef.current = layout;
    canvas.current?.setLayout(layout);
  }, [layout]);

  useEffect(() => {
    toolRef.current = tool;
    canvas.current?.setTool(tool);
  }, [tool]);

  // The walls and doorways follow the chosen room.
  const doors = (ROOM_PRESETS.find((p) => p.id === presetId) ?? ROOM_PRESETS[0])?.doors ?? NO_DOORS;
  const doorsRef = useRef(doors);
  useEffect(() => {
    doorsRef.current = doors;
    canvas.current?.setDoors(doors);
  }, [doors]);

  useEffect(() => {
    if (!host.current) return;
    const c = new RoomBuilderCanvas(host.current, BOARD);
    canvas.current = c;
    c.onAction((a) => {
      const next = layoutRef.current ? applyAction(layoutRef.current, a, c.catalog) : null;
      if (next) setLayoutState(next);
    });
    void c.init().then(() => {
      if (canvas.current !== c) return;
      if (layoutRef.current) c.setLayout(layoutRef.current);
      c.setDoors(doorsRef.current);
      c.setTool(toolRef.current);
      setThumbs(c.thumbnails());
      setModelsVersion((v) => v + 1);
      const measured: Record<string, string> = {};
      for (const e of BUILDER_ASSETS) {
        if (e.group !== 'floor') continue;
        const size = c.catalog.floorSize(e.id);
        measured[e.id] = `${size.w}×${size.h}`;
      }
      setSizes(measured);
    });
    return () => {
      c.destroy();
      canvas.current = null;
    };
  }, []);

  const commit = (next: RoomLayout) => setLayoutState(next);
  const choose = (next: BuilderTool) => setToolState(next);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        setToolState((cur) => ({ ...cur, rot: (cur.rot + 1) % (cur.layer === 'prop' ? 8 : 4) }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const rotate = () =>
    setToolState((cur) => ({ ...cur, rot: (cur.rot + 1) % (cur.layer === 'prop' ? 8 : 4) }));

  /** Loads the prop models once (many files); resolves when the thumbnails and sizes are ready. */
  const ensureProps = (): Promise<void> => {
    const c = canvas.current;
    if (!c) return Promise.resolve();
    if (!propsPromise.current) {
      setPropsLoading(true);
      propsPromise.current = c.loadProps().then((loaded) => {
        if (canvas.current !== c) return;
        setThumbs((cur) => ({ ...cur, ...loaded }));
        setPropsLoading(false);
        setModelsVersion((v) => v + 1);
      });
    }
    return propsPromise.current;
  };

  const openProps = () => {
    const first = PROP_ASSETS[0];
    choose({ layer: 'prop', pieceId: first?.id ?? null, rot: 0, pool: null });
    void ensureProps();
  };

  const pool = tool.pool;
  const toggleInPool = (id: string) => {
    if (!pool) return;
    choose({ ...tool, pool: pool.includes(id) ? pool.filter((x) => x !== id) : [...pool, id] });
  };
  const pieceButton = (entry: AssetEntry) => (
    <button
      key={entry.id}
      className={(pool ? pool.includes(entry.id) : tool.pieceId === entry.id) ? 'active' : ''}
      onClick={() => (pool ? toggleInPool(entry.id) : choose({ ...tool, pieceId: entry.id }))}
      data-testid={`piece-${entry.id}`}
    >
      {thumbs[assetKey(entry)] && (
        <img src={thumbs[assetKey(entry)]} alt="" width={64} height={64} />
      )}
      <span>{entry.id}</span>
    </button>
  );

  const sizeOptions = [...new Set(Object.values(sizes))].sort((a, b) => {
    const area = (v: string) => v.split('×').reduce((acc, n) => acc * Number(n), 1);
    return area(a) - area(b) || a.localeCompare(b);
  });
  const propCategories = [...new Set(PROP_ASSETS.map((e) => propCategory(e.id)))];
  const visibleProps = PROP_ASSETS.filter(
    (e) => propFilter === ALL_SIZES || propCategory(e.id) === propFilter,
  );
  const visible = BUILDER_ASSETS.filter((e) => e.group === 'floor').filter(
    (e) => sizeFilter === ALL_SIZES || sizes[e.id] === sizeFilter,
  );

  return (
    <main className="app" data-testid="dev-builder">
      <h2>{t('dev.builder.title')}</h2>
      <div className="dev-controls">
        <button onClick={onClose} data-testid="builder-close">
          {t('dev.builder.close')}
        </button>
        <button
          className={tool.layer === 'floor' ? 'active' : ''}
          onClick={() => choose({ ...START_TOOL })}
          data-testid="layer-floor"
        >
          {t('dev.builder.floors')}
        </button>
        <button
          className={tool.layer === 'prop' ? 'active' : ''}
          onClick={openProps}
          data-testid="layer-prop"
        >
          {t('dev.builder.props')}
        </button>
        <button
          className={tool.pieceId === null ? 'active' : ''}
          onClick={() => choose({ ...tool, pieceId: null })}
          data-testid="tool-erase"
        >
          {t('dev.builder.erase')}
        </button>
        {!pool && (
          <button onClick={rotate} data-testid="tool-rotate">
            {t('dev.builder.rotate', { deg: tool.rot * (tool.layer === 'prop' ? 45 : 90) })}
          </button>
        )}
        <button onClick={() => commit(defaultLayout(BOARD))} data-testid="builder-default">
          {t('dev.builder.default')}
        </button>
        <button onClick={() => commit(emptyLayout())} data-testid="builder-clear">
          {t('dev.builder.clear')}
        </button>
        <button
          className={topDown ? 'active' : ''}
          onClick={() => {
            setTopDown(!topDown);
            canvas.current?.setTopDown(!topDown);
          }}
          data-testid="builder-topdown"
        >
          {t('dev.builder.topDown')}
        </button>
        <span data-testid="builder-count">
          {t('dev.builder.count', {
            floors: layout.floors.length,
            props: layout.props.length,
          })}
        </span>
      </div>
      <div className="builder-layout">
        <div ref={host} className="raid-canvas" data-testid="builder-canvas" />
        <aside className="builder-palette" data-testid="builder-palette">
          <p className="hint">{t('dev.builder.hint')}</p>
          {tool.layer === 'prop' ? (
            <>
              <div className="builder-filter">
                <label>
                  {t('dev.builder.category')}{' '}
                  <select
                    value={propFilter}
                    onChange={(e) => setPropFilter(e.target.value)}
                    data-testid="prop-filter"
                  >
                    <option value={ALL_SIZES}>{t('dev.builder.allSizes')}</option>
                    {propCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {propsLoading && <p className="hint">{t('dev.builder.loading')}</p>}
              <div className="builder-pieces">{visibleProps.map(pieceButton)}</div>
            </>
          ) : tool.layer === 'floor' ? (
            <>
              <div className="builder-filter">
                <button
                  className={pool ? 'active' : ''}
                  onClick={() => choose({ ...tool, pool: pool ? null : [] })}
                  data-testid="group-toggle"
                >
                  {t('dev.builder.group')}
                </button>
                <label>
                  {t('dev.builder.size')}{' '}
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    data-testid="size-filter"
                  >
                    <option value={ALL_SIZES}>{t('dev.builder.allSizes')}</option>
                    {sizeOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {pool && (
                <div className="builder-filter">
                  <button
                    onClick={() =>
                      choose({
                        ...tool,
                        pool: [...new Set([...pool, ...visible.map((e) => e.id)])],
                      })
                    }
                    data-testid="group-select-visible"
                  >
                    {t('dev.builder.selectVisible')}
                  </button>
                  <button onClick={() => choose({ ...tool, pool: [] })} data-testid="group-clear">
                    {t('dev.builder.clearPool')}
                  </button>
                  <span data-testid="group-count">
                    {t('dev.builder.poolCount', { n: pool.length })}
                  </span>
                </div>
              )}
              <div className="builder-pieces">{visible.map(pieceButton)}</div>
            </>
          ) : null}
        </aside>
        <LayoutPanel
          layout={layout}
          presetId={presetId}
          onPreset={setPresetId}
          onLoad={setLayoutState}
          bounds={provider}
          ensureProps={ensureProps}
          modelsVersion={modelsVersion}
        />
      </div>
    </main>
  );
}
