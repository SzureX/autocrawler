import { expect, type Page } from '@playwright/test';

export const SHOTS = '../../artifacts/screens';

/** Collects console errors and uncaught exceptions; assert the list is empty at the end. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** Class select -> first tile offer -> Prep with the tile built on the first legal cell. */
export async function startAndBuild(page: Page, classId = 'warrior'): Promise<void> {
  await page.getByTestId(`class-${classId}`).getByRole('button').click();
  await page.locator('[data-testid^="take-"]').first().click();
  await buildHand(page);
}

/** Builds the tile in hand on the first legal cell (no-op when the hand is empty). */
export async function buildHand(page: Page): Promise<void> {
  const legal = page.locator('[data-legal="true"]');
  if ((await legal.count()) > 0) await legal.first().click();
  await expect(page.getByTestId('start-raid')).toBeEnabled();
}
