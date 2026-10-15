import { useState } from 'react';
import { t } from '../i18n';

interface MainMenuProps {
  /** A saved run exists: Continue resumes it. */
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: () => void;
}

/** Title screen: the game name over Continue (when there is a run), New game and Credits. */
export function MainMenu({ canContinue, onContinue, onNewGame }: MainMenuProps) {
  const [credits, setCredits] = useState(false);
  return (
    <main className="menu" data-testid="main-menu">
      <h1 className="menu-title">{t('app.title')}</h1>
      {credits ? (
        <section className="menu-credits" data-testid="menu-credits">
          <h2>{t('menu.credits')}</h2>
          <p>{t('menu.credits.author')}</p>
          <p>
            {t('menu.credits.assets')}{' '}
            <a href="https://www.kaylousberg.com" target="_blank" rel="noreferrer">
              www.kaylousberg.com
            </a>
          </p>
          <p>
            {t('menu.credits.ui')}{' '}
            <a href="https://www.kenney.nl" target="_blank" rel="noreferrer">
              www.kenney.nl
            </a>
          </p>
          <button onClick={() => setCredits(false)} data-testid="menu-back">
            {t('menu.back')}
          </button>
        </section>
      ) : (
        <div className="menu-buttons">
          {canContinue && (
            <button onClick={onContinue} data-testid="menu-continue">
              {t('menu.continue')}
            </button>
          )}
          <button onClick={onNewGame} data-testid="menu-new-game">
            {t('menu.newGame')}
          </button>
          <button onClick={() => setCredits(true)} data-testid="menu-credits-open">
            {t('menu.credits')}
          </button>
        </div>
      )}
    </main>
  );
}
