import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { command, emptyGame, startRun } from '../../src/domain/game';
import { ART_IDS, makeItem } from '../../src/domain/content';
import type { BoundFighter, GameState } from '../../src/domain/model';

const proof = `docs/verification/inventory-summary-v5/${process.env.MUGONG_DAYTONA_URL ? 'public' : 'local'}`;
test.beforeEach(async () => {
  await mkdir(proof, { recursive: true });
});
function fixture() {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const run = state.run!;
  run.wave = 20;
  run.phase = 'loot';
  run.enemies = [];
  run.fighter.arts = ART_IDS.slice(0, 4).map((id) => ({
    id,
    level: 5,
    gauge: 75,
    combo: 0,
    defenseCd: 0,
  }));
  run.fighter.hp = 80;
  run.fighter.items = [
    makeItem('sword', 'sword', 'weapon'),
    { ...makeItem('medicine', 'medicine', 'general'), x: 0, y: 0, count: 3 },
    makeItem('robe', 'robe', 'equipped'),
    makeItem('boots', 'boots', 'equipped'),
    makeItem('charm', 'charm', 'equipped'),
    { ...makeItem('ore', 'ore', 'general'), x: 4, y: 0 },
  ];
  (run.fighter as BoundFighter).bindings = Object.fromEntries(
    ART_IDS.slice(0, 4).map((id) => [id, 'sword']),
  );
  command(state, { type: 'next' });
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.home-scene')).toBeVisible();
}
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const req = indexedDB.open('mugong-local-v1', 1);
      req.onsuccess = () => resolve(req.result);
    });
    return new Promise<GameState>((resolve) => {
      const req = db.transaction('saves').objectStore('saves').get('current');
      req.onsuccess = () => {
        resolve(req.result);
        db.close();
      };
    });
  });
}
async function fits(page: Page) {
  const issues = await page.locator('.inventory-workspace').evaluate((root) => {
    const areas = [
      ...root.querySelectorAll<HTMLElement>(
        '.inventory-character,.bag-grid,.item-detail,.inventory-tray',
      ),
    ];
    const errors: string[] = [];
    for (const el of [...areas, ...root.querySelectorAll<HTMLElement>('button')]) {
      if (!el.getClientRects().length || el.closest('[hidden]')) continue;
      const r = el.getBoundingClientRect();
      if (
        r.left < -0.5 ||
        r.top < -0.5 ||
        r.right > innerWidth + 0.5 ||
        r.bottom > innerHeight + 0.5
      )
        errors.push(`${el.className}: viewport`);
      if (el.scrollWidth > el.clientWidth + 2 && !el.classList.contains('inventory-name'))
        errors.push(`${el.className}: text overflow`);
    }
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
  if (issues.length) {
    await page.screenshot({ path: `${proof}/debug-${page.viewportSize()!.width}.png` });
  }
  expect(issues).toEqual([]);
}
test('장비 교체 후 기존 도포와 새 도포가 함께 저장되고 정리판 폐기를 묻지 않는다', async ({
  page,
}) => {
  const state = fixture();
  state.family.roster[0].items.push({ ...makeItem('robe', 'new-robe', 'general'), x: 3, y: 3 });
  await seed(page, state);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('[data-item-id="new-robe"]').click();
  await page.getByRole('button', { name: '착용', exact: true }).click();
  await expect(page.locator('.equipped-list [data-item-id="new-robe"]')).toBeVisible();
  await expect(page.locator('.bag-grid.general [data-item-id="robe"]')).toBeVisible();
  await expect(page.locator('.board-section')).toHaveCount(0);
  await page.getByRole('button', { name: '무인의 가방 닫기' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.reload();
  const items = (await saved(page)).family.roster[0].items;
  expect(items.find((item) => item.id === 'new-robe')?.place).toBe('equipped');
  expect(items.find((item) => item.id === 'robe')?.place).toBe('general');
});

test('정리판 폐기 확인의 위험 버튼은 읽을 수 있는 어두운 면을 사용한다', async ({ page }) => {
  const state = fixture();
  state.family.roster[0].items.push(makeItem('manual', 'pending-manual', 'ground'));
  await seed(page, state);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('[data-item-id="pending-manual"]').click();
  await page.getByRole('button',{name:'폐기',exact:true}).click();
  const danger = page.getByRole('alertdialog').getByRole('button',{name:'폐기',exact:true});
  await expect(danger).toBeVisible();
  const colors = await danger.evaluate((button) => {
    const style = getComputedStyle(button);
    return { color: style.color, background: style.backgroundColor, image: style.backgroundImage };
  });
  expect(colors).toEqual({
    color: 'rgb(255, 249, 237)',
    background: 'rgb(136, 60, 50)',
    image: 'none',
  });
  await page.screenshot({ path: `${proof}/discard-confirm.png`, animations: 'disabled' });
});

for (const [width, height] of [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1093, 614],
  [1000, 620],
  [1000, 500],
  [800, 600],
  [390, 600],
]) {
  test(`정보 전환 없이 상태·무공·장비·선택 정보 ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, fixture());
    await page.getByRole('button', { name: '가방', exact: true }).click();
    const bag = page.locator('.inventory-workspace');
    await expect(bag.locator('.character-tabs,.inventory-view-actions')).toHaveCount(0);
    await expect(bag.locator('.character-status')).toBeVisible();
    await expect(bag.locator('.binding-list [data-technique]')).toHaveCount(4);
    await expect(bag.locator('.equipped-list .item-tile')).toHaveCount(3);
    await expect(bag.locator('.item-pagination')).toHaveCount(0);
    await fits(page);
    await bag.locator('[data-item-id="sword"]').click();
    await expect(bag.locator('.art-bind')).toHaveCount(4);
    await fits(page);
    await page.screenshot({
      path: `${proof}/summary-${width}x${height}.png`,
      animations: 'disabled',
    });
    await bag.locator('[data-item-id="robe"]').click();
    await bag.getByRole('button', { name: '일반 가방에 수납', exact: true }).click();
    await expect(bag.locator('.bag-grid.general [data-item-id="robe"]')).toBeVisible();
    await bag.getByRole('button', { name: '착용', exact: true }).click();
    await expect(bag.locator('.equipped-list [data-item-id="robe"]')).toBeVisible();
    await bag.locator('[data-item-id="medicine"]').click();
    await bag.getByRole('button', { name: '사용', exact: true }).click();
    await expect
      .poll(
        async () =>
          (await saved(page)).family.roster[0].items.find((i) => i.id === 'medicine')?.count,
      )
      .toBe(2);
    await fits(page);
  });
}
test('선택한 검을 탭 전환 없이 연결하고 작은 수납 미리보기로 이동한다', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  const state = fixture();
  state.family.roster[0].items.push({ ...makeItem('sword', 'second-sword', 'weapon'), x: 2, y: 0 });
  await seed(page, state);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('[data-item-id="second-sword"]').click();
  await page.getByRole('button', { name: '무당태극검에 선택한 무기 연결' }).click();
  await expect
    .poll(async () => ((await saved(page)).family.roster[0] as BoundFighter).bindings?.wudang)
    .toBe('second-sword');
  await page.mouse.move(1040, 580);
  const source = (await page.locator('[data-item-id="ore"]').boundingBox())!;
  const target = (await page.locator('.bag-grid.general [data-cell="65"]').boundingBox())!;
  await page.mouse.move(source.x + 8, source.y + 8);
  await page.mouse.down();
  await page.mouse.move(source.x + 16, source.y + 16, { steps: 3 });
  await page.mouse.move(target.x + 8, target.y + 8, { steps: 10 });
  await expect(page.locator('.placement-preview')).toBeVisible();
  await expect(page.locator('.placement-preview')).toHaveText('');
  const preview = (await page.locator('.placement-preview').boundingBox())!;
  expect(preview.width).toBeLessThan(45);
  expect(preview.height).toBeLessThan(45);
  await page.screenshot({ path: `${proof}/small-drag-preview.png`, animations: 'disabled' });
  await page.mouse.up();
  await expect
    .poll(async () => (await saved(page)).family.roster[0].items.find((i) => i.id === 'ore')?.y)
    .toBe(6);
});
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
  test(`요약과 연결·사용 안내 ${locale}`, async ({ page }) => {
    await page.addInitScript(
      (locale) => localStorage.setItem('mugong-language-v1', locale),
      locale,
    );
    await page.setViewportSize({ width: 1093, height: 614 });
    await seed(page, fixture());
    await page.locator('.home-fighter-detail button').last().click();
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.locator('[data-item-id="sword"]').click();
    await fits(page);
    if (locale !== 'ko')
      expect(await page.locator('.inventory-workspace').innerText()).not.toMatch(/[가-힣]/);
    await expect(page.locator('.art-bind')).toHaveCount(4);
    await page.screenshot({ path: `${proof}/summary-${locale}.png`, animations: 'disabled' });
  });
}
