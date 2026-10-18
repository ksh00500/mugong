import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { emptyGame, spawnWave, startRun } from '../../src/domain/game';
import { bossReward } from '../../src/domain/boss-loot';
import { xpThreshold } from '../../src/domain/content';
import type { EncounterObject, GameState } from '../../src/domain/model';

const proof = 'docs/verification/boss-encounters-v2';
function fixture(loot = false) {
  const state = emptyGame();
  startRun(state, '검증 무인', 456);
  const r = state.run!,
    f = r.fighter;
  r.regionRoute = ['청하현', '독무곡', '고묘', '설산'];
  r.wave = 15;
  spawnWave(r);
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  r.offers = [];
  Object.assign(r.enemies[0], {
    hp: 100000,
    maxHp: 100000,
    x: 960,
    y: 300,
    timer: 1000,
    skillClock: 0,
  });
  const kinds: EncounterObject['kind'][] = ['wall', 'flag', 'herb', 'turret', 'chest', 'ice'];
  r.encounterObjects = kinds.map((kind, n) => ({
    id: n + 1,
    owner: r.enemies[0].id,
    kind,
    x: 380 + n * 230,
    y: 460,
    radius: 45,
    warning: 0,
    life: 100,
    hp: 40,
    maxHp: 40,
    pulse: 100,
    aim: 0,
  }));
  r.encounterSeq = 6;
  if (loot) {
    r.phase = 'loot';
    r.encounterObjects = [];
  }
  f.items.push(
    bossReward('1-1', 'poison-sac')!,
    bossReward('1-4', 'poison-pearl')!,
    bossReward('0-3', 'chain-charm')!,
  );
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
}
async function fits(page: Page, selectors: string) {
  const view = page.viewportSize()!;
  for (const box of await page
    .locator(selectors)
    .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(view.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(view.height + 1);
  }
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`보스 소품·HUD 실제 렌더 ${width}×${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const failed: string[] = [];
    page.on('requestfailed', (request) => failed.push(request.url()));
    await seed(page, fixture());
    await expect(page.locator('.boss-panel b')).toHaveText('기관장인 곽기');
    await expect(page.locator('.field-caption')).toHaveText('공격으로 파괴 가능');
    await fits(
      page,
      '.player-panel,.boss-panel,.progress-panel,.field-caption,.art-fan,.ultimate-panel,.defense-panel',
    );
    await page.screenshot({
      path: `${proof}/props-${width}x${height}.png`,
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });

test('고유 전리품은 출처와 효과를 표시하고 버튼·키보드로 수납·착용한 뒤 저장 복원된다', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, fixture(true));
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.locator('[data-item-id="poison-sac"]').click();
  await expect(page.locator('.item-detail')).toContainText('청린사왕의 전리품');
  await page.getByRole('button', { name: '수납', exact: true }).click();
  await expect(page.locator('.bag-grid [data-item-id="poison-sac"]')).toBeVisible();
  await page.locator('[data-item-id="poison-pearl"]').click();
  await expect(page.locator('.item-detail')).toContainText('만독곡주 사공염의 전리품');
  await page.getByRole('button', { name: '수납', exact: true }).click();
  await expect(page.locator('.bag-grid [data-item-id="poison-pearl"]')).toBeVisible();
  await page.locator('[data-item-id="chain-charm"]').focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '착용', exact: true }).click();
  await expect(page.locator('.item-detail')).toContainText('착용 중');
  await fits(page, '.inventory-workspace,.item-detail,.inventory-tray');
  await page.screenshot({ path: `${proof}/named-loot-1093x614.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.bag-grid [data-item-id="poison-sac"]')).toBeVisible();
  await expect(page.locator('.bag-grid [data-item-id="poison-pearl"]')).toBeVisible();
});

test('전용 전리품 출처와 이름은 다섯 언어에서 번역된다', async ({ browser }) => {
  test.setTimeout(150000);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    const context = await browser.newContext({
      locale,
      viewport: { width: 1093, height: 614 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await seed(page, fixture(true));
    await page.locator('[data-item-id="chain-charm"]').click();
    const text = await page.locator('.item-detail').innerText();
    if (locale !== 'ko') expect(text).not.toMatch(/[가-힣]/);
    await fits(page, '.item-detail,.inventory-workspace');
    await page.screenshot({ path: `${proof}/loot-${locale}.png`, animations: 'disabled' });
    await context.close();
  }
});
