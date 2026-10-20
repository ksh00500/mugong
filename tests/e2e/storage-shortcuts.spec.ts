import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { emptyGame, startRun, command } from '../../src/domain/game';
import { makeItem } from '../../src/domain/content';
import type { GameState } from '../../src/domain/model';
import { messages } from '../../src/platform/messages';

const proof =
  process.env.MUGONG_STORAGE_PROOF ??
  (process.env.MUGONG_DAYTONA_URL
    ? 'docs/verification/daytona-20261002-storage-shortcuts-v1/public'
    : 'docs/verification/storage-shortcuts-v1');
function fixture(returned = true, full = false) {
  const state = emptyGame();
  startRun(state, '검증무인', 123);
  const run = state.run!;
  run.offers = [];
  run.fighter.items = [
    makeItem('medicine', 'bag-medicine', 'general'),
    { ...makeItem('ore', 'acquired', 'ground'), count: 3 },
  ];
  if (full)
    run.fighter.items = Array.from({ length: 80 }, (_, n) => ({
      ...makeItem('medicine', `full-${n}`, 'general'),
      x: n % 10,
      y: Math.floor(n / 10),
    }));
  run.phase = 'loot';
  run.enemies = [];
  if (returned) {
    run.wave = 20;
    command(state, { type: 'next' });
  }
  state.family.warehouse = [
    makeItem('boots', 'storage-boots', 'warehouse'),
    { ...makeItem('medicine', 'storage-stack', 'warehouse'), count: 4 },
    ...Array.from({ length: 67 }, (_, n) => makeItem('ore', `storage-${n}`, 'warehouse')),
  ];
  return state;
}
async function seed(page: Page, state: GameState, language = 'ko') {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(
    async ({ state, language }) => {
      localStorage.setItem('mugong-language-v1', language);
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
    },
    { state, language },
  );
  await page.reload();
  await expect(page.locator('.loading-screen')).toHaveCount(0);
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
  const errors = await page.locator('.warehouse-workspace').evaluate((root) => {
    const errors: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>(
      'button,input,select,.warehouse-catalog,.warehouse-detail',
    )) {
      if (!element.getClientRects().length) continue;
      const box = element.getBoundingClientRect();
      if (box.x < -1 || box.y < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1)
        errors.push(`${element.className}: outside viewport`);
      if (element.matches('button') && element.scrollWidth > element.clientWidth + 2)
        errors.push(`${element.textContent}: overflow`);
    }
    if (root.scrollHeight > root.clientHeight + 2) errors.push('workspace scroll');
    const regions = [
      ...root.querySelectorAll<HTMLElement>(
        '.dialog-header,.warehouse-toolbar,.warehouse-content,.warehouse-footer',
      ),
    ];
    for (let i = 0; i < regions.length - 1; i++) {
      const upper = regions[i].getBoundingClientRect(),
        lower = regions[i + 1].getBoundingClientRect();
      if (upper.bottom > lower.top + 1) errors.push('regions overlap');
      for (const child of regions[i].querySelectorAll<HTMLElement>('button,input,select'))
        if (
          child.getBoundingClientRect().bottom > upper.bottom + 1 ||
          child.getBoundingClientRect().top < upper.top - 1
        )
          errors.push(`${child.tagName}: outside own region`);
    }
    return errors;
  });
  expect(errors).toEqual([]);
}
const locales = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
const translated = (source: string, locale: string) =>
  locale === 'ko' ? source : (messages[source]?.[locales.indexOf(locale) - 1] ?? source);
for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  for (const locale of locales)
    test(`창고 전용 목록·검색·페이지·이동 ${locale} ${width}×${height}`, async ({ page }) => {
      await mkdir(proof, { recursive: true });
      await page.setViewportSize({ width, height });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await seed(page, fixture(), locale);
      const opener = page.getByRole('button', { name: translated('창고', locale), exact: true });
      await opener.click();
      await expect(page.locator('.warehouse-workspace')).toBeVisible();
      await expect(page.locator('.bag-grid,.inventory-character,.inventory-workspace')).toHaveCount(
        0,
      );
      expect(await page.locator('.warehouse-catalog .item-tile').count()).toBeGreaterThanOrEqual(
        10,
      );
      await page.locator('[data-item-id="storage-stack"]').click();
      await fits(page);
      await page.screenshot({ path: `${proof}/warehouse-${locale}-${width}x${height}.png` });
      await page.keyboard.press('f');
      await expect
        .poll(
          async () =>
            (await saved(page)).family.warehouse.find((item) => item.id === 'storage-stack')?.count,
        )
        .toBe(3);
      await page.locator('[data-item-id="storage-boots"]').click({ modifiers: ['Control'] });
      await expect
        .poll(async () =>
          (await saved(page)).family.warehouse.some((item) => item.id === 'storage-boots'),
        )
        .toBe(false);
      await page
        .getByRole('button', {
          name: translated('{0} 다음 페이지', locale).replace(
            '{0}',
            translated('창고 물품', locale),
          ),
        })
        .click();
      await fits(page);
      const search = page.getByRole('searchbox');
      await search.fill(translated('철광석', locale));
      await page.keyboard.press('f'); // Typing in a search field must not transfer.
      await expect(page.locator('.warehouse-catalog .item-tile')).toHaveCount(0);
      await search.fill('');
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
      await page.reload();
      expect(
        (await saved(page)).family.warehouse.find((item) => item.id === 'storage-stack')!.count,
      ).toBe(3);
      expect(errors).toEqual([]);
    });
}
test('가방↔창고 F·Ctrl+클릭, 획득 물품 F와 T 자동 정리', async ({ page }) => {
  const state = fixture();
  state.family.warehouse = state.family.warehouse.filter((item) => item.id !== 'storage-stack');
  state.family.roster[0].items.push({ ...makeItem('ore', 'acquired', 'ground'), count: 3 });
  await seed(page, state);
  await page.getByRole('button', { name: '가방', exact: true }).click();
  await page.locator('[data-item-id="bag-medicine"]').click();
  await page.keyboard.press('f');
  await expect
    .poll(async () =>
      (await saved(page)).family.warehouse.some((item) => item.id === 'bag-medicine'),
    )
    .toBe(true);
  await page.keyboard.press('f');
  await expect
    .poll(async () =>
      (await saved(page)).family.roster[0].items.some(
        (item) => item.id === 'bag-medicine' && item.place === 'general',
      ),
    )
    .toBe(true);
  await page.locator('[data-item-id="acquired"]').click();
  await page.keyboard.press('f');
  await expect
    .poll(
      async () =>
        (await saved(page)).family.roster[0].items.find((item) => item.id === 'acquired')?.count,
    )
    .toBe(2);
  await page.keyboard.press('t');
  await expect
    .poll(async () =>
      (await saved(page)).family.roster[0].items.some((item) => item.place === 'ground'),
    )
    .toBe(false);
  await page.screenshot({ path: `${proof}/bag-shortcuts.png` });
});
test('전투 후 획득 물품을 수납하고 다시 꺼내기', async ({ page }) => {
  await seed(page, fixture(false));
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.locator('[data-item-id="bag-medicine"]').click();
  await page.keyboard.press('f');
  await expect
    .poll(
      async () =>
        (await saved(page)).run!.fighter.items.find((item) => item.id === 'bag-medicine')?.place,
    )
    .toBe('ground');
  await page.locator('[data-item-id="bag-medicine"]').click({ modifiers: ['Control'] });
  await expect
    .poll(
      async () =>
        (await saved(page)).run!.fighter.items.find((item) => item.id === 'bag-medicine')?.place,
    )
    .toBe('general');
  await page.keyboard.press('t');
  await expect
    .poll(async () =>
      (await saved(page)).run!.fighter.items.some((item) => item.place === 'ground'),
    )
    .toBe(false);
});
test('가방 만석·무인 없음에서 물품을 보존', async ({ page }) => {
  await seed(page, fixture(true, true));
  await page.getByRole('button', { name: '창고', exact: true }).click();
  await page.locator('[data-item-id="storage-stack"]').click();
  await expect(
    page.getByRole('button', { name: '일반 가방에 수납 F', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('f');
  await page.locator('[data-item-id="storage-stack"]').click({ modifiers: ['Control'] });
  expect(
    (await saved(page)).family.warehouse.find((item) => item.id === 'storage-stack')!.count,
  ).toBe(4);
  await page.screenshot({ path: `${proof}/full-bag.png` });
  const empty = emptyGame();
  empty.family.warehouse = fixture().family.warehouse;
  await page.keyboard.press('Escape');
  await seed(page, empty);
  await page.getByRole('button', { name: '창고', exact: true }).click();
  await page.locator('[data-item-id="storage-boots"]').click();
  await expect(
    page.getByRole('button', { name: '일반 가방에 수납 F', exact: true }),
  ).toBeDisabled();
  await fits(page);
});
