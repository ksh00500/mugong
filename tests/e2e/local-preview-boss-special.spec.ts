import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';
test.skip(
  process.env.MUGONG_PRODUCTION_VERIFY !== '1',
  'Explicit local production verification only.',
);
const proof = 'docs/verification/shaolin-special-v1/production';
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`production Shaolin special motions ${width}x${height}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      assets: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/art/shaolin-special-v1/') && r.url().endsWith('.webp')) {
        expect([200, 304]).toContain(r.status());
        assets.push(new URL(r.url()).pathname);
      }
    });
    await seedRegion(page, 4);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    expect(new Set(assets).size).toBe(20);
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    await page.goto('/art/shaolin-special-v1/review.html');
    await expect(page.locator('canvas')).toHaveCount(8);
    await page.getByRole('button', { name: '일시 정지' }).click();
    for (let n = 0; n < 4; n++) {
      await page.locator('#character').selectOption(String(n));
      const moves = await page
        .locator('#move option')
        .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
      for (const move of moves) {
        await page.locator('#move').selectOption(move);
        await page.getByRole('button', { name: '다음 프레임' }).click();
        if (['grab', 'stance'].includes(move)) {
          await page.locator('#hold').check();
          await expect(page.locator('#phase')).toContainText('유지');
          await page.locator('#hold').uncheck();
        }
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${proof}/review-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/verification-${width}.json`,
      JSON.stringify({ width, height, assets, errors }, null, 2),
    );
  });
