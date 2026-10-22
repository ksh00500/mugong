import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeLootItem } from '../../src/domain/items';
import { bossReward } from '../../src/domain/boss-loot';
import { makeItem } from '../../src/domain/content';

const proof = 'docs/verification/item-art-v2';
async function fixture(page: Page) {
  const state = emptyGame();
  startRun(state, '그림 검증', 123);
  const r = state.run!,
    f = r.fighter;
  r.phase = 'loot';
  r.offers = [];
  r.enemies = [];
  f.hp = 60;
  f.items = [
    { ...makeLootItem('weapon-sword-0', 'sword0', 'weapon'), x: 0 },
    { ...makeLootItem('weapon-sword-2', 'sword2', 'weapon'), x: 0, y: 3 },
    { ...makeLootItem('weapon-staff-2', 'staff', 'weapon'), x: 3 },
    { ...makeLootItem('weapon-fan-2', 'fan', 'weapon'), x: 1, y: 4 },
    { ...makeLootItem('weapon-gauntlet-2', 'gloves', 'weapon'), x: 2, y: 6 },
    { ...makeLootItem('medicine-small', 'medicine0', 'general'), x: 0 },
    { ...makeLootItem('medicine-medium', 'medicine1', 'general'), x: 1 },
    { ...makeLootItem('medicine-large', 'medicine2', 'general'), x: 2 },
    { ...makeLootItem('material-1', 'herb', 'general'), x: 3 },
    { ...makeLootItem('material-9', 'mechanism', 'general'), x: 4 },
    { ...makeLootItem('gear-robe-2', 'robe', 'general'), x: 0, y: 2 },
    { ...makeLootItem('regional-gear-3', 'snowboots', 'general'), x: 2, y: 2 },
    { ...makeLootItem('manual-training', 'book', 'general'), x: 4, y: 2 },
    bossReward('9-4', 'bossfan')!,
    bossReward('6-3', 'core')!,
    makeItem('ore', 'old-ore', 'ground'),
  ];
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (s) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(s, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
}
async function decodeArtwork(page: Page) {
  await page.locator('.inventory-workspace').evaluate(async (root) => {
    const urls = new Set(
      [...root.querySelectorAll('svg[data-art-id] image')].map((e) => e.getAttribute('href')!),
    );
    await Promise.all(
      [...urls].map(
        (url) =>
          new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => img.decode().then(resolve, reject);
            img.onerror = reject;
            img.src = url;
          }),
      ),
    );
  });
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`dedicated inventory drawings and rotations ${width}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await fixture(page);
    await decodeArtwork(page);
    const grid = page.locator('.bag-grid.weapon');
    await expect(grid.locator('[data-art-id="weapon-sword-0"]')).toHaveCount(1);
    await expect(grid.locator('[data-art-id="weapon-sword-2"]')).toHaveCount(1);
    await expect(page.locator('[data-item-id="bossfan"] [data-art-id="boss-9-4"]')).toHaveCount(1);
    const sword = page.locator('[data-item-id="sword2"]');
    await sword.click();
    await expect(page.locator('.detail-icon [data-art-id="weapon-sword-2"]')).toHaveCount(1);
    const image = sword.locator('svg');
    const before = await image.getAttribute('viewBox');
    await page.keyboard.press('r');
    await expect(image).toHaveAttribute('data-art-rotated', 'true');
    expect(await image.getAttribute('viewBox')).not.toBe(before);
    // A rendered rotation precedes the durable save. Wait before sending another management input.
    await expect(
      page.locator('.item-actions button').filter({ has: page.locator('.icon-rotate') }),
    ).toBeEnabled();
    await page.keyboard.press('r');
    await expect(image).toHaveAttribute('data-art-rotated', 'false');
    await page.locator('[data-item-id="medicine0"]').click();
    await page.getByRole('button', { name: '사용', exact: true }).click();
    await expect(page.locator('[data-item-id="medicine0"]')).toHaveCount(0);
    await page.locator('[data-item-id="robe"]').click();
    await page.getByRole('button', { name: '착용', exact: true }).click();
    await expect(page.locator('.equipped-list [data-art-id="gear-robe-2"]')).toHaveCount(1);
    await decodeArtwork(page);
    const overflow = await page.locator('svg[data-art-id]').evaluateAll((nodes) =>
      nodes
        .filter((el) => {
          const a = el.getBoundingClientRect(),
            b = el.closest('.item-tile,.detail-icon,.empty-equipment')!.getBoundingClientRect();
          return (
            a.left < b.left - 1 ||
            a.right > b.right + 1 ||
            a.top < b.top - 1 ||
            a.bottom > b.bottom + 1
          );
        })
        .map((el) => el.getAttribute('data-art-id')),
    );
    expect(overflow).toEqual([]);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `${proof}/bag-${width}.png`, animations: 'disabled' });
  });
}
test('a failed item illustration keeps a visible generic icon and usable buttons', async ({
  page,
}) => {
  await page.route('**/art/items-v2/weapon-sword-2.webp', (route) => route.abort());
  await fixture(page);
  const tile = page.locator('[data-item-id="sword2"]');
  await expect(tile.locator('[data-art-id]')).toHaveCount(0);
  await expect(tile.locator('svg image')).toHaveCount(1);
  await tile.click();
  await expect(page.getByRole('button', { name: '일반 가방에 수납', exact: true })).toBeEnabled();
});
test('review every generated item at both display and small-icon sizes', async ({ page }) => {
  await mkdir(proof, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (let i = 0; i < 4; i++) {
    await page.goto(`/docs/verification/item-art-v2/gallery.html?page=${i}`);
    await page.waitForFunction(() => document.documentElement.dataset.ready === 'true');
    await page.screenshot({ path: `${proof}/catalogue-${i + 1}.png`, animations: 'disabled' });
    expect(await page.locator('article').count()).toBe(i === 3 ? 20 : 24);
  }
});
