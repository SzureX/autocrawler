import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** Scale factor of the stage; drag & drop uses it to correct pointer deltas. */
export const StageScaleContext = createContext(1);
export const useStageScale = (): number => useContext(StageScaleContext);

/** Largest scale at which the design resolution fits the window (letterboxed, ratio kept). */
export function fitScale(width: number, height: number): number {
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}

/** Fixed 1920x1080 stage scaled to the window with black bars. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(() => fitScale(window.innerWidth, window.innerHeight));
  useEffect(() => {
    const onResize = () => setScale(fitScale(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return (
    <div className="viewport">
      <div
        className="stage"
        data-testid="stage"
        style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT, transform: `scale(${scale})` }}
      >
        <StageScaleContext.Provider value={scale}>{children}</StageScaleContext.Provider>
      </div>
    </div>
  );
}
