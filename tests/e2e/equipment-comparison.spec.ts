import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { xpThreshold } from '../../src/domain/content';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeLootItem } from '../../src/domain/items';
import type { BoundFighter, GameState } from '../../src/domain/model';
import { messages } from '../../src/platform/messages';

const proof = 'docs/verification/projectiles-comparison-v1';
test('작은 품질 차이를 소수점 비교로 읽고 착용 후 저장·재개한다', async ({ page }) => {
  const s = fixture();
  const f = s.run!.fighter;
  f.items = f.items.filter((i) => !['old-robe', 'new-robe'].includes(i.id));
  f.items.push(makeLootItem('gear-robe-0', 'old-robe', 'equipped', 70));
  f.items.push(makeLootItem('gear-robe-0', 'new-robe', 'ground', 90));
  await seed(page, s);
  await selectItem(page, 'new-robe');
  await expect(page.locator('.equipment-comparison strong')).toHaveText('+0.2');
  await expect(page.locator('.comparison-values')).toContainText('0.7');
  await expect(page.locator('.comparison-values')).toContainText('0.9');
  await fits(page);
  await mkdir('docs/verification/balance-v2', { recursive: true });
  await page.screenshot({ path: 'docs/verification/balance-v2/decimal-comparison.png' });
  await page.getByRole('button', { name: '착용', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.items.find(i => i.id === 'new-robe')?.power).toBe(0.9);
  await page.reload();
  await expect(page.locator('.equipped-list [data-item-id="new-robe"]')).toBeVisible();
});
function fixture() {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  r.phase = 'loot';
  r.enemies = [];
  r.wave = 3;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  r.offers = [];
  f.arts = ['samja', 'wudang', 'huashan', 'tianmo'].map((id) => ({
    id: id as 'samja',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [
    makeLootItem('weapon-sword-0', 'old', 'weapon'),
    { ...makeLootItem('weapon-sword-1', 'second', 'weapon'), x: 1 },
    { ...makeLootItem('weapon-dao-0', 'dao', 'weapon'), x: 3 },
    makeLootItem('gear-robe-0', 'old-robe', 'equipped'),
    makeLootItem('gear-boots-0', 'old-boots', 'equipped'),
    makeLootItem('gear-charm-2', 'old-charm', 'equipped'),
    makeLootItem('weapon-sword-2', 'candidate', 'ground'),
    makeLootItem('gear-robe-2', 'new-robe', 'ground'),
    makeLootItem('gear-boots-2', 'new-boots', 'ground'),
    makeLootItem('gear-charm-0', 'new-charm', 'ground'),
  ];
  f.bindings = { samja: 'old', wudang: 'second', huashan: 'old', tianmo: 'dao' };
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

async function selectItem(page: Page, id: string) {
  const item = page.locator(`[data-item-id="${id}"]`);
  if (!(await item.count())) {
    const back = page.locator('.ground-section .item-pagination button').first();
    while ((await back.count()) && (await back.isEnabled())) await back.click();
    const next = page.locator('.ground-section .item-pagination button').last();
    for (let n = 0; n < 10 && !(await item.count()) && (await next.isEnabled()); n++)
      await next.click();
  }
  await item.click();
}
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'] as const) {
  for (const [width, height] of [
    [1440, 900],
    [1366, 768],
    [1093, 614],
    ...(locale === 'ko'
      ? [
          [1000, 500],
          [800, 600],
          [390, 600],
        ]
      : []),
  ]) {
    test(`착용 전 비교·연결 대상 선택·저장 ${locale} ${width}×${height}`, async ({ page }) => {
      await mkdir(proof, { recursive: true });
      await page.setViewportSize({ width, height });
      await page.addInitScript(
        (locale) => localStorage.setItem('mugong-language-v1', locale),
        locale,
      );
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await seed(page, fixture());
      await expect(page.locator('.inventory-workspace')).toBeVisible();
      await page.locator('[data-item-id="candidate"]').click();
      const compare = page.locator('.equipment-comparison');
      await expect(compare.locator('strong')).toHaveText('+6.0');
      await expect(compare.locator('select')).toHaveValue('samja,huashan');
      await compare.locator('select').selectOption('wudang');
      await expect(compare.locator('strong')).toHaveText('+3.0');
      await fits(page);
      await page.screenshot({ path: `${proof}/weapon-${locale}-${width}.png` });
      await selectItem(page, 'new-boots');
      await expect(compare.locator('strong')).toHaveText('+6.1%');
      await fits(page);
      await selectItem(page, 'new-charm');
      await expect(compare.locator('strong')).toHaveText('−4.0');
      await fits(page);
      await selectItem(page, 'new-robe');
      await expect(compare.locator('strong')).toHaveText('+2.0');
      await fits(page);
      await page.screenshot({ path: `${proof}/gear-${locale}-${width}.png` });
      const index = ['en', 'ja', 'zh-CN', 'zh-TW'].indexOf(locale);
      await page
        .getByRole('button', {
          name: locale === 'ko' ? '착용' : messages['착용'][index],
          exact: true,
        })
        .click();
      await expect(page.locator('.equipped-list [data-item-id="new-robe"]')).toBeVisible();
      await expect(page.locator('.bag-grid.general [data-item-id="old-robe"]')).toBeVisible();
      await expect(compare).toHaveCount(0);
      await expect
        .poll(
          async () =>
            (await saved(page)).run!.fighter.items.find((i) => i.id === 'new-robe')?.place,
        )
        .toBe('equipped');
      await page.locator('[data-item-id="old-robe"]').click();
      await expect(compare.locator('strong')).toHaveText('−2.0');
      await fits(page);
      expect(errors).toEqual([]);
    });
  }
}
