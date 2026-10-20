import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, spawnWave, startRun } from '../../src/domain/game';
import { xpThreshold } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import type { BoundFighter, GameState } from '../../src/domain/model';

const proof = 'docs/verification/gangho-completion-v1';
function fixture(wave = 4) {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  r.regionRoute = ['청하현', '독무곡', '천검산', '설산'];
  r.wave = wave;
  spawnWave(r);
  f.level = f.spent = r.spent = 4;
  f.xp = xpThreshold(4);
  f.arts = [{ id: 'wudang', level: 4, gauge: 0, combo: 0, defenseCd: 0 }];
  f.bindings = { wudang: f.items[0].id };
  f.hp = 60;
  r.gold = 100;
  const material = makeLootItem('material-0', 'fixture-material', 'ground');
  material.count = 6;
  f.items.push(material, makeLootItem('gear-robe-2', 'fixture-robe', 'ground'));
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  // Only Playwright's disposable context is seeded, never the user's browser.
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').clear();
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    const state = await new Promise<GameState>((resolve) => {
      const req = db.transaction('saves').objectStore('saves').get('current');
      req.onsuccess = () => resolve(req.result);
    });
    db.close();
    return state;
  });
}
async function fits(page: Page, root: string) {
  await page.locator(root).evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    );
  });
  const failures = await page.locator(root).evaluate((root) => {
    const issues: string[] = [];
    for (const element of [
      root,
      ...root.querySelectorAll(
        'button,h2,h3,h4,dd,.item-detail,.market-stock-select,.journey-totals',
      ),
    ]) {
      const el = element as HTMLElement,
        box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      if (
        box.left < -1 ||
        box.top < -1 ||
        box.right > innerWidth + 1 ||
        box.bottom > innerHeight + 1
      )
        issues.push(`${el.className || el.tagName}: outside viewport`);
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
        issues.push(
          `${el.className || el.tagName}: overflow ${el.clientWidth}×${el.clientHeight} / ${el.scrollWidth}×${el.scrollHeight}`,
        );
    }
    return issues;
  });
  if (failures.length)
    await page.screenshot({ path: `${proof}/debug-${page.viewportSize()!.width}.png` });
  expect(failures).toEqual([]);
}
test.beforeEach(async () => {
  await mkdir(proof, { recursive: true });
});

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`정비 강화·판매·구매·전리품 사용·재실행 ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state = fixture(),
      weaponId = state.run!.fighter.items[0].id,
      initialPower = state.run!.fighter.items[0].power;
    await seed(page, state);
    await page.getByRole('button', { name: '가방과 획득 물품', exact: true }).click();
    await page.locator(`[data-item-id="${weaponId}"]`).click();
    await fits(page, '.inventory-workspace');
    await page.screenshot({ path: `${proof}/refine-${width}.png` });
    const upgrade = page.getByRole('button', { name: '강화 · 12전 + 재료 2', exact: true });
    await upgrade.click();
    await expect
      .poll(
        async () =>
          (await saved(page)).run!.fighter.items.find((item) => item.id === weaponId)?.power,
      )
      .toBe(initialPower + 1);
    await upgrade.click();
    await expect(upgrade).toHaveCount(0);
    expect((await saved(page)).run!.gold).toBe(76);
    await page.locator('[data-item-id="fixture-material"]').click();
    await page.getByRole('button', { name: '판매 · 6전', exact: true }).click();
    await expect(page.locator('[data-item-id="fixture-material"]')).toHaveCount(0);
    await page.locator('[data-item-id="fixture-robe"]').click();
    await page.getByRole('button', { name: '착용', exact: true }).click();
    await expect(page.locator('.equipped-list [data-item-id="fixture-robe"]')).toBeVisible();
    await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await fits(page, '.rest-market');
    await page.locator('.market-purchase button').click();
    await expect(page.locator('.rest-market-status')).toContainText('74');
    await page.screenshot({ path: `${proof}/market-${width}.png` });
    await page.getByRole('button', { name: '가방과 획득 물품', exact: true }).click();
    const purchased = page.locator('.ground-section [data-item-id*="vendor-"]');
    await expect(purchased).toHaveCount(1);
    await purchased.click();
    await page.getByRole('button', { name: '사용', exact: true }).click();
    await expect(purchased).toHaveCount(0);
    await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(95);
    await page.screenshot({ path: `${proof}/gear-${width}.png` });
    await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: '정비 상인', exact: true }).click();
    await expect(page.locator('.market-stock-select').first()).toContainText('재고 2');
    const result = await saved(page);
    expect(result.run!.gold).toBe(74);
    expect(result.run!.fighter.items.find((item) => item.id === weaponId)?.upgrades).toBe(2);
    expect(result.run!.fighter.items.find((item) => item.id === 'fixture-robe')?.place).toBe(
      'equipped',
    );
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/flow-${width}.json`,
      JSON.stringify({ gold: result.run!.gold, errors, items: result.run!.fighter.items }, null, 2),
    );
  });

test('완주 결과는 저장 뒤 표시하고 정산·명부·수명을 재실행에도 유지한다', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  const state = fixture(20),
    r = state.run!;
  r.phase = 'loot';
  r.enemies = [];
  r.fighter.items = r.fighter.items.filter((item) => ['weapon', 'general'].includes(item.place));
  await seed(page, state);
  await page.getByRole('button', { name: '귀환', exact: true }).click();
  await expect(page.locator('.journey-summary')).toBeVisible();
  await fits(page, '.journey-summary');
  await page.screenshot({ path: `${proof}/victory-1093.png` });
  const first = await saved(page);
  expect(first.run).toBeNull();
  expect(first.family.silver).toBe(100);
  expect(first.family.roster[0].hp).toBe(60);
  expect(first.family.roster[0].expiresAt! - first.family.roster[0].bornAt!).toBe(7 * 86400000);
  await page.getByRole('button', { name: '무인의 가방', exact: true }).click();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await fits(page, '.inventory-workspace');
  await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
  await page.reload();
  await expect(page.locator('.home-scene')).toBeVisible();
  await expect(page.locator('.journey-summary')).toHaveCount(0);
  expect((await saved(page)).family.journeys).toEqual(first.family.journeys);
});

test('다섯 언어의 상점·강화·완주 설명이 작은 화면 안에 표시된다', async ({ browser }) => {
  test.setTimeout(180000);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
    const page = await context.newPage();
    await seed(page, fixture());
    await page
      .locator('.intermission-actions button')
      .filter({ hasText: /정비 상인|Rest Merchant|休憩商人|整备商人|整備商人/ })
      .click();
    await fits(page, '.rest-market');
    const text = await page.locator('.rest-market').innerText();
    if (locale !== 'ko') expect(text).not.toMatch(/[가-힣]/);
    await page.screenshot({ path: `${proof}/market-${locale}.png` });
    await page.keyboard.press('Escape');
    await expect(
      page
        .locator('.intermission-actions button')
        .filter({ hasText: /정비 상인|Rest Merchant|休憩商人|整备商人|整備商人/ }),
    ).toBeFocused();
    await page.locator('.intermission-actions button').first().click();
    const sword = fixture().run!.fighter.items[0].id;
    await page.locator(`[data-item-id="${sword}"]`).click();
    await fits(page, '.inventory-workspace');
    if (locale !== 'ko')
      expect(await page.locator('.item-detail').innerText()).not.toMatch(/[가-힣]/);
    await page.screenshot({ path: `${proof}/refine-${locale}.png` });
    await context.close();
    const finalContext = await browser.newContext({
      locale,
      viewport: { width: 1093, height: 614 },
    });
    const finalPage = await finalContext.newPage();
    const final = fixture(20);
    final.run!.phase = 'loot';
    final.run!.enemies = [];
    final.run!.fighter.items = final.run!.fighter.items.filter((item) =>
      ['weapon', 'general'].includes(item.place),
    );
    await seed(finalPage, final);
    await finalPage.locator('.inventory-controls > .primary').click();
    await expect(finalPage.locator('.journey-summary')).toBeVisible();
    await fits(finalPage, '.journey-summary');
    if (locale !== 'ko')
      expect(await finalPage.locator('.journey-summary').innerText()).not.toMatch(/[가-힣]/);
    await finalPage.screenshot({ path: `${proof}/victory-${locale}.png` });
    await finalPage.keyboard.press('Escape');
    await finalPage.locator('.home-nav button').nth(3).click();
    await expect(finalPage.locator('.home-records')).toBeVisible();
    await fits(finalPage, '.journey-records');
    await finalPage.screenshot({ path: `${proof}/records-${locale}.png` });
    await finalContext.close();
  }
});
