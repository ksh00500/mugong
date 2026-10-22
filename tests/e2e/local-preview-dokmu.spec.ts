import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion } from './support/region';
test.skip(
  process.env.MUGONG_PRODUCTION_VERIFY !== '1',
  'Explicit local production verification only.',
);
const proof = `${process.env.MUGONG_DOKMU_PROOF ?? 'docs/verification/dokmu-family-v1'}/production`;
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`production Dokmu family combat and review ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [],
      assets: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.url().includes('/art/dokmu-family-v1/') && r.url().endsWith('.webp')) {
        expect([200, 304]).toContain(r.status());
        assets.push(new URL(r.url()).pathname);
      }
    });
    await seedRegion(page, 1, true, undefined, ['needle', 'guard', 'bombardier']);
    await expect(page.locator('script[src^="/assets/main-"]')).toHaveCount(1);
    await page.keyboard.down('d');
    await page.waitForTimeout(300);
    await page.keyboard.up('d');
    expect(new Set(assets).size).toBe(35);
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    await page.goto('/art/dokmu-family-v1/review.html');
    await expect(page.locator('canvas')).toHaveCount(8);
    await page.getByRole('button', { name: '일시 정지' }).click();
    for (let n = 0; n < 7; n++) {
      await page.locator('#character').selectOption(String(n));
      await page.locator('#mode').selectOption('walk');
      await expect(page.locator('#phase')).toContainText('걷기');
      await page.locator('#mode').selectOption('attack');
      await page.getByRole('button', { name: '다음 프레임' }).click();
    }
    await page.locator('#character').selectOption('5');
    await page.locator('#mode').selectOption('attack');
    await page.getByRole('button', { name: '다음 프레임' }).click();
    if (width === 1440) {
      let step = 1;
      for (const [pose, targetStep] of [7, 14, 21, 22, 25, 35].entries()) {
        while (step < targetStep) {
          await page.getByRole('button', { name: '다음 프레임' }).click();
          step++;
        }
        await expect(page.locator('#phase')).toContainText(`원화 ${pose + 1}`);
        await page.screenshot({ path: `${proof}/dokmu-pose-${pose}.png`, fullPage: true });
      }
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
