import { useMemo, useState } from 'react';
import { backpackStacks, computeHeroStats, type RunState, type StatBlock } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';
import { DragButton, DropButton, slotDropId, stackDragId } from './dnd';
import { artifactName } from './names';
import { previewStatDiff, type StatPreview } from './previewStats';

const STAT_ORDER: (keyof StatBlock)[] = [
  'maxHp',
  'atk',
  'aspd',
  'def',
  'moveSpeed',
  'critChance',
  'critMult',
  'accuracy',
  'range',
];

export function formatStat(stat: keyof StatBlock, value: number): string {
  if (stat === 'critChance') return `${Math.round(value * 100)}%`;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function StatsPanel({ run, preview }: { run: RunState; preview: StatPreview | null }) {
  const stats = computeHeroStats(gameData, run);
  const diffs = preview ? previewStatDiff(gameData, run, preview) : [];
  return (
    <div className="stats-panel" data-testid="stats-panel">
      <h3>{t('ui.inv.stats')}</h3>
      <table>
        <tbody>
          {STAT_ORDER.map((k) => {
            const d = diffs.find((x) => x.stat === k);
            return (
              <tr key={k}>
                <td>{t(`ui.stat.${k}`)}</td>
                <td data-testid={`stat-${k}`}>{formatStat(k, stats[k])}</td>
                <td
                  className={d ? (d.delta > 0 ? 'diff-up' : 'diff-down') : ''}
                  data-testid={`diff-${k}`}
                >
                  {d ? `→ ${formatStat(k, d.after)}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Backpack stacks, 9 equipment slots, stat panel with before/after and the merge button. */
export function InventoryPanel({ run }: { run: RunState }) {
  const equipArtifact = useGameStore((s) => s.equipArtifact);
  const unequipSlot = useGameStore((s) => s.unequipSlot);
  const merge = useGameStore((s) => s.mergeStack);
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [hoverSlot, setHoverSlot] = useState<number | null>(null);
  const stacks = useMemo(() => backpackStacks(run), [run]);
  const selectedValid = selectedUid !== null && run.backpack.some((a) => a.uid === selectedUid);

  let preview: StatPreview | null = null;
  if (hoverSlot !== null) {
    if (selectedValid && selectedUid) {
      preview = { kind: 'equip', artifactUid: selectedUid, slot: hoverSlot };
    } else if (run.equipped[hoverSlot]) preview = { kind: 'unequip', slot: hoverSlot };
  }

  return (
    <div className="inventory">
      <div className="slots" data-testid="slots">
        <h3>{t('ui.inv.slots')}</h3>
        <div className="slot-grid">
          {run.equipped.map((inst, i) => (
            <DropButton
              key={i}
              dropId={slotDropId(i)}
              type="button"
              className={`slot${inst ? ' filled' : ''}`}
              data-testid={`slot-${i}`}
              onMouseEnter={() => setHoverSlot(i)}
              onMouseLeave={() => setHoverSlot((h) => (h === i ? null : h))}
              onClick={() => {
                if (selectedValid && selectedUid) {
                  equipArtifact(selectedUid, i);
                  setSelectedUid(null);
                } else if (inst) {
                  unequipSlot(i);
                }
              }}
              title={inst ? t(gameData.artifacts[inst.artifactId]?.descKey ?? '') : undefined}
            >
              {inst ? (
                <>
                  <span>{artifactName(inst.artifactId)}</span>
                  <small>{t('ui.inv.level', { level: inst.level })}</small>
                </>
              ) : (
                <small>{t('ui.inv.slot', { n: i + 1 })}</small>
              )}
            </DropButton>
          ))}
        </div>
        <p className="hint">{selectedValid ? t('ui.inv.selectHint') : t('ui.inv.pickHint')}</p>
      </div>

      <div className="backpack" data-testid="backpack">
        <h3>
          {t('ui.inv.backpack')}{' '}
          <button
            type="button"
            className={mergeMode ? 'active' : ''}
            data-testid="merge-toggle"
            onClick={() => {
              setMergeMode((m) => !m);
              setSelectedUid(null);
            }}
          >
            {t('ui.inv.merge')}
          </button>
        </h3>
        {mergeMode && <p className="hint">{t('ui.inv.mergeActive')}</p>}
        {stacks.length === 0 && <p className="hint">{t('ui.inv.backpackEmpty')}</p>}
        <div className="stack-list">
          {stacks.map((s) => {
            const first = s.uids[0] ?? '';
            const isSel = s.uids.includes(selectedUid ?? '');
            return (
              <DragButton
                key={`${s.artifactId}-${s.level}`}
                dragId={stackDragId(s.artifactId, s.level)}
                type="button"
                className={`stack${isSel ? ' selected' : ''}${mergeMode && s.mergeable ? ' mergeable' : ''}`}
                data-testid={`stack-${s.artifactId}-${s.level}`}
                disabled={mergeMode && !s.mergeable}
                title={t(gameData.artifacts[s.artifactId]?.descKey ?? '')}
                onClick={() => {
                  if (mergeMode) {
                    merge(s.artifactId, s.level);
                    setMergeMode(false);
                  } else {
                    setSelectedUid(isSel ? null : first);
                  }
                }}
              >
                <span>{artifactName(s.artifactId)}</span>
                <small>
                  {t('ui.inv.level', { level: s.level })} ×{s.count}
                </small>
              </DragButton>
            );
          })}
        </div>
      </div>

      <StatsPanel run={run} preview={preview} />
    </div>
  );
}
