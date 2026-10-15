import { expect, test, type Page } from '@playwright/test';
import { buildHand, shot, trackErrors } from './helpers';

/** Equips everything from the backpack into free slots by clicking (stack, then slot). */
async function equipAll(page: Page): Promise<void> {
  for (let slot = 0; slot < 9; slot++) {
    const stack = page.locator('[data-testid^="stack-"]').first();
    if ((await stack.count()) === 0) return;
    const target = page.getByTestId(`slot-${slot}`);
    if ((await target.locator('span').count()) > 0) continue; // filled
    await stack.click();
    await target.click();
  }
}

/** Merges one mergeable stack if there is one. */
async function mergeIfPossible(page: Page): Promise<void> {
  await page.getByTestId('merge-toggle').click();
  const stack = page.locator('.stack.mergeable').first();
  if ((await stack.count()) > 0) await stack.click();
  else await page.getByTestId('merge-toggle').click();
}

/** Puts every stored upgrade into the first room by clicking (upgrade, then room). */
async function assignUpgrades(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const stored = page.locator('[data-testid^="storage-"]').first();
    if ((await stored.count()) === 0) return;
    await stored.click();
    await page.getByTestId('cell-0,4').click();
  }
}

test('a bot plays a whole run through the UI (skip mode) and reaches the end screen', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=11');
  await page.getByTestId('menu-new-game').click();
  await shot(page, 'm6a-class-select');
  await page.getByTestId('class-warrior').getByRole('button').click();

  const seen: Record<string, boolean> = {};
  for (let step = 0; step < 400; step++) {
    if (await page.getByTestId('end-screen').isVisible()) break;
    if (await page.getByTestId('resolve-screen').isVisible()) {
      if (!seen['resolve']) {
        seen['resolve'] = true;
        await shot(page, 'm6c-resolve');
      }
      await page.getByTestId('resolve-continue').click();
    } else if (await page.getByTestId('raid-screen').isVisible()) {
      if (!seen['raid']) {
        seen['raid'] = true;
        await page.waitForTimeout(700);
        await shot(page, 'm6c-raid');
      }
      await page.getByTestId('raid-skip').click();
      await expect(page.getByTestId('raid-outcome')).toBeVisible();
      await page.getByTestId('to-summary').click();
    } else if (await page.getByTestId('prep-screen').isVisible()) {
      await buildHand(page).catch(() => undefined);
      await equipAll(page);
      if ((await page.locator('.stack.mergeable').count()) === 0) await mergeIfPossible(page);
      await assignUpgrades(page);
      if (!seen['prep']) {
        seen['prep'] = true;
        await shot(page, 'm6b-prep');
      }
      await page.getByTestId('start-raid').click();
    } else if ((await page.locator('[data-testid^="take-"]').count()) > 0) {
      if (!seen['offer']) {
        seen['offer'] = true;
        await shot(page, 'm6a-tile-offer');
      }
      await page.locator('[data-testid^="take-"]').first().click();
    } else {
      await page.waitForTimeout(100);
    }
  }

  await expect(page.getByTestId('end-screen')).toBeVisible();
  const outcome = await page.getByTestId('end-screen').getAttribute('data-outcome');
  expect(['Victory', 'GameOver']).toContain(outcome);
  await shot(page, `m6c-end-${outcome}`);
  expect(errors).toEqual([]);
});
