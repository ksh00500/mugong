import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { ART_WEAPONS, makeWeapon, xpThreshold } from '../../src/domain/content';
import { emptyGame, spawnWave, startRun } from '../../src/domain/game';
import { firstSpace } from '../../src/domain/inventory';
import type { ArtId, BoundFighter, GameState } from '../../src/domain/model';

const proof = 'docs/verification/content-expansion-v1';
const arts: ArtId[] = ['tang', 'shaolin', 'gaebang', 'jegal'];
function fixture() {
  const state = emptyGame(); startRun(state, '검증 무인', 123);
  const r = state.run!, f = r.fighter as BoundFighter;
  r.wave = 5; r.regionRoute = ['독무곡', '청하현', '천검산', '설산'];
  f.level = 16; f.xp = xpThreshold(16); f.spent = r.spent = 16;
  f.arts = arts.map((id) => ({ id, level: 5, gauge: id === 'gaebang' ? 200 : 100, combo: 0, defenseCd: 0 }));
  f.items = []; f.bindings = {};
  for (const id of arts) {
    const item = makeWeapon(ART_WEAPONS[id], `fixture-${id}`, 'weapon');
    Object.assign(item, firstSpace(f.items, item, 'weapon')); f.items.push(item); f.bindings[id] = item.id;
  }
  spawnWave(r); r.enemies.forEach((e) => { e.hp = e.maxHp = 100000; e.timer = 200; e.state = 'windup'; });
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => { const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result); });
    await new Promise<void>((resolve) => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(state, 'current'); tx.oncomplete = () => resolve(); });
    db.close();
  }, state);
  await page.reload(); await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
}
async function fits(page: Page, selector: string) {
  const viewport = page.viewportSize()!;
  const boxes = await page.locator(selector).evaluateAll((els) => els.map((el) => ({ ...el.getBoundingClientRect().toJSON(), scroll: el.scrollHeight, height: el.clientHeight })));
  for (const b of boxes) {
    expect(b.x).toBeGreaterThanOrEqual(-1); expect(b.y).toBeGreaterThanOrEqual(-1);
    expect(b.right).toBeLessThanOrEqual(viewport.width + 1); expect(b.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(b.scroll).toBeLessThanOrEqual(b.height + 2);
  }
  return boxes;
}

for (const [width, height] of [[1440, 900], [1366, 768], [1093, 614]]) {
  test(`새 네 무공 HUD·상세·가방 ${width}×${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await seed(page, fixture());
    await expect(page.locator('.boss-panel b')).toHaveText('청린사왕');
    await expect(page.locator('.fan-card')).toHaveCount(4);
    await page.locator('.fan-card.selected').hover(); await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.keyboard.down('Shift'); await expect(page.getByRole('tooltip')).toContainText('독은 최대 5중첩');
    await fits(page, '.quick-details'); await page.keyboard.up('Shift'); await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.keyboard.press('Space'); await expect(page.locator('.defense-slot.active .cooldown-dial b')).toHaveText(/2\.[0-8]/);
    await page.getByRole('button', { name: '개방취봉법 전환', exact: true }).click();
    await expect(page.locator('.ultimate-heading')).toContainText('200 / 200');
    const canvas = page.locator('.game-canvas canvas');
    await canvas.click({ button: 'right', position: { x: width * 0.52, y: height * 0.45 } });
    await expect(page.locator('.ultimate-heading')).toContainText('100 / 200');
    await expect(page.locator('.ultimate-panel small')).toContainText('1/2');
    await page.waitForTimeout(250);
    await canvas.click({ button: 'right', position: { x: width * 0.52, y: height * 0.45 } });
    await expect(page.locator('.ultimate-heading')).toContainText('0 / 200');
    const bounds = await fits(page, '.player-panel,.boss-panel,.progress-panel,.art-fan,.ultimate-panel,.defense-panel');
    await page.screenshot({ path: `${proof}/new-arts-${width}x${height}.png`, animations: 'disabled' });
    await page.keyboard.press('Tab'); await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
    await expect(page.locator('.bag-grid')).toHaveCount(2);
    await expect(page.locator('.bag-grid .item-tile')).toHaveCount(4);
    await fits(page, '.inventory-workspace,.inventory-character,.inventory-tray');
    await page.screenshot({ path: `${proof}/new-weapons-${width}x${height}.png`, animations: 'disabled' });
    await page.keyboard.press('Escape'); await expect(page.locator('.inventory-workspace')).toHaveCount(0);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    expect(errors).toEqual([]);
    await writeFile(`${proof}/new-arts-${width}x${height}.json`, JSON.stringify({ bounds, errors }, null, 2));
  });
}

test('새 보스·무공·설명은 다섯 언어에서 번역되고 작은 화면을 벗어나지 않는다', async ({ browser }) => {
  test.setTimeout(150000);
  for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
    const context = await browser.newContext({ locale, viewport: { width: 1093, height: 614 } });
    const page = await context.newPage();
    await seed(page, fixture());
    await page.locator('.fan-card.selected').hover(); await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toBeVisible(); await fits(page, '.quick-details');
    const text = await page.locator('.boss-panel,.quick-details').allTextContents();
    if (locale !== 'ko') for (const label of text) expect(label).not.toMatch(/[가-힣]/);
    await page.keyboard.up('Shift'); await page.screenshot({ path: `${proof}/locale-${locale}.png` });
    await context.close();
  }
});
