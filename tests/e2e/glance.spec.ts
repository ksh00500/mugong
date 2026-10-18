import { test, expect, type Page } from '@playwright/test';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeItem } from '../../src/domain/content';
import type { GameState } from '../../src/domain/model';
import { mkdir } from 'node:fs/promises';
const proofRoot = process.env.MUGONG_DAYTONA_URL
  ? 'docs/verification/glance-v2/daytona'
  : 'docs/verification/glance-v2';

async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
  [800, 600],
  [390, 600],
]) {
  test(`한눈에 가방 ${width}×${height}: 전리품·두 격자·수납·정리판`, async ({ page }) => {
    const state = emptyGame();
    startRun(state, '청하연', 123);
    state.run!.phase = 'loot';
    state.run!.fighter.items.push(makeItem('ore', 'glance-loot', 'ground'));
    state.run!.fighter.items.push(makeItem('sword', 'glance-sword', 'ground'));
    state.run!.fighter.items.push(makeItem('robe', 'glance-robe', 'ground'));
    state.run!.fighter.items.push(makeItem('manual', 'glance-manual', 'ground'));
    await seed(page, state);
    await page.setViewportSize({ width, height });
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    const bag = page.locator('.glance-workspace');
    await expect(bag.locator('.inventory-mobile-nav')).toHaveCount(0);
    const together = async () => {
      for (const selector of [
        '.bag-grid.weapon',
        '.bag-grid.general',
        '.ground-section',
      ]) {
        const surface = bag.locator(selector);
        await expect(surface).toBeVisible();
        const box = (await surface.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual(height);
      }
      for (const selector of ['.bag-grid.weapon', '.bag-grid.general']) {
        const geometry = await bag.locator(selector).evaluate((grid) => {
          const root = grid.getBoundingClientRect();
          const style = getComputedStyle(grid);
          const columns = Number(style.getPropertyValue('--cols'));
          const rows = Number(style.getPropertyValue('--rows'));
          const cell = grid.querySelector('.bag-cell')!.getBoundingClientRect();
          const items = [...grid.querySelectorAll<HTMLElement>('.bag-item')].map((item) => {
            const rect = item.getBoundingClientRect();
            const style = getComputedStyle(item);
            return {
              x: rect.left - root.left,
              y: rect.top - root.top,
              column: Number(style.gridColumnStart) - 1,
              row: Number(style.gridRowStart) - 1,
            };
          });
          return {
            cell: { w: cell.width, h: cell.height },
            expected: { w: root.width / columns, h: root.height / rows },
            items,
          };
        });
        expect(Math.abs(geometry.cell.w - geometry.cell.h)).toBeLessThan(0.1);
        expect(Math.abs(geometry.cell.w - geometry.expected.w)).toBeLessThan(0.1);
        for (const item of geometry.items) {
          expect(Math.abs(item.x - item.column * geometry.expected.w)).toBeLessThan(0.1);
          expect(Math.abs(item.y - item.row * geometry.expected.h)).toBeLessThan(0.1);
        }
      }
    };
    await together();
    await mkdir(proofRoot, { recursive: true });
    await page.screenshot({
      path: `${proofRoot}/loot-before-${width}x${height}.png`,
      animations: 'disabled',
    });
    await bag.locator('[data-item-id="glance-loot"]').click();
    await expect(bag.locator('.item-detail')).toContainText('철광석');
    await together();
    await bag.getByRole('button', { name: '수납', exact: true }).click();
    await expect(bag.locator('.bag-grid.general [data-item-id="glance-loot"]')).toBeVisible();
    await expect(bag.locator('.ground-section [data-item-id="glance-loot"]')).toHaveCount(0);
    await bag.getByRole('button', { name: '꺼내기', exact: true }).click();
    await expect(bag.locator('.ground-section [data-item-id="glance-loot"]')).toBeVisible();
    await together();
    await bag.locator('.ground-section [data-item-id="glance-loot"]').click();
    await bag.getByRole('button',{name:'폐기',exact:true}).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: '계속 정리' }).click();
    await bag.getByRole('button', { name: '수납', exact: true }).click();
    await together();
    await mkdir(proofRoot, { recursive: true });
    await page.screenshot({
      path: `${proofRoot}/loot-${width}x${height}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '가방 Tab', exact: true })).toBeFocused();
  });
}
