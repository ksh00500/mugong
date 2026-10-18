import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedRegion } from './support/region';

for (const [width, height, wave] of [
  [1440, 900, 1],
  [1366, 768, 1],
  [1093, 614, 1],
  [1440, 900, 20],
])
  test(`클리어 성장→가방→진행 ${width}×${height} wave${wave}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    test.setTimeout(90000);
    await seedRegion(page, 2, false);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {timeout:30000});
    await page.evaluate(async (wave) => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const r = store.state.run;
      r.phase = 'loot';
      r.wave = wave;
      r.enemies = [];
      r.fighter.level = 7;
      r.fighter.spent = r.spent = 5;
      r.fighter.arts = ['huashan', 'jegal', 'tang'].map((id, n) => ({
        id,
        level: n === 1 ? 2 : 1,
        gauge: 0,
        combo: 0,
        defenseCd: 0,
      }));
      r.offers = r.fighter.arts.map((a: any) => ({ art: a.id, type: 'upgrade' }));
      store.bagOpen = false;
      store.paused = false;
      store.notify();
    }, wave);
    await expect(page.locator('.growth')).toBeVisible();
    // Reproduce the late clear-save callback while growth already owns the modal layer.
    await page.evaluate(async () => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      store.bagOpen = true;
      store.notify();
    });
    for (let n = 0; n < 2; n++) {
      await expect(page.locator('.growth')).toBeVisible();
      await expect(page.getByRole('dialog', { name: '무인의 가방' })).toHaveCount(0);
      const card = page.locator('.choice-card:visible').first();
      await expect(card).toBeEnabled();
      expect(await card.evaluate((el) => !!el.closest('[inert]'))).toBe(false);
      await card.locator('.choose-label').click();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { gameStore: store } = await (window as any).regionModule(
              '/src/platform/store.ts',
            );
            return store.state.run.spent;
          }),
        )
        .toBe(6 + n);
    }
    await expect(page.locator('.growth')).toHaveCount(0);
      const inventory = page.locator('.inventory-workspace');
    await expect(inventory).toBeVisible();
    expect(await inventory.evaluate((el) => !!el.closest('[inert]'))).toBe(false);
    await mkdir('docs/verification/clear-growth-v2', { recursive: true });
    await page.screenshot({ path: `docs/verification/clear-growth-v2/bag-${width}-${wave}.png` });
    await page
      .getByRole('button', { name: wave === 20 ? '귀환' : '다음 2웨이브 →', exact: true })
      .click();
    await expect(inventory).toHaveCount(0);
  });
