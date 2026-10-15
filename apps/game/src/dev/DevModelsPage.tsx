import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { ModelViewerCanvas } from '../view/ModelViewerCanvas';

/** Models shown in the viewer, in the order of the arrows (ids of the model library). */
const VIEWER_MODELS = ['hero', 'skeleton'] as const;

/** DEV-only page (/dev/models): look at a unit model and try every animation it can play. */
export function DevModelsPage() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<ModelViewerCanvas | null>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [clips, setClips] = useState<string[]>([]);
  const [playing, setPlaying] = useState('Idle_A');

  useEffect(() => {
    if (!host.current) return;
    const c = new ModelViewerCanvas(host.current);
    canvas.current = c;
    void c.init(VIEWER_MODELS).then(() => {
      setClips(c.clipNames());
      setReady(true);
    });
    return () => {
      c.destroy();
      canvas.current = null;
      setReady(false);
    };
  }, []);

  const modelId = VIEWER_MODELS[index] ?? VIEWER_MODELS[0];

  useEffect(() => {
    if (!ready) return;
    canvas.current?.show(modelId);
  }, [ready, modelId]);

  const step = (delta: number) => {
    setIndex((i) => (i + delta + VIEWER_MODELS.length) % VIEWER_MODELS.length);
    setPlaying('Idle_A');
  };

  const play = (name: string) => {
    canvas.current?.play(name);
    setPlaying(name);
  };

  return (
    <main className="app" data-testid="dev-models">
      <h2>{t('dev.models.title')}</h2>
      <div className="dev-controls">
        <button onClick={() => window.location.assign('../')} data-testid="models-back">
          {t('dev.map.back')}
        </button>
        <button
          onClick={() => step(-1)}
          aria-label={t('dev.models.prev')}
          data-testid="models-prev"
        >
          ◀
        </button>
        <strong data-testid="models-name">{t(`dev.models.name.${modelId}`)}</strong>
        <button onClick={() => step(1)} aria-label={t('dev.models.next')} data-testid="models-next">
          ▶
        </button>
        <span className="hint">{t('dev.models.hint')}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div ref={host} className="raid-canvas" data-testid="models-canvas" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>{t('dev.models.animations')}</strong>
          {clips.map((name) => (
            <button
              key={name}
              className={playing === name ? 'active' : ''}
              onClick={() => play(name)}
              data-testid={`models-clip-${name}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
