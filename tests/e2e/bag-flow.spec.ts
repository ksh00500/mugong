import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { makeItem, makeWeapon, xpThreshold } from '../../src/domain/content';
import { emptyGame, startRun } from '../../src/domain/game';
import type { BoundFighter, GameState } from '../../src/domain/model';
import { inventoryMessages } from '../../src/platform/inventory-messages';

const proof = 'docs/verification/bag-flow-v1';
function fixture(loot = false) {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  r.regionRoute = ['청하현', '독무곡', '천검산', '설산'];
  r.wave = 3;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.arts = ['samja', 'wudang', 'huashan'].map((id) => ({
    id: id as 'samja' | 'wudang' | 'huashan',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [
    makeWeapon('sword', 'first', 'weapon'),
    { ...makeWeapon('sword', 'better', 'weapon'), x: 2 },
    { ...makeWeapon('dao', 'wrong', 'weapon'), x: 2, y: 4 },
    makeItem('medicine', 'medicine', 'general'),
  ];
  f.bindings = { samja: 'first', wudang: 'first', huashan: 'first' };
  r.offers = [];
  r.enemies = [
    { ...r.enemies[0], x: f.x + 75, y: f.y, hp: 1, maxHp: 1, xp: 0, state: 'recover', timer: 200 },
  ];
  if (loot) {
    r.phase = 'loot';
    r.enemies = [];
    f.items.push({ ...makeItem('ore', 'ground', 'ground'), count: 3 });
  }
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
async function fits(page: Page) {
  const size = page.viewportSize()!;
  for (const box of await page
    .locator('.bag-grid,.inventory-character,.inventory-tray,.inventory-controls button,.art-bind')
    .evaluateAll((elements) =>
      elements
        .filter((e) => e.getClientRects().length)
        .map((e) => e.getBoundingClientRect().toJSON()),
    )) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(size.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(size.height + 1);
  }
  const parent = await page
    .locator('.inventory-workspace')
    .evaluate((e) => ({ h: e.clientHeight, s: e.scrollHeight }));
  expect(parent.s).toBeLessThanOrEqual(parent.h + 2);
  const issues = await page.locator('.inventory-workspace').evaluate((root) => {
    const errors: string[] = [];
    for (const button of root.querySelectorAll<HTMLElement>('button'))
      if (button.getClientRects().length && button.scrollWidth > button.clientWidth + 2)
        errors.push(`${button.className}: text overflow`);
    const areas = [
      ...root.querySelectorAll<HTMLElement>(
        '.bag-grid,.inventory-character,.item-detail,.inventory-tray',
      ),
    ];
    for (let i = 0; i < areas.length; i++)
      for (let j = i + 1; j < areas.length; j++) {
        const a = areas[i].getBoundingClientRect(),
          b = areas[j].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        )
          errors.push(`${areas[i].className} overlaps ${areas[j].className}`);
      }
    return errors;
  });
  if (issues.length) await page.screenshot({ path: `${proof}/layout-failure.png` });
  expect(issues).toEqual([]);
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`전투 중 연결·실제 처치·자동 가방·자동 정리·다음 웨이브 ${width}×${height}`, async ({
    page,
  }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = fixture();
    await seed(page, state);
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(1);
    await page.keyboard.up('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.locator('[data-item-id="wrong"]').click();
    await expect(page.locator('.art-bind')).toHaveCount(0);
    await page.locator('[data-item-id="better"]').click();
    const link = page.getByRole('button', { name: '삼재검법에 선택한 무기 연결', exact: true });
    await link.click();
    await expect(link).toHaveAttribute('aria-pressed', 'true');
    await expect(link).toHaveText('연결됨');
    await expect
      .poll(async () => ((await saved(page)).run!.fighter as BoundFighter).bindings?.samja)
      .toBe('better');
    await expect(page.getByRole('button', { name: '자동 정리', exact: true })).toBeDisabled();
    await fits(page);
    await page.screenshot({ path: `${proof}/linked-${width}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    const canvas = page.locator('.game-canvas canvas'),
      box = (await canvas.boundingBox())!,
      f = state.run!.fighter;
    await canvas.click({
      position: { x: (box.width * (f.x + 75)) / 1920, y: (box.height * f.y) / 1080 },
    });
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await expect(page.locator('.intermission')).toHaveCount(0);
    const before = (await saved(page)).run!.fighter.items.reduce(
      (sum, item) => sum + item.count,
      0,
    );
    await page.getByRole('button', { name: '자동 정리', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await saved(page)).run!.fighter.items.filter(
            (i) => i.place === 'ground',
          ).length,
      )
      .toBe(0);
    const after = (await saved(page)).run!.fighter as BoundFighter;
    expect(after.items.reduce((sum, item) => sum + item.count, 0)).toBe(before);
    expect(after.bindings?.samja).toBe('better');
    await fits(page);
    await page.screenshot({ path: `${proof}/stowed-${width}.png`, animations: 'disabled' });
    await page.getByRole('button', { name: '다음 4웨이브 →', exact: true }).click();
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    await expect(page.locator('.intermission')).toBeVisible();
    await expect.poll(async () => (await saved(page)).run!.phase).toBe('prep');
    expect(errors).toEqual([]);
  });
}
test('공간 부족 전리품은 유지하고 진행 확인은 가방 위에서 열리며 취소 후 가방으로 복귀한다', async ({
  page,
}) => {
  const state = fixture(true),
    f = state.run!.fighter;
  f.items = [
    f.items[0],
    ...Array.from({ length: 79 }, (_, n) => ({
      ...makeItem('ore', `ore-${n}`, 'general'),
      x: n % 10,
      y: Math.floor(n / 10),
    })),
    { ...makeItem('medicine', 'remaining', 'ground'), count: 3 },
  ];
  await seed(page, state);
  await page.getByRole('button', { name: '자동 정리', exact: true }).click();
  await expect
    .poll(
      async () => (await saved(page)).run!.fighter.items.find((i) => i.id === 'remaining')!.count,
    )
    .toBe(2);
  await page.getByRole('button', { name: '다음 4웨이브 →', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '남은 물품 확인', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '돌아가서 챙기기' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.getByRole('button', { name: '다음 4웨이브 →', exact: true }).click();
  await dialog.getByRole('button', { name: '남은 물품 두고 진행' }).click();
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await expect.poll(async () => (await saved(page)).run!.wave).toBe(4);
});
test('20웨이브 전리품은 가방에서 정리 후 귀환하고 명부에 저장된다', async ({ page }) => {
  const state = fixture(true);
  state.run!.wave = 20;
  await seed(page, state);
  await page.getByRole('button', { name: '자동 정리', exact: true }).click();
  const back = page.getByRole('button', { name: '귀환', exact: true });
  await expect(back).toBeEnabled();
  await back.click();
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await expect(page.locator('.home-scene')).toBeVisible();
  await expect.poll(async () => (await saved(page)).family.roster.length).toBe(1);
  expect((await saved(page)).run).toBeNull();
});
test('자동 정리와 연결 상태는 다섯 언어·작은 화면에서 버튼을 숨기지 않는다', async ({
  browser,
}) => {
  test.setTimeout(120000);
  await mkdir(proof, { recursive: true });
  for (const [index, locale] of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'].entries()) {
    const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
    const page = await context.newPage();
    await seed(page, fixture(true));
    await page.locator('[data-item-id="better"]').click();
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(1);
    await page.keyboard.up('Shift');
    await page.locator('.art-bind').first().click();
    const text = await page.locator('.inventory-workspace').innerText();
    if (locale !== 'ko') expect(text).not.toMatch(/[가-힣]/);
    const arrange = index ? inventoryMessages['자동 정리'][index - 1] : '자동 정리';
    await expect(page.getByRole('button', { name: arrange, exact: true })).toBeEnabled();
    await fits(page);
    await page.screenshot({ path: `${proof}/locale-${locale}.png`, animations: 'disabled' });
    await context.close();
  }
});
