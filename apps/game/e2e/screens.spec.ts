import { expect, test } from '@playwright/test';
import { buildHand, shot, startAndBuild, trackErrors } from './helpers';

test('room tooltip shows type, monsters and upgrade', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=5');
  await startAndBuild(page);
  await page.getByTestId('cell-4,4').hover();
  const tip = page.getByTestId('cell-4,4').getByTestId('room-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Komnata');
  await expect(tip).toContainText('×');
  await shot(page, 'm6a-room-tooltip');
  expect(errors).toEqual([]);
});

test('equipping shows a before/after diff, drag and drop works like clicking', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=5');
  await startAndBuild(page);
  await page.getByTestId('debug-artifact-select').selectOption('sharp_dagger');
  await page.getByTestId('debug-add-artifact').click();
  const atkBefore = Number(await page.getByTestId('stat-atk').innerText());

  // Click flow: select the stack, hover the slot -> diff, click -> equipped.
  await page.getByTestId('stack-sharp_dagger-1').click();
  await page.getByTestId('slot-0').hover();
  await expect(page.getByTestId('diff-atk')).toContainText(String(atkBefore + 3));
  await shot(page, 'm6b-diff-panel');
  await page.getByTestId('slot-0').click();
  await expect(page.getByTestId('stat-atk')).toHaveText(String(atkBefore + 3));

  // Drag flow: a second dagger dragged to slot 1.
  await page.getByTestId('debug-add-artifact').click();
  const src = await page.getByTestId('stack-sharp_dagger-1').boundingBox();
  const dst = await page.getByTestId('slot-1').boundingBox();
  if (!src || !dst) throw new Error('missing boxes');
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2);
  await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 + 20, src.y + src.height / 2 + 20, { steps: 5 });
  await page.mouse.move(dst.x + dst.width / 2, dst.y + dst.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(150); // dnd-kit swallows the click that follows a drag
  await expect(page.getByTestId('stat-atk')).toHaveText(String(atkBefore + 6));

  // Upgrade by drag to the start room, then the threat badge is visible.
  await page.getByTestId('debug-add-upgrade-fountain').click();
  const up = await page.getByTestId('storage-fountain').boundingBox();
  const room = await page.getByTestId('cell-4,4').boundingBox();
  if (!up || !room) throw new Error('missing boxes');
  await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2);
  await page.mouse.down();
  await page.mouse.move(up.x + up.width / 2 + 20, up.y + up.height / 2 + 20, { steps: 5 });
  await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(150); // dnd-kit swallows the click that follows a drag
  await expect(page.getByTestId('upgrade-4,4')).toBeVisible();
  await expect(page.getByTestId('threat')).toBeVisible();
  await shot(page, 'm6b-prep-upgrades');
  expect(errors).toEqual([]);
});

test('Start is blocked until the tile is built', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.getByTestId('class-rogue').getByRole('button').click();
  await page.locator('[data-testid^="take-"]').first().click();
  await expect(page.getByTestId('start-raid')).toBeDisabled();
  await buildHand(page);
  await expect(page.getByTestId('start-raid')).toBeEnabled();
});

test('a lost raid costs a life and the game ends after five defeats', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=3');
  await startAndBuild(page);
  for (let i = 0; i < 5; i++) {
    await page.getByTestId('debug-lose-raid').click();
    await expect(page.getByTestId('resolve-screen')).toBeVisible();
    if (i === 0) await shot(page, 'm6c-resolve-lost');
    await page.getByTestId('resolve-continue').click();
  }
  await expect(page.getByTestId('end-screen')).toHaveAttribute('data-outcome', 'GameOver');
  await shot(page, 'm6c-gameover');
  await page.getByTestId('new-run').click();
  await expect(page.getByTestId('class-warrior')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ten wins then the player places the boss room and wins', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=3');
  await startAndBuild(page);
  await page.getByTestId('debug-waves-9').click();
  await page.getByTestId('debug-win-raid').click();
  await page.getByTestId('resolve-continue').click();
  // The boss room is now in hand (single boss: chosen automatically) and must be built.
  await expect(page.getByTestId('start-raid')).toBeDisabled();
  await shot(page, 'm6c-boss-placement');
  await buildHand(page);
  await page.getByTestId('debug-win-raid').click();
  await page.getByTestId('resolve-continue').click();
  await expect(page.getByTestId('end-screen')).toHaveAttribute('data-outcome', 'Victory');
  await shot(page, 'm6c-victory');
  expect(errors).toEqual([]);
});

test('the stage is letterboxed and keeps the 16:9 ratio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?seed=5');
  const box = await page.getByTestId('stage').boundingBox();
  if (!box) throw new Error('no stage');
  expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  expect(box.width).toBeLessThanOrEqual(1280.5);
  expect(box.height).toBeLessThanOrEqual(900.5);
  await shot(page, 'm6d-letterbox');
});
