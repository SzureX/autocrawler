import { useEffect, useState } from 'react';
import { RUN_PHASES } from '@loch/sim';
import { t } from '../i18n';
import { gameData, useGameStore } from '../store/gameStore';

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 8,
  right: 8,
  width: 300,
  padding: 10,
  background: 'rgba(0,0,0,0.85)',
  color: '#cde',
  font: '12px monospace',
  zIndex: 1000,
  border: '1px solid #456',
};

/** DEV-only overlay (toggle with the backtick key). */
export function DebugOverlay() {
  const [open, setOpen] = useState(true);
  const [message, setMessage] = useState('');
  const run = useGameStore((s) => s.run);
  const startRun = useGameStore((s) => s.startRun);
  const debugSetPhase = useGameStore((s) => s.debugSetPhase);
  const resetRun = useGameStore((s) => s.resetRun);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`') setOpen((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;

  const exportRun = () => {
    if (!run) return;
    const json = JSON.stringify(run, null, 2);
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    setMessage(t('debug.exported', { chars: json.length }));
  };

  return (
    <div style={panelStyle} data-testid="debug-overlay">
      <strong>{t('debug.title')}</strong> <small>{t('debug.hint')}</small>
      <div data-testid="debug-phase">
        {t('app.phase')}: {run ? run.phase : '-'}
      </div>
      <div data-testid="debug-seed">
        {t('app.seed')}: {run ? run.seed : '-'}
      </div>
      <div style={{ margin: '6px 0' }}>
        {Object.values(gameData.classes).map((c) => (
          <button key={c.id} onClick={() => startRun(c.id)} data-testid={`debug-new-${c.id}`}>
            {t('debug.newRun', { class: t(c.nameKey) })}
          </button>
        ))}
      </div>
      {run ? (
        <div>
          <div>{t('debug.forcePhase')}:</div>
          {RUN_PHASES.map((p) => (
            <button
              key={p}
              onClick={() => debugSetPhase(p)}
              disabled={p === run.phase}
              data-testid={`debug-phase-${p}`}
            >
              {p}
            </button>
          ))}
          <div style={{ marginTop: 6 }}>
            <button onClick={exportRun}>{t('debug.export')}</button>
            <button onClick={resetRun}>{t('debug.clearSave')}</button>
          </div>
        </div>
      ) : (
        <div>{t('debug.noRun')}</div>
      )}
      {message && <div>{message}</div>}
    </div>
  );
}
