import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';
test.skip(
  process.env.MUGONG_PRODUCTION_VERIFY !== '1',
  'Explicit local production verification only.',
);
const proof = 'docs/verification/shaolin-family-v1/production';
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`production Shaolin family combat and review ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      assets: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/art/shaolin-family-v1/') && r.url().endsWith('.webp')) {
        expect([200, 304]).toContain(r.status());
        assets.push(new URL(r.url()).pathname);
      }
    });
    await seedRegion(page, 4);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    expect(new Set(assets).size).toBe(30);
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    await page.goto('/art/shaolin-family-v1/review.html');
    await expect(page.locator('canvas')).toHaveCount(8);
    await page.getByRole('button', { name: '일시 정지' }).click();
    for (let n = 0; n < 7; n++) {
      await page.locator('#character').selectOption(String(n));
      await page.locator('#mode').selectOption('walk');
      await expect(page.locator('#phase')).toContainText('걷기');
      await page.locator('#mode').selectOption('attack');
      await page.getByRole('button', { name: '다음 프레임' }).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${proof}/review-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/verification-${width}.json`,
      JSON.stringify({ assets, errors, width, height }, null, 2),
    );
  });
