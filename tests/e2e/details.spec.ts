import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, grantXp, command } from '../../src/domain/game';
import { makeItem, ART_IDS } from '../../src/domain/content';
import type { BoundFighter, GameState } from '../../src/domain/model';

const proof =
  process.env.MUGONG_DETAILS_PROOF ??
  `docs/verification/details-v4/${process.env.MUGONG_DAYTONA_URL ? 'public' : 'local'}`;
test.beforeEach(async () => {
  await mkdir(proof, { recursive: true });
});
function fixture(mode: 'growth' | 'loot' | 'combat') {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const r = state.run!;
  r.enemies.forEach((e) => {
    e.hp = e.maxHp = 100000;
    e.state = 'windup';
    e.timer = 100;
  });
  if (mode === 'growth') grantXp(r, 20);
  else {
    r.fighter.arts = ART_IDS.slice(0, 4).map((id) => ({
      id,
      level: id === 'samja' ? 8 : 5,
      gauge: 75,
      combo: 0,
      defenseCd: 0,
    }));
    (r.fighter as BoundFighter).bindings = Object.fromEntries(
      ART_IDS.slice(0, 4).map((id) => [id, r.fighter.items[0].id]),
    );
  }
  if (mode === 'loot') {
    r.phase = 'loot';
    r.enemies = [];
    r.fighter.hp = 80;
    r.fighter.items.push(
      { ...makeItem('medicine', 'loot-medicine', 'ground', 60), count: 3 },
      makeItem('manual', 'loot-manual', 'ground', 50),
    );
  }
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
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
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    return new Promise<GameState>((resolve) => {
      const request = db.transaction('saves').objectStore('saves').get('current');
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
    });
  });
}
async function fits(page: Page) {
  const box = (await page.getByRole('tooltip').boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`무공 Shift·설명 버튼은 선택을 바꾸지 않는다 ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seed(page, fixture('growth'));
    const card = page.locator('.choice-card').first();
    await expect(card).toBeEnabled();
    const before = await saved(page);
    await card.hover();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toContainText('선택 후 효과');
    await fits(page);
    await page.screenshot({
      path: `${proof}/growth-${width}x${height}.png`,
      animations: 'disabled',
    });
    await page.keyboard.up('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await page.mouse.move(4, height - 4);
    await page.keyboard.down('Shift');
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.up('Shift');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    const button = page.getByRole('button', { name: '설명 Shift', exact: true });
    await button.click();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await expect(page.locator('.growth')).not.toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    const after = await saved(page);
    expect(after.run!.offers).toEqual(before.run!.offers);
    expect(after.run!.spent).toBe(before.run!.spent);
    await card.click();
    await expect(page.locator('.growth')).toHaveCount(0);
  });
}
test('전투 Shift 설명은 전환·회피를 막지 않고 가방 뒤에서 열리지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  await seed(page, fixture('combat'));
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('화산매화검법');
  await fits(page);
  await page.screenshot({ path: `${proof}/hud-shift.png`, animations: 'disabled' });
  await page.keyboard.press('e');
  await expect(page.locator('.fan-card[aria-pressed="true"]')).toHaveAttribute(
    'data-technique',
    'wudang',
  );
  await expect(page.getByRole('tooltip')).toContainText('무당태극검');
  await page.keyboard.press('Space');
  await expect(page.locator('.defense-slot.active .cooldown-dial b')).toHaveText(/2\.[0-8]/);
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.down('Shift');
  await expect(page.locator('.inventory-workspace [role="tooltip"]')).toContainText('화산매화검법');
  await expect(page.locator('.hud [role="tooltip"]')).toHaveCount(0);
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('무당태극검');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: '숨 고르기' })).toHaveCount(0);
  await page.keyboard.up('Shift');
});
test('전리품 약·비급은 수납 없이 사용하고 품질 수치·개수·경험치를 저장한다', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  await seed(page, fixture('loot'));
  await page.locator('[data-item-id="loot-medicine"]').click();
  await expect(page.locator('.item-detail')).toContainText('체력 21 회복');
  await expect(page.locator('.item-detail')).toContainText('체력 +21');
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(101);
  await expect(page.locator('[data-item-id="loot-medicine"]')).toContainText('×2');
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.hp).toBe(120);
  await expect(page.getByRole('button', { name: '사용', exact: true })).toBeDisabled();
  await expect(page.locator('.item-detail')).toContainText('체력이 가득 찼습니다.');
  expect(
    await page.locator('.inventory-columns').evaluate((e) => e.scrollHeight <= e.clientHeight + 2),
  ).toBe(true);
  await page.screenshot({ path: `${proof}/loot-use.png`, animations: 'disabled' });
  await page.locator('[data-item-id="loot-manual"]').click();
  await expect(page.locator('.item-detail')).toContainText('경험치 +10');
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect.poll(async () => (await saved(page)).run!.fighter.xp).toBe(10);
  await expect(page.locator('[data-item-id="loot-manual"]')).toHaveCount(0);
  await page.reload();
  const restored = (await saved(page)).run!.fighter;
  expect(restored.hp).toBe(120);
  expect(restored.xp).toBe(10);
  expect(restored.items.find((item) => item.id === 'loot-medicine')).toMatchObject({
    count: 1,
    place: 'ground',
  });
});
test('전리품 비급으로 레벨이 오르면 성장하고 가방으로 돌아와 저장한다', async ({ page }) => {
  const state = fixture('loot'),
    r = state.run!;
  r.fighter.arts = [];
  r.fighter.items.find((item) => item.id === 'loot-manual')!.power = 20;
  await seed(page, state);
  await page.locator('[data-item-id="loot-manual"]').click();
  await page.getByRole('button', { name: '사용', exact: true }).click();
  await expect(page.locator('.growth')).toBeVisible();
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('선택 후 효과');
  await page.keyboard.up('Shift');
  await page.locator('.choice-card').first().click();
  await expect(page.locator('.growth')).toHaveCount(0);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await expect.poll(async () => (await saved(page)).run!.fighter.level).toBe(1);
  expect((await saved(page)).run!.fighter.arts).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
});
test('가방과 로비의 각 무공 설명을 키보드로 읽고 숨긴 패널에는 남기지 않는다', async ({ page }) => {
  const state = fixture('loot');
  state.run!.wave = 20;
  command(state, { type: 'next' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.home-art-list')).toBeVisible();
  for (
    let n = 0;
    n < 24 && (await page.locator('.home-art-list [data-technique]:focus').count()) === 0;
    n++
  )
    await page.keyboard.press('Tab');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('화산매화검법');
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('무당태극검');
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.setViewportSize({ width: 1093, height: 614 });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  const keyboardTrace: unknown[] = [];
  for (
    let n = 0;
    n < 5 && (await page.locator('.binding-list [data-technique]:focus').count()) === 0;
    n++
  ) {
    await page.keyboard.press('Tab');
    keyboardTrace.push(
      await page.evaluate(() => ({
        focused:
          document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent,
        root: document.querySelector('.inventory-columns')?.getBoundingClientRect().toJSON(),
      })),
    );
  }
  await writeFile(`${proof}/keyboard-focus.json`, JSON.stringify(keyboardTrace, null, 2));
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('화산매화검법');
  await fits(page);
  await page.screenshot({ path: `${proof}/keyboard-bag.png`, animations: 'disabled' });
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await page.keyboard.down('Shift');
  await expect(page.getByRole('tooltip')).toContainText('무당태극검');
  await page.keyboard.up('Shift');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.locator('.binding-list [data-technique="tianmo"]').hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.locator('.binding-list [data-technique="tianmo"]').click();
  await expect(page.getByRole('tooltip')).toContainText('천마신공');
  await fits(page);
  await page.screenshot({ path: `${proof}/bag-click.png`, animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
});
for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
  test(`무공·물품 상세 문구와 위치를 ${locale}에서 확인한다`, async ({ page }) => {
    await page.addInitScript(
      (locale) => localStorage.setItem('mugong-language-v1', locale),
      locale,
    );
    await page.setViewportSize({ width: 1093, height: 614 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seed(page, fixture('loot'));
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.down('Shift');
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).not.toContainText(/\{\d+\}/);
    await fits(page);
    if (locale !== 'ko') expect(await tooltip.innerText()).not.toMatch(/[가-힣]/);
    await page.screenshot({ path: `${proof}/details-${locale}.png`, animations: 'disabled' });
    await page.keyboard.up('Shift');
    await page.keyboard.press('Tab');
    await page.locator('[data-item-id="loot-medicine"]').click();
    await expect(page.locator('.item-detail')).toContainText('21');
    const untranslated = await page.locator('.inventory-workspace').innerText();
    if (locale !== 'ko') expect(untranslated).not.toMatch(/[가-힣]/);
    if (locale === 'en') {
      const rows = await page
        .locator('.bag-usage-numbers')
        .evaluateAll((elements) =>
          elements.map((element) => element.getBoundingClientRect().height),
        );
      expect(rows.every((height) => height < 30)).toBe(true);
    }
    await page.screenshot({ path: `${proof}/inventory-${locale}.png`, animations: 'disabled' });
    const overflow = await page
      .locator('.inventory-workspace,.item-detail,.inventory-columns')
      .evaluateAll((elements) =>
        elements
          .filter((e) => e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2)
          .map((e) => ({
            class: e.className,
            client: [e.clientWidth, e.clientHeight],
            scroll: [e.scrollWidth, e.scrollHeight],
          })),
      );
    expect(overflow).toEqual([]);
    await page.screenshot({ path: `${proof}/inventory-${locale}.png`, animations: 'disabled' });
    expect(errors).toEqual([]);
  });
}
