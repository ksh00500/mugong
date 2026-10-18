import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { makeWeapon, xpThreshold } from '../../src/domain/content';
import { emptyGame, startRun } from '../../src/domain/game';
import type { BoundFighter, GameState } from '../../src/domain/model';

const proof = 'docs/verification/support-v1';
function fixture(growth = true) {
  const state = emptyGame();
  startRun(state, '보조 검증', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  f.level = 12;
  f.xp = xpThreshold(12);
  f.spent = r.spent = growth ? 11 : 12;
  f.arts = [
    { id: 'samja', level: 3, gauge: 0, combo: 0, defenseCd: 0 },
    { id: 'huashan', level: growth ? 1 : 4, gauge: 0, combo: 0, defenseCd: 0 },
    { id: 'tang', level: growth ? 3 : 4, gauge: 0, combo: 0, defenseCd: 0 },
    { id: 'wudang', level: 1, gauge: 0, combo: 0, defenseCd: 0 },
  ];
  f.items = [makeWeapon('sword', 'support-sword', 'weapon')];
  f.bindings = { samja: 'support-sword', huashan: 'support-sword', wudang: 'support-sword' };
  r.offers = growth
    ? [
        { art: 'huashan', type: 'upgrade' },
        { art: 'tang', type: 'upgrade' },
        { art: 'samja', type: 'upgrade' },
      ]
    : [];
  r.enemies.forEach((e) => {
    e.hp = e.maxHp = 100000;
    e.state = 'recover';
    e.timer = 200;
  });
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
async function fits(page: Page, selector: string) {
  const viewport = page.viewportSize()!;
  for (const box of await page
    .locator(selector)
    .evaluateAll((elements) => elements.map((e) => e.getBoundingClientRect().toJSON()))) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.bottom).toBeLessThanOrEqual(viewport.height + 1);
  }
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`2성·4성 성장 선택·Shift 보조 정보·저장 ${width}×${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page, fixture());
    const card = page.locator('.choice-card[data-technique="tang"]');
    await expect(card).toBeEnabled();
    await expect(page.locator('.choice-type').filter({ hasText: '보조 효과 해금' })).toHaveCount(3);
    await expect(page.locator('.choice-skill').first()).toHaveText('공격 간격 8% 감소');
    await card.hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await fits(page, '.choice-card,.choose-label');
    await page.screenshot({ path: `${proof}/growth-${width}.png`, animations: 'disabled' });
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toContainText('2성 · 모든 기본 공격에 독 부여');
    await expect(page.getByRole('tooltip')).toContainText('4성 · 독 최대 5중첩');
    await fits(page, '.quick-details');
    await page.screenshot({ path: `${proof}/details-${width}.png`, animations: 'disabled' });
    await page.keyboard.up('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await card.click();
    await expect(page.locator('.choice-card')).toHaveCount(0);
    await expect
      .poll(async () => (await saved(page)).run!.fighter.arts.find((a) => a.id === 'tang')!.level)
      .toBe(4);
    await page.keyboard.press('Tab');
    await page.locator('.binding-list [data-technique="tang"]').click();
    await expect(page.getByRole('tooltip')).toContainText('4성 · 독 최대 5중첩');
    await fits(page, '.inventory-workspace,.quick-details');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
test('보조 설명은 다섯 언어에서 표시되고 무공 전환·재실행으로 중첩되지 않는다', async ({
  browser,
}) => {
  test.setTimeout(150000);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
    const page = await context.newPage();
    await seed(page, fixture(false));
    await page.locator('.fan-card.selected').hover();
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toBeVisible();
    const text = await page.getByRole('tooltip').innerText();
    if (locale !== 'ko') expect(text).not.toMatch(/[가-힣]/);
    await fits(page, '.quick-details');
    await page.keyboard.up('Shift');
    await page.keyboard.press('e');
    await expect(page.locator('.fan-card.selected')).toHaveAttribute('data-technique', 'huashan');
    await page.locator('.fan-card.selected').hover();
    await page.keyboard.down('Shift');
    await expect(page.locator('.quick-details-support small')).toHaveCount(2);
    await page.keyboard.up('Shift');
    await page.keyboard.press('q');
    await expect(page.locator('.fan-card.selected')).toHaveAttribute('data-technique', 'samja');
    await expect.poll(async () => (await saved(page)).run!.fighter.active).toBe(0);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    await page.locator('.fan-card.selected').hover();
    await page.keyboard.down('Shift');
    await expect(page.locator('.quick-details-support small')).toHaveCount(1);
    await context.close();
  }
});

test('긴 보조 보상도 다섯 언어의 1093×614 성장 카드에서 선택 버튼을 밀어내지 않는다', async ({
  browser,
}) => {
  test.setTimeout(120000);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
    const page = await context.newPage();
    await seed(page, fixture());
    await expect(page.locator('.choice-card').first()).toBeEnabled();
    await fits(page, '.choice-card,.choose-label,.growth-note');
    const contents = await page.locator('.choice-card').allTextContents();
    if (locale !== 'ko') for (const text of contents) expect(text).not.toMatch(/[가-힣]/);
    for (const sizes of await page
      .locator('.choice-skill,.choose-label')
      .evaluateAll((elements) =>
        elements.map((e) => ({
          width: e.clientWidth,
          scrollWidth: e.scrollWidth,
          height: e.clientHeight,
          scrollHeight: e.scrollHeight,
        })),
      )) {
      expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width + 1);
      expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.height + 1);
    }
    await page.screenshot({ path: `${proof}/growth-${locale}-1093.png`, animations: 'disabled' });
    await context.close();
  }
});
