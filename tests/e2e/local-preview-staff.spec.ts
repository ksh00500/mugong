import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';

test.skip(
  process.env.MUGONG_PRODUCTION_VERIFY !== '1',
  'Run explicitly against the local production preview.',
);
const root = 'docs/verification/shaolin-staff-v1/production';
for (const [width, height] of [
  [1440, 900],
  [1093, 614],
])
  test(`local production staff assets and combat ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      assets: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/art/shaolin-staff-v1/') && r.url().endsWith('.webp')) {
        expect(r.status()).toBe(200);
        assets.push(new URL(r.url()).pathname);
      }
    });
    await seedRegion(page, 4);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.keyboard.down('d');
    await page.waitForTimeout(450);
    await page.keyboard.up('d');
    const canvas = await page.locator('.game-canvas canvas').boundingBox();
    await page.mouse.move(canvas!.x + canvas!.width * 0.55, canvas!.y + canvas!.height * 0.5);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    expect(new Set(assets).size).toBe(10);
    expect(errors).toEqual([]);
    await mkdir(root, { recursive: true });
    await page.screenshot({ path: `${root}/combat-${width}.png` });
    await writeFile(
      `${root}/combat-${width}.json`,
      JSON.stringify({ assets, errors, canvas }, null, 2),
    );
  });
test('local production eight-direction animation review controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/art/shaolin-staff-v1/review.html');
  await expect(page.locator('canvas')).toHaveCount(8);
  await page.getByRole('button', { name: '일시 정지' }).click();
  const before = await page.locator('#phase').textContent();
  await page.getByRole('button', { name: '다음 프레임' }).click();
  await page.locator('#mode').selectOption('walk');
  await expect(page.locator('#phase')).toContainText('걷기');
  await page.locator('#mode').selectOption('attack');
  await page.getByRole('button', { name: '재생', exact: true }).click();
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: '일시 정지' }).click();
  expect(before).toBeTruthy();
  expect(errors).toEqual([]);
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/review.png`, fullPage: true });
});
