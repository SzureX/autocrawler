import { t } from '../i18n';
import { useGameStore } from '../store/gameStore';

export function App() {
  const run = useGameStore((s) => s.run);
  return (
    <main style={{ padding: 24, font: '16px sans-serif' }}>
      <h1>{t('app.title')}</h1>
      <p data-testid="phase-label">{run ? t(`phase.${run.phase}`) : t('phase.ClassSelect')}</p>
      <p>{t('app.placeholder')}</p>
    </main>
  );
}
