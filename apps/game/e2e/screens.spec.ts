/// <reference types="node" />
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shot, startAndBuild, trackErrors } from './helpers';

test('room tooltip shows type, monsters and upgrade', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await startAndBuild(page);
  await page.getByTestId('cell-0,4').hover();
  const tip = page.getByTestId('cell-0,4').getByTestId('room-tooltip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Komnata');
  await expect(tip).toContainText('×');
  await shot(page, 'm6a-room-tooltip');
  expect(errors).toEqual([]);
});

test('equipping shows a before/after diff, drag and drop works like clicking', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await startAndBuild(page);
  await page.getByTestId('debug-artifact-select').selectOption('sharp_dagger');
  await page.getByTestId('debug-add-artifact').click();
  const atkBefore = Number(await page.getByTestId('stat-atk').innerText());
  // The dagger bonus comes from the balance data, so the test follows any tuning.
  const artifacts = JSON.parse(
    readFileSync(join(process.cwd(), '../../packages/data/src/json/artifacts.json'), 'utf8'),
  ) as { id: string; modifiers: { value: number }[] }[];
  const delta = artifacts.find((a) => a.id === 'sharp_dagger')?.modifiers[0]?.value ?? 0;
  const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2));

  // Click flow: select the stack, hover the slot -> diff, click -> equipped.
  await page.getByTestId('stack-sharp_dagger-1').click();
  await page.getByTestId('slot-0').hover();
  await expect(page.getByTestId('diff-atk')).toContainText(fmt(atkBefore + delta));
  await shot(page, 'm6b-diff-panel');
  await page.getByTestId('slot-0').click();
  await expect(page.getByTestId('stat-atk')).toHaveText(fmt(atkBefore + delta));

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
  await expect(page.getByTestId('stat-atk')).toHaveText(fmt(atkBefore + 2 * delta));

  // Upgrade by drag to the start room, then the threat badge is visible.
  await page.getByTestId('debug-add-upgrade-fountain').click();
  const up = await page.getByTestId('storage-fountain').boundingBox();
  const room = await page.getByTestId('cell-0,4').boundingBox();
  if (!up || !room) throw new Error('missing boxes');
  await page.mouse.move(up.x + up.width / 2, up.y + up.height / 2);
  await page.mouse.down();
  await page.mouse.move(up.x + up.width / 2 + 20, up.y + up.height / 2 + 20, { steps: 5 });
  await page.mouse.move(room.x + room.width / 2, room.y + room.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(150); // dnd-kit swallows the click that follows a drag
  await expect(page.getByTestId('upgrade-0,4')).toBeVisible();
  await expect(page.getByTestId('threat')).toBeVisible();
  await shot(page, 'm6b-prep-upgrades');
  expect(errors).toEqual([]);
});

test('a chosen tile builds itself, so Start is enabled right away', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await page.getByTestId('class-warrior').getByRole('button').click();
  await page.locator('[data-testid^="take-"]').first().click();
  await expect(page.getByTestId('start-raid')).toBeEnabled();
  await expect(page.getByTestId('cell-1,4')).toBeVisible();
});

test('a lost raid costs a life and the game ends after five defeats', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=3');
  await page.getByTestId('menu-new-game').click();
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

test('ten wins then the boss card builds the boss room and the run is won', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=3');
  await page.getByTestId('menu-new-game').click();
  await startAndBuild(page);
  await page.getByTestId('debug-waves-9').click();
  await page.getByTestId('debug-win-raid').click();
  await page.getByTestId('resolve-continue').click();
  // The boss offer is one card; choosing it builds the boss room at once.
  await expect(page.locator('[data-testid^="take-"]')).toHaveCount(1);
  await expect(page.getByTestId('start-raid')).toBeDisabled();
  await shot(page, 'm6c-boss-offer');
  await page.locator('[data-testid^="take-"]').first().click();
  await expect(page.getByTestId('start-raid')).toBeEnabled();
  await page.getByTestId('debug-win-raid').click();
  await page.getByTestId('resolve-continue').click();
  await expect(page.getByTestId('end-screen')).toHaveAttribute('data-outcome', 'Victory');
  await shot(page, 'm6c-victory');
  expect(errors).toEqual([]);
});

test('the stage is letterboxed and keeps the 16:9 ratio', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  const box = await page.getByTestId('stage').boundingBox();
  if (!box) throw new Error('no stage');
  expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
  expect(box.width).toBeLessThanOrEqual(1280.5);
  expect(box.height).toBeLessThanOrEqual(900.5);
  await shot(page, 'm6d-letterbox');
});

test('a chosen tile flies onto the map and builds the room', async ({ page }) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await page.getByTestId('class-warrior').getByRole('button').click();
  await expect(page.getByTestId('offer-popup')).toBeVisible();
  await expect(page.locator('[data-testid^="take-"]')).toHaveCount(3);
  await page.waitForTimeout(1500); // the 3D pictures on the cards need a moment
  await shot(page, 'map-offer-popup');
  await page.locator('[data-testid^="take-"]').first().click();
  await expect(page.getByTestId('cell-1,4')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('start-raid')).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId('offer-popup')).toHaveCount(0);
  await page.waitForTimeout(1200);
  await shot(page, 'map-two-rooms');
  expect(errors).toEqual([]);
});

test('Start flies into the first room, the wave popup shows, and the summary leads back to the map', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await page.getByTestId('class-warrior').getByRole('button').click();
  await expect(page.getByTestId('offer-popup')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.locator('[data-testid^="take-"]').first().click();
  await expect(page.getByTestId('start-raid')).toBeEnabled({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  // The wave popup only shows for a second and the page can be busy, so record it as it appears.
  await page.evaluate(() => {
    new MutationObserver(() => {
      const el = document.querySelector('[data-testid="wave-popup"]');
      if (el) (window as unknown as { __wave: string }).__wave = el.textContent ?? '';
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('start-raid').click();
  await expect(page.getByTestId('raid-screen')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(() => (window as unknown as { __wave?: string }).__wave, null, {
    timeout: 30_000,
  });
  expect(await page.evaluate(() => (window as unknown as { __wave: string }).__wave)).toContain(
    '1/10',
  );
  // Skip is locked while the popup shows; once it is gone the raid runs.
  await expect(page.getByTestId('raid-skip')).toBeEnabled({ timeout: 30_000 });
  await shot(page, 'flow-raid-start');
  await page.getByTestId('raid-skip').click();
  await expect(page.getByTestId('raid-summary')).toBeVisible();
  await expect(page.getByTestId('summary-gold')).toContainText('xxx');
  await expect(page.getByTestId('summary-xp')).toContainText('Zdobyte EXP');
  await expect(page.getByTestId('summary-xp')).toContainText('/50');
  await shot(page, 'flow-summary-popup');
  await page.getByTestId('summary-continue').click();
  await expect(page.getByTestId('offer-popup')).toBeVisible({ timeout: 30_000 });
  await shot(page, 'flow-back-on-map');
  expect(errors).toEqual([]);
});

test('the skill tree: points from levels, linked nodes unlock one after another', async ({
  page,
}) => {
  const errors = trackErrors(page);
  await page.goto('/?seed=5');
  await page.getByTestId('menu-new-game').click();
  await startAndBuild(page);
  // No level yet, so no points and no badge.
  await expect(page.getByTestId('skills-badge')).toHaveCount(0);
  for (let i = 0; i < 3; i++) await page.getByTestId('debug-add-level').click();
  await expect(page.getByTestId('skills-badge')).toHaveText('3');
  await page.getByTestId('skills-open').click();
  await expect(page.getByTestId('skills-points')).toContainText('3');
  await expect(page.getByTestId('skill-node-u37')).toHaveAttribute('data-tone', 'root');
  await expect(page.getByTestId('skill-node-u40')).toHaveAttribute('data-tone', 'locked');
  // A locked node cannot be bought.
  await page.getByTestId('skill-node-u40').click();
  await expect(page.getByTestId('skill-buy')).toBeDisabled();
  await expect(page.getByTestId('skill-block')).toContainText('Najpierw');
  await shot(page, 'skills-tree');
  // Buy the root, then the node above it.
  await page.getByTestId('skill-node-u37').click();
  await page.getByTestId('skill-buy').click();
  await expect(page.getByTestId('skill-node-u37')).toHaveAttribute('data-level', '1');
  await expect(page.getByTestId('skills-points')).toContainText('2');
  await expect(page.getByTestId('skill-node-u40')).toHaveAttribute('data-tone', 'open');
  await page.getByTestId('skill-node-u40').click();
  await page.getByTestId('skill-buy').click();
  await expect(page.getByTestId('skill-node-u40')).toHaveAttribute('data-level', '1');
  await expect(page.getByTestId('skills-points')).toContainText('1');
  await shot(page, 'skills-tree-bought');
  await page.getByTestId('skills-close').click();
  await expect(page.getByTestId('skills-badge')).toHaveText('1');
  expect(errors).toEqual([]);
});
