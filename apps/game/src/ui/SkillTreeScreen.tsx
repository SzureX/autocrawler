import { useState } from 'react';
import { availableSkillPoints, skillNodeStatus, type RunState } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';

/** Size of one grid cell of the tree in pixels, and of a node inside it. */
const CELL = 56;
const NODE = 50;

type Tone = 'owned' | 'root' | 'open' | 'locked';

/** Full-screen skill tree: nodes on the tree's grid, links between them, a panel for the chosen one. */
export function SkillTreeScreen({ run, onClose }: { run: RunState; onClose: () => void }) {
  const buySkill = useGameStore((s) => s.buySkill);
  const [selected, setSelected] = useState<string | null>(null);
  const tree = gameData.skillTrees[run.classId];
  const points = availableSkillPoints(gameData, run);

  if (!tree) {
    return (
      <div className="skills-overlay" data-testid="skills-screen">
        <p>{t('ui.skills.none')}</p>
        <button type="button" onClick={onClose} data-testid="skills-close">
          {t('ui.skills.close')}
        </button>
      </div>
    );
  }

  const nodeName = (id: string): string => {
    const node = tree.nodes.find((n) => n.id === id);
    return node ? t(node.nameKey) : id;
  };
  const statuses = Object.fromEntries(
    tree.nodes.map((n) => [n.id, skillNodeStatus(gameData, run, n.id)]),
  );
  const toneOf = (id: string): Tone => {
    const st = statuses[id];
    if (!st) return 'locked';
    if (st.level > 0) return 'owned';
    if (st.missing.length > 0) return 'locked';
    return st.node.startState === 'unlocked' ? 'root' : 'open';
  };
  const chosen = selected ? statuses[selected] : undefined;
  const center = (x: number, y: number) => ({ x: x * CELL + CELL / 2, y: y * CELL + CELL / 2 });

  return (
    <div className="skills-overlay" data-testid="skills-screen">
      <header className="skills-head">
        <h2>{t(tree.nameKey)}</h2>
        <strong data-testid="skills-points">{t('ui.skills.points', { n: points })}</strong>
        <button type="button" onClick={onClose} data-testid="skills-close">
          {t('ui.skills.close')}
        </button>
      </header>
      <div className="skills-body">
        <div
          className="skills-grid"
          style={{ width: tree.grid.cols * CELL, height: tree.grid.rows * CELL }}
        >
          <svg
            className="skills-links"
            width={tree.grid.cols * CELL}
            height={tree.grid.rows * CELL}
            aria-hidden="true"
          >
            {tree.nodes.flatMap((n) =>
              n.requires.map((req) => {
                const from = tree.nodes.find((r) => r.id === req);
                if (!from) return null;
                const a = center(from.position.x, from.position.y);
                const b = center(n.position.x, n.position.y);
                const bought = (statuses[req]?.level ?? 0) > 0;
                return (
                  <line
                    key={`${req}-${n.id}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className={bought ? 'link bought' : 'link'}
                  />
                );
              }),
            )}
          </svg>
          {tree.nodes.map((n) => {
            const st = statuses[n.id];
            return (
              <button
                key={n.id}
                type="button"
                className={`skill-node ${toneOf(n.id)}${selected === n.id ? ' selected' : ''}`}
                style={{
                  left: n.position.x * CELL + (CELL - NODE) / 2,
                  top: n.position.y * CELL + (CELL - NODE) / 2,
                  width: NODE,
                  height: NODE,
                }}
                onClick={() => setSelected(n.id)}
                data-testid={`skill-node-${n.id}`}
                data-tone={toneOf(n.id)}
                data-level={st?.level ?? 0}
              >
                <span className="skill-icon">{n.icon}</span>
                <span className="skill-badge">
                  {st?.level ?? 0}/{n.maxLevel}
                </span>
                <span className="skill-name">{t(n.nameKey)}</span>
              </button>
            );
          })}
        </div>
        <aside className="skills-side" data-testid="skills-side">
          {chosen ? (
            <>
              <h3>
                {chosen.node.icon} {t(chosen.node.nameKey)}
              </h3>
              <p>{t('ui.skills.level', { level: chosen.level, max: chosen.node.maxLevel })}</p>
              <p>{t(chosen.node.descKey)}</p>
              {chosen.node.requires.length > 0 && (
                <p>
                  {t('ui.skills.requires', {
                    names: chosen.node.requires.map(nodeName).join(', '),
                  })}
                </p>
              )}
              {chosen.cost !== null && <p>{t('ui.skills.cost', { n: chosen.cost })}</p>}
              <button
                type="button"
                disabled={chosen.block !== null}
                onClick={() => buySkill(chosen.node.id)}
                data-testid="skill-buy"
              >
                {t('ui.skills.buy')}
              </button>
              {chosen.block !== null && (
                <p className="hint" data-testid="skill-block">
                  {t(`ui.skills.block.${chosen.block}`)}
                </p>
              )}
            </>
          ) : (
            <p className="hint">{t('ui.skills.hint')}</p>
          )}
          <p className="hint">{t('ui.skills.final')}</p>
        </aside>
      </div>
    </div>
  );
}
