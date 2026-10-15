import { expect, test } from '@playwright/test';

test('dev raid page replays a simulated raid', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/dev/raid');
  await expect(page.getByTestId('raid-canvas').locator('canvas')).toBeVisible();
  await page.getByTestId('dev-seed').fill('7');
  await page.getByTestId('dev-simulate').click();
  await page.getByTestId('speed-4').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '../../artifacts/screens/dev-raid-playing.png' });
  await expect(page.getByTestId('raid-hud')).toContainText('HP');

  await page.getByTestId('dev-skip').click();
  await expect(page.getByTestId('raid-outcome')).toBeVisible();
  await page.screenshot({ path: '../../artifacts/screens/dev-raid-end.png' });
  expect(errors).toEqual([]);
});

test('a raid plays through the doors and room changes in real time', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/dev/raid');
  await expect(page.getByTestId('raid-canvas').locator('canvas')).toBeVisible();
  await page.getByTestId('dev-seed').fill('7');
  await page.getByTestId('dev-simulate').click();
  await page.getByTestId('speed-4').click();
  await expect(page.getByTestId('raid-outcome')).toBeVisible({ timeout: 150_000 });
  // The slide-and-fade between rooms leaves the picture as it was.
  const canvas = page.getByTestId('raid-canvas').locator('canvas');
  await expect(canvas).toHaveCSS('opacity', '1');
  expect(errors).toEqual([]);
});
