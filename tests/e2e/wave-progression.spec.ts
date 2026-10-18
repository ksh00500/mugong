import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { makeItem, makeWeapon, xpThreshold } from '../../src/domain/content';
import { emptyGame, startRun } from '../../src/domain/game';
import type { BoundFighter, GameState } from '../../src/domain/model';

const proof = process.env.MUGONG_DAYTONA_PROOF
  ? `${process.env.MUGONG_DAYTONA_PROOF}/wave-progression`
  : 'docs/verification/wave-progression-v1';
function fixture() {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const run = state.run!,
    f = run.fighter as BoundFighter;
  run.wave = 1;
  run.phase = 'loot';
  run.enemies = [];
  run.offers = [];
  f.level = f.spent = run.spent = 16;
  f.xp = xpThreshold(16);
  f.arts = ['samja', 'wudang', 'huashan', 'tianmo'].map((id) => ({
    id: id as 'samja',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [makeWeapon('sword', 'sword', 'weapon'), makeItem('medicine', 'medicine', 'general')];
  f.bindings = { samja: 'sword', wudang: 'sword', huashan: 'sword' };
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
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
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect(page.locator('.inventory-next')).toBeEnabled();
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
async function fits(page: Page, bag = true) {
  const errors = await page.evaluate((bag) => {
    const scope = document.querySelector(bag ? '.inventory-workspace' : '.wave-ready')!;
    const errors: string[] = [];
    if (scope.scrollHeight > scope.clientHeight + 2) errors.push('workspace scrolls');
    for (const element of scope.querySelectorAll<HTMLElement>(
      bag
        ? '.bag-grid,.inventory-character,.item-detail,.inventory-tray,.inventory-status,button'
        : 'h2,button',
    )) {
      if (!element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      if (
        rect.x < -1 ||
        rect.y < -1 ||
        rect.right > innerWidth + 1 ||
        rect.bottom > innerHeight + 1
      )
        errors.push(`${element.className} outside viewport`);
      if (element.tagName === 'BUTTON' && element.scrollWidth > element.clientWidth + 2)
        errors.push(`${element.className} text overflow`);
    }
    const regions = [
      ...scope.querySelectorAll<HTMLElement>(
        bag
          ? '.bag-grid,.inventory-character,.item-detail,.inventory-tray,.inventory-status'
          : 'h2,.wave-ready-actions',
      ),
    ];
    for (let i = 0; i < regions.length; i++)
      for (let j = i + 1; j < regions.length; j++) {
        const a = regions[i].getBoundingClientRect(),
          b = regions[j].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        )
          errors.push(`${regions[i].className} overlaps ${regions[j].className}`);
      }
    return errors;
  }, bag);
  expect(errors).toEqual([]);
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  for (const locale of ['ko-KR', 'en-US', 'ja-JP', 'zh-CN', 'zh-TW']) {
    test(`가방과 필드에서 큰 진행 버튼·키보드 진행 ${width}×${height} ${locale}`, async ({
      browser,
    }) => {
      await mkdir(proof, { recursive: true });
      const context = await browser.newContext({ viewport: { width, height }, locale });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await seed(page, fixture());
      const size = await page.locator('.inventory-next').evaluate((e) => ({
        ...e.getBoundingClientRect().toJSON(),
        font: parseFloat(getComputedStyle(e).fontSize),
      }));
      expect(size.width).toBeGreaterThanOrEqual(240);
      expect(size.height).toBeGreaterThanOrEqual(60);
      expect(size.font).toBeGreaterThanOrEqual(24);
      await page.locator('[data-item-id="medicine"]').click();
      await fits(page);
      if (locale === 'ko-KR' || width === 1093)
        await page.screenshot({
          path: `${proof}/bag-${width}-${locale}.png`,
          animations: 'disabled',
        });
      await page.keyboard.press('Escape');
      await expect(page.locator('.inventory-workspace')).toHaveCount(0);
      await expect(page.locator('.wave-ready')).toBeVisible();
      await expect(page.locator('.intermission')).toHaveCount(0);
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      expect((await saved(page)).run!.wave).toBe(1);
      expect((await saved(page)).run!.phase).toBe('loot');
      await fits(page, false);
      if (locale !== 'ko-KR')
        expect(await page.locator('.wave-ready').innerText()).not.toMatch(/[가-힣]/);
      if (locale === 'ko-KR' || width === 1093)
        await page.screenshot({
          path: `${proof}/field-${width}-${locale}.png`,
          animations: 'disabled',
        });
      await page.locator('.wave-ready-actions button').first().click();
      await expect(page.locator('.inventory-workspace')).toBeVisible();
      await expect(page.locator('.wave-ready')).toBeHidden();
      await page.locator('.dialog-header button[aria-label]').click();
      await expect(page.locator('.wave-ready')).toBeVisible();
      await expect(page.locator('.wave-ready-actions button').first()).toBeFocused();
      const next = page.locator('.wave-ready-actions .primary');
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('.wave-ready')).toHaveCount(0);
      await expect.poll(async () => (await saved(page)).run!.wave).toBe(2);
      expect((await saved(page)).run!.phase).toBe('combat');
      expect((await saved(page)).run!.enemies.length).toBeGreaterThan(0);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}
test('필드 진행도 남은 전리품을 확인하고 취소하면 가방으로 돌아온다', async ({ page }) => {
  const state = fixture();
  state.run!.fighter.items.push(makeItem('ore', 'ground-ore', 'ground'));
  await seed(page, state);
  await page.keyboard.press('Escape');
  await page.locator('.wave-ready-actions .primary').focus();
  await page.keyboard.press('Space');
  const dialog = page.getByRole('dialog', { name: '남은 물품 확인', exact: true });
  await expect(dialog).toBeVisible();
  expect((await saved(page)).run!.fighter.items.some((item) => item.id === 'ground-ore')).toBe(
    true,
  );
  await dialog.getByRole('button', { name: '돌아가서 챙기기' }).click();
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.wave-ready-actions .primary').click();
  await dialog.getByRole('button', { name: '남은 물품 두고 진행' }).click();
  await expect.poll(async () => (await saved(page)).run!.wave).toBe(2);
  expect((await saved(page)).run!.fighter.items.some((item) => item.id === 'ground-ore')).toBe(
    false,
  );
});
test('20웨이브에서 가방을 닫아도 귀환하여 무인과 수납 물품을 저장한다', async ({ page }) => {
  const state = fixture();
  state.run!.wave = 20;
  await seed(page, state);
  await page.keyboard.press('Escape');
  await expect(page.locator('.wave-ready h2')).toHaveText('강호 완주');
  await page.locator('.wave-ready').getByRole('button', { name: '귀환', exact: true }).click();
  await expect(page.locator('.home-scene')).toBeVisible();
  await expect.poll(async () => (await saved(page)).family.roster.length).toBe(1);
  const stateAfter = await saved(page);
  expect(stateAfter.run).toBeNull();
  expect(stateAfter.family.roster[0].items.map((item) => item.id).sort()).toEqual([
    'medicine',
    'sword',
  ]);
});
test('전투와 일시정지 상태에서는 완료 배너를 표시하지 않는다', async ({ page }) => {
  await seed(page, fixture());
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  await expect(page.locator('.wave-ready')).toBeHidden();
  await page.getByRole('button', { name: '계속하기', exact: true }).click();
  await expect(page.locator('.wave-ready')).toBeVisible();
  await page.locator('.wave-ready-actions .primary').click();
  await expect(page.locator('.wave-ready')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect(page.locator('.inventory-next')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.wave-ready')).toHaveCount(0);
});
for (const [width, height] of [
  [800, 600],
  [390, 600],
]) {
  test(`좁은 화면에서도 가방과 필드의 진행 행동은 화면 안에 표시된다 ${width}×${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await seed(page, fixture());
    await page.locator('[data-item-id="medicine"]').click();
    await fits(page);
    expect((await page.locator('.inventory-next').boundingBox())!.height).toBeGreaterThanOrEqual(
      44,
    );
    await page.keyboard.press('Escape');
    await expect(page.locator('.wave-ready')).toBeVisible();
    await fits(page, false);
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/field-${width}-ko-KR.png`, animations: 'disabled' });
    await page.locator('.wave-ready-actions .primary').click();
    await expect.poll(async () => (await saved(page)).run!.wave).toBe(2);
  });
}
