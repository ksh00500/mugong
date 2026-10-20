import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { xpThreshold } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import { REGIONS } from '../../src/domain/campaign';
import type { GameState } from '../../src/domain/model';
const proof = process.env.MUGONG_REST_PROOF ?? 'docs/verification/waystation-world-v1/source';
test.beforeAll(async () => {
  await mkdir(proof, { recursive: true });
});
test('native Tab and Enter reach an NPC without a mouse or programmatic focus', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await seed(page);
  const marker = page.locator('[data-stop="physician"]');
  for (let n = 0; n < 10; n++) {
    if (await marker.evaluate((e) => e === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(marker).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(marker).toHaveAttribute('data-near', 'true', { timeout: 7000 });
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: '의원', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(marker).toBeFocused();
  await page.screenshot({ path: `${proof}/native-tab-small.png` });
});
async function seed(page: Page, wave = 4) {
  const state = emptyGame();
  startRun(state, '쉼터 검증', 123);
  const r = state.run!,
    f = r.fighter;
  r.wave = wave;
  r.regionRoute = REGIONS.slice(0, 4).map((r) => r.name);
  spawnWave(r);
  r.gold = 100;
  r.offers = [];
  f.appearance = 6;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.augments = ['swift'];
  f.augmentOffers = [];
  f.trainingPoints = 0;
  f.growth = { constitution: 1, strength: 1, agility: 1, inner: 1 };
  f.growthStartLevel = 0;
  f.hp = 100;
  f.items.push({ ...makeLootItem('material-0', 'rest-material', 'general'), x: 1, y: 0, count: 4 });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator(wave === 4 ? '.waystation-world' : '.prep-stop')).toBeVisible();
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    return new Promise<GameState>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => {
        resolve(q.result);
        db.close();
      };
    });
  });
}
async function fits(el: Locator, page: Page) {
  const b = (await el.boundingBox())!,
    v = page.viewportSize()!;
  expect(b).not.toBeNull();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height + 1);
  expect(await el.evaluate((e) => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
}
async function approach(page: Page, id: string) {
  const marker = page.locator(`.waystation-marker[data-stop="${id}"]`);
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(marker).toHaveAttribute('data-near', 'true', { timeout: 7000 });
  // Arrival is separate from opening: E is an explicit interaction.
  await page.keyboard.press('e');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
}
test('manual movement cancels walking; menus freeze movement; a saved rest restores position', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await seed(page);
  const world = page.locator('.waystation-world'),
    marker = page.locator('[data-stop="physician"]');
  await marker.click();
  await page.keyboard.down('d');
  await expect(page.locator('.waystation-controls [role="status"]')).not.toContainText('자동 이동');
  await expect
    .poll(async () => Number(await world.getAttribute('data-player-x')))
    .toBeGreaterThan(990);
  await page.keyboard.up('d');
  await approach(page, 'physician');
  const x = await world.getAttribute('data-player-x'),
    y = await world.getAttribute('data-player-y');
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  await expect(world).toHaveAttribute('data-player-x', x!);
  await expect(world).toHaveAttribute('data-player-y', y!);
  await page.keyboard.press('Escape');
  await page.keyboard.press('i');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect(page.locator('.inventory-next')).toHaveCount(0);
  await page.locator('.inventory-workspace [data-item-id]').first().click();
  await expect(page.getByRole('button', { name: /^강화 ·/ })).toHaveCount(0);
  await expect.poll(async () => Math.round((await saved(page)).run!.fighter.x)).toBe(Number(x));
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(world).toBeVisible({ timeout: 45000 });
  await expect(world).toHaveAttribute('data-player-x', x!);
  await expect(world).toHaveAttribute('data-player-y', y!);
  await expect(world).toHaveAttribute('data-elapsed', '0');
  await page.keyboard.press('e');
  await expect(page.getByRole('dialog', { name: '의원', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-stop="physician"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('.pause-menu')).toBeVisible();
  await page.keyboard.down('d');
  await page.waitForTimeout(250);
  await page.keyboard.up('d');
  await expect(world).toHaveAttribute('data-player-x', x!);
  await page.getByRole('button', { name: '계속하기', exact: true }).click();
  await expect(world).toBeVisible();
  await page.screenshot({ path: `${proof}/restored-small.png` });
});
test('optional world art failure keeps movement, proximity and physician usable', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.route('**/art/waystation-world-v1/**', (route) => route.abort());
  await seed(page);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-rest-courtyard', 'fallback');
  await approach(page, 'physician');
  await page.getByRole('button', { name: '의원 · 회복 12전', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(145);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${proof}/art-failure-small.png` });
});
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
  test(`small world and service dialogs, large HUD contrast reduced motion ${locale}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((locale) => {
      localStorage.setItem('mugong-language-v1', locale);
      localStorage.setItem('mugong-ui-v1', JSON.stringify({ largeHud: true, highContrast: true }));
    }, locale);
    await seed(page);
    for (const e of await page.locator('.waystation-marker,.waystation-controls button').all())
      await fits(e, page);
    await approach(page, 'blacksmith');
    for (const e of await page.locator('.waystation-dialog button,.waystation-dialog select').all())
      await fits(e, page);
    await page.screenshot({ path: `${proof}/dialog-small-${locale}.png` });
    await page.keyboard.press('Escape');
    await approach(page, 'exit');
    for (const e of await page.locator('.waystation-dialog button').all()) await fits(e, page);
    await page.screenshot({ path: `${proof}/exit-small-${locale}.png` });
    await page.keyboard.press('Escape');
  });
for (const wave of [9, 14, 19])
  test(`later rest ${wave} preserves existing service and departure screen`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1093, height: 614 });
    await seed(page, wave);
    await expect(page.locator('.waystation-world')).toHaveCount(0);
    await expect(page.locator('.prep-service')).toHaveCount(3);
    const price = { 9: 16, 14: 20, 19: 24 }[wave]!;
    await page.getByRole('button', { name: `의원 · 회복 ${price}전`, exact: true }).click();
    await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(145);
    await expect.poll(async () => (await saved(page)).run!.gold).toBe(100 - price);
    await fits(page.locator('.prep-actions button.primary'), page);
  });
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`walk, interact, services and boss departure ${width}`, async ({ page }) => {
    test.setTimeout(100000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page);
    const world = page.locator('.waystation-world');
    const initial = await world.getAttribute('data-elapsed');
    await page.keyboard.press('e');
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await page.keyboard.down('a');
    await expect
      .poll(async () => Number(await world.getAttribute('data-player-x')))
      .toBeLessThan(930);
    await page.keyboard.up('a');
    await expect(world).toHaveAttribute('data-elapsed', initial!);
    for (const marker of await page.locator('.waystation-marker').all()) await fits(marker, page);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-rest-courtyard', 'ready', {
      timeout: 15000,
    });
    await page.screenshot({ path: `${proof}/world-${width}.png` });
    await approach(page, 'physician');
    const heal = page.getByRole('button', { name: '의원 · 회복 12전', exact: true });
    await fits(heal, page);
    await heal.click();
    await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(145);
    await page.screenshot({ path: `${proof}/physician-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(world).toBeVisible();
    await expect(page.locator('.waystation-marker[data-stop="physician"]')).toBeFocused();
    await approach(page, 'merchant');
    const buy = page.locator('.market-purchase button');
    await fits(buy, page);
    await buy.click();
    await expect.poll(async () => (await saved(page)).run!.gold).toBe(80);
    await page.keyboard.press('Escape');
    await approach(page, 'blacksmith');
    const forge = page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true });
    await fits(forge, page);
    await forge.click();
    await expect.poll(async () => (await saved(page)).run!.gold).toBe(68);
    await page.screenshot({ path: `${proof}/blacksmith-${width}.png` });
    await page.keyboard.press('Escape');
    await approach(page, 'exit');
    await fits(page.locator('.prep-actions button.primary'), page);
    await page.getByRole('button', { name: '다음 5웨이브 →', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '남은 물품 확인', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '남은 물품 두고 진행', exact: true }).click();
    await expect(page.locator('.waystation-world')).toHaveCount(0);
    await expect.poll(async () => (await saved(page)).run!.wave).toBe(5);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await page.keyboard.press('Escape'); // stop the actual boss fight after successful transition
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/flow-${width}.json`,
      JSON.stringify(
        { width, height, errors, initialElapsed: initial, realServices: true, bossWave: 5 },
        null,
        2,
      ),
    );
  });
