import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { command, emptyGame, grantXp, startRun } from '../../src/domain/game';
import { makeItem } from '../../src/domain/content';
import type { GameState } from '../../src/domain/model';
import { messages } from '../../src/platform/messages';
test.use({ actionTimeout: 15000 });
const proofRoot = process.env.MUGONG_DAYTONA_URL
  ? 'docs/verification/responsive-v1/daytona'
  : 'docs/verification/responsive-v1';

async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  // Test fixture is confined to Playwright's independent browser context.
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    localStorage.setItem(
      'mugong-ui-v1',
      JSON.stringify({ muted: true, largeHud: true, highContrast: false }),
    );
  }, state);
  await page.reload();
}

async function inspect(page: Page, scope: string) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  return page.locator(scope).evaluate((root) => {
    const failures: string[] = [];
    const controls = [...root.querySelectorAll<HTMLElement>('button,input,select')].filter(
      (el) => el.getClientRects().length && !el.closest('[hidden],[inert]'),
    );
    const boxes = controls.map((el) => ({ el, box: el.getBoundingClientRect() }));
    for (const { el, box } of boxes) {
      const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (
        box.left < -1 ||
        box.top < -1 ||
        box.right > innerWidth + 1 ||
        box.bottom > innerHeight + 1
      )
        failures.push(`outside: ${label}`);
      if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2)
        failures.push(`control overflow: ${label}`);
    }
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        // Occupied inventory cells are intentionally covered by their item hit area.
        if (
          a.el.closest('.bag-grid') === b.el.closest('.bag-grid') &&
          a.el.closest('.bag-grid') &&
          (a.el.matches('.bag-cell') || b.el.matches('.bag-cell'))
        )
          continue;
        if (
          Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left) > 2 &&
          Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top) > 2
        )
          failures.push(`overlap: ${a.el.textContent?.trim()} / ${b.el.textContent?.trim()}`);
      }
    for (const el of [
      root,
      ...root.querySelectorAll<HTMLElement>(
        '.home-stage,.home-roster,.home-departure,.home-dock,.panel,.growth,.inventory-columns,.item-detail,.bag-usage,.inventory-tray',
      ),
    ]) {
      const html = el as HTMLElement;
      if (!html.getClientRects().length) continue;
      if (html.scrollWidth > html.clientWidth + 2 || html.scrollHeight > html.clientHeight + 2)
        failures.push(
          `box overflow: ${html.className} ${html.clientWidth}×${html.clientHeight}/${html.scrollWidth}×${html.scrollHeight}`,
        );
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode,
        parent = text.parentElement;
      if (
        !text.textContent?.trim() ||
        !parent?.getClientRects().length ||
        parent.closest('[hidden],[inert],svg,[aria-hidden="true"]')
      )
        continue;
      if (getComputedStyle(parent).textOverflow === 'ellipsis') continue;
      // Text ink is checked against the surrounding surface, not an inline line box.
      const panel = parent.closest('.panel,.choice-card,.dialog,.home-dock-card') ?? root;
      const box = panel.getBoundingClientRect(),
        range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (
          rect.left < Math.max(0, box.left) - 3 ||
          rect.right > Math.min(innerWidth, box.right) + 3 ||
          rect.top < Math.max(0, box.top) - 4 ||
          rect.bottom > Math.min(innerHeight, box.bottom) + 4
        )
          failures.push(`text outside box: ${text.textContent.trim()}`);
      }
    }
    return [...new Set(failures)];
  });
}

const sizes = [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1200, 700],
  [1093, 614],
  [1024, 768],
  [1000, 620],
  [900, 600],
  [800, 600],
  [761, 614],
  [760, 600],
  [700, 600],
  [600, 546],
  [500, 700],
  [390, 844],
  [1280, 600],
  [1000, 500],
  [800, 500],
  [640, 480],
  [390, 600],
];

test('창 크기 연속 변경: 긴 이름·네 무공·큰 HUD·가방·성장', async ({ page }) => {
  test.setTimeout(240000);
  const proof = proofRoot;
  await mkdir(proof, { recursive: true });
  const failures: { screen: string; width: number; height: number; issues: string[] }[] = [];
  const scan = async (screen: string, scope: string) => {
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      if (screen === 'growth')
        await expect(page.locator('.growth')).toHaveAttribute(
          'data-compact',
          String(width <= 760 || height <= 480),
        );
      const issues = await inspect(page, scope);
      if (issues.length) failures.push({ screen, width, height, issues });
      if (['1093x614', '800x500', '390x600'].includes(`${width}x${height}`))
        await page.screenshot({
          path: `${proof}/${screen}-${width}x${height}.png`,
          animations: 'disabled',
        });
    }
  };
  const state = emptyGame();
  startRun(state, '청하연무림검객전설', 22);
  grantXp(state.run!, 100);
  for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as const) {
    state.run!.offers = [{ art, type: 'learn' }];
    command(state, { type: 'choose', offer: state.run!.offers[0] });
  }
  state.run!.offers = [];
  state.run!.fighter.items.push({ ...makeItem('robe', 'responsive-robe', 'general'), x: 3, y: 2 });
  state.run!.wave = 20;
  state.run!.phase = 'loot';
  command(state, { type: 'next' });
  state.family.warehouse.push(
    ...Array.from({ length: 12 }, (_, i) => makeItem('ore', `responsive-ore-${i}`, 'warehouse')),
  );
  await seed(page, state);
  await scan('lobby', '.home-scene');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.getByRole('button', { name: '무명 도포 선택' }).click();
  await scan('bag', '.inventory-workspace');
  await scan('fighter', '.inventory-workspace');
  await scan('bindings', '.inventory-workspace');
  await scan('equipment', '.inventory-workspace');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await scan('settings', '.dialog');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '새 무인으로 출전 →', exact: true }).click();
  await scan('create', '.dialog');
  await page.keyboard.press('Escape');
  const growing = emptyGame();
  startRun(growing, '청하연무림검객전설', 22);
  grantXp(growing.run!, 20);
  await seed(page, growing);
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await scan('growth', '.growth');
  await page.locator('.choice-card:visible').first().click();
  await scan('hud', '.hud');
  await writeFile(
    `${proof}/result.json`,
    JSON.stringify({ sizes, checkedStates: sizes.length * 9, failures }, null, 2),
  );
  expect(failures).toEqual([]);
});

test('긴 영어 문구: 작은 창의 로비·가방·무공·설정·성장', async ({ page }) => {
  test.setTimeout(120000);
  await mkdir(proofRoot, { recursive: true });
  const state = emptyGame();
  startRun(state, 'ABCDEFGHIJKL', 22);
  grantXp(state.run!, 100);
  for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as const) {
    state.run!.offers = [{ art, type: 'learn' }];
    command(state, { type: 'choose', offer: state.run!.offers[0] });
  }
  state.run!.offers = [];
  state.run!.wave = 20;
  state.run!.phase = 'loot';
  state.run!.fighter.items.push({ ...makeItem('robe', 'english-robe', 'general'), x: 3, y: 2 });
  command(state, { type: 'next' });
  await seed(page, state);
  await page.getByRole('button', { name: '화면 설정', exact: true }).click();
  await page.locator('#game-language').selectOption('en');
  await page.keyboard.press('Escape');
  const button = (key: string) => page.getByRole('button', { name: messages[key][0], exact: true });
  const failures: unknown[] = [];
  const scan = async (screen: string, scope: string) => {
    for (const [width, height] of [
      [1093, 614],
      [1000, 500],
      [800, 600],
      [640, 480],
      [390, 600],
    ]) {
      await page.setViewportSize({ width, height });
      if (screen === 'growth')
        await expect(page.locator('.growth')).toHaveAttribute(
          'data-compact',
          String(width <= 760 || height <= 480),
        );
      const issues = await inspect(page, scope);
      if (issues.length) failures.push({ screen, width, height, issues });
      if (width === 390)
        await page.screenshot({
          path: `${proofRoot}/en-${screen}.png`,
          animations: 'disabled',
        });
    }
  };
  await scan('lobby', '.home-scene');
  await button('가방').click();
  await page
    .getByRole('button', { name: messages['{0} 선택'][0].replace('{0}', messages['무명 도포'][0]) })
    .click();
  await scan('bag', '.inventory-workspace');
  await scan('bindings', '.inventory-workspace');
  await page.keyboard.press('Escape');
  await button('화면 설정').click();
  await scan('settings', '.dialog');
  await page.keyboard.press('Escape');
  const growing = emptyGame();
  startRun(growing, 'ABCDEFGHIJKL', 22);
  grantXp(growing.run!, 20);
  await seed(page, growing);
  await expect(page.locator('.choice-card').first()).toBeEnabled();
  await scan('growth', '.growth');
  await writeFile(
    `${proofRoot}/english.json`,
    JSON.stringify({ checkedStates: 25, failures }, null, 2),
  );
  expect(failures).toEqual([]);
});
