import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { xpThreshold } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import { REGIONS } from '../../src/domain/campaign';
import type { GameState } from '../../src/domain/model';
const proof = process.env.MUGONG_PREP_DESIGN_PROOF ?? 'docs/verification/prep-design-v1/source';
test.beforeAll(async () => {
  await mkdir(proof, { recursive: true });
});
async function seed(page: Page) {
  const state = emptyGame();
  startRun(state, '쉼터검증무인', 123);
  const r = state.run!,
    f = r.fighter;
  r.wave = 4;
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
  f.items.push({
    ...makeLootItem('material-0', 'prep-design-material', 'general'),
    x: 1,
    y: 0,
    count: 4,
  });
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
  await expect(page.locator('.prep-stop')).toBeVisible();
  return state;
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => r(q.result);
    });
    return new Promise<GameState>((r) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => {
        r(q.result);
        db.close();
      };
    });
  });
}
async function fits(locator: Locator, page: Page) {
  const b = await locator.boundingBox(),
    v = page.viewportSize()!;
  expect(b).not.toBeNull();
  expect(b!.x).toBeGreaterThanOrEqual(0);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.x + b!.width).toBeLessThanOrEqual(v.width + 1);
  expect(b!.y + b!.height).toBeLessThanOrEqual(v.height + 1);
  expect(await locator.evaluate((e) => e.scrollWidth <= e.clientWidth + 2)).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${proof}/${name}.png`, animations: 'disabled' });
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`waystation NPC art, keyboard, receipts and layout ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page);
    const prep = page.locator('.prep-stop');
    const prepBounds = await prep.boundingBox();
    for (const vital of await page.locator('.hud-vitals > *').all()) {
      await fits(vital, page);
      const bounds = await vital.boundingBox();
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(prepBounds!.y);
    }
    await expect(prep.locator('.prep-npc')).toHaveCount(3);
    for (const portrait of await prep.locator('.prep-npc').all()) {
      await expect
        .poll(() => portrait.evaluate((e) => (e as HTMLImageElement).naturalWidth > 0))
        .toBe(true);
      await fits(portrait, page);
    }
    await expect(prep).toHaveCSS('background-image', /waystation\.png/);
    for (const control of await prep.locator('button,select,.prep-next-boss').all())
      await fits(control, page);
    const dimensions = await prep.locator('.prep-service').evaluateAll((els) =>
      els.map((el) => ({
        rect: el.getBoundingClientRect().toJSON(),
        title: el.querySelector('.prep-service-title')!.getBoundingClientRect().toJSON(),
        body: el.querySelector('.prep-service-body')!.getBoundingClientRect().toJSON(),
        action: el.querySelector('button')!.getBoundingClientRect().toJSON(),
      })),
    );
    for (const row of dimensions) {
      expect(row.title.bottom).toBeLessThanOrEqual(row.body.top + 1);
      expect(row.body.bottom).toBeLessThanOrEqual(row.action.top + 1);
    }
    await shot(page, `waystation-${width}`);
    const heal = prep.getByRole('button', { name: '의원 · 회복 12전', exact: true });
    await heal.focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(145);
    await expect(prep.locator('.prep-receipt')).toHaveText('치료를 마쳤습니다.');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await heal.click();
    await expect(prep.locator('.prep-receipt')).toHaveCSS('animation-name', 'none');
    const market = prep.getByRole('button', { name: '정비 상인', exact: true });
    await market.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.market-keeper img')).toBeVisible();
    await fits(page.locator('.market-purchase button'), page);
    await shot(page, `merchant-${width}`);
    await page.keyboard.press('Escape');
    await expect(market).toBeFocused();
    const bag = prep.getByRole('button', { name: '가방과 획득 물품', exact: true });
    await bag.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await expect(page.locator('.inventory-workspace')).toContainText('가방 정리');
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    await expect(bag).toBeFocused();
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/layout-${width}.json`,
      JSON.stringify({ width, height, dimensions, errors }, null, 2),
    );
  });
test('decorative art failure never blocks preparation actions', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.route('**/art/prep-waystation-v1/**', (route) => route.abort());
  await seed(page);
  await expect(page.locator('.asset-loading[data-error="true"]')).toHaveCount(0);
  const prep = page.locator('.prep-stop');
  await expect(prep.locator('.prep-npc')).toHaveCount(0);
  await prep.getByRole('button', { name: '의원 · 회복 12전', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(145);
  await prep.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.gold).toBe(76);
  await shot(page, 'art-failure-small');
});
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'])
  test(`small waystation with large HUD, high contrast and reduced motion ${locale}`, async ({
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
    const prep = page.locator('.prep-stop');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-locale', locale);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-large-hud', 'true');
    for (const control of await prep.locator('h1,h2,button,select,.prep-gold').all())
      await fits(control, page);
    const top = (await prep.boundingBox())!.y;
    for (const vital of await page.locator('.hud-vitals > *').all()) {
      await fits(vital, page);
      const b = (await vital.boundingBox())!;
      expect(b.y + b.height).toBeLessThanOrEqual(top);
    }
    await expect(prep.locator('.prep-npc')).toHaveCount(3);
    await shot(page, `waystation-large-contrast-${locale}`);
  });
