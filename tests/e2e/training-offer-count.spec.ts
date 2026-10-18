import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, rollOffers, startRun } from '../../src/domain/game';
import { xpThreshold } from '../../src/domain/content';
import { isGameSave } from '../../src/platform/save-validation';

for (const count of [1, 2, 3])
  test(`무공 후보 ${count}개가 저장 수와 같고 모두 보이며 선택된다`, async ({ page }) => {
    const proof = 'docs/verification/training-offer-count';
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1093, height: 614 });
    const state = emptyGame();
    startRun(state, '후보 수 검증', 123);
    const run = state.run!,
      f = run.fighter;
    Object.assign(f, {
      progressionVersion: 2,
      growth: { constitution: 1, strength: 1, agility: 1, inner: 1 },
      level: 50,
      xp: xpThreshold(50),
      spent: 50,
      augments: ['iron', 'tempo', 'resolve'],
      augmentOffers: [],
      trainingPoints: 4,
    });
    f.arts = (['huashan', 'wudang', 'tianmo', 'samja'] as const).map((id, i) => ({
      id,
      level: i < count ? 4 : id === 'samja' ? 10 : 5,
      gauge: 0,
      combo: 0,
      defenseCd: 0,
    }));
    run.spent = 50;
    run.offers = [];
    rollOffers(run);
    expect(run.offers).toHaveLength(count);
    expect(isGameSave(state)).toBe(true);
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible();
    await page.evaluate(async (value) => {
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open('mugong-local-v1', 1);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve) => {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(value, 'current');
        tx.oncomplete = () => resolve();
      });
      db.close();
    }, state);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
    await expect(page.getByRole('dialog', { name: '무공 성장 선택' })).toBeVisible();
    await expect(page.locator('.choice-card')).toHaveCount(count);
    for (const card of await page.locator('.choice-card').all()) {
      await expect(card).toBeVisible();
      const box = (await card.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1093);
      expect(box.y + box.height).toBeLessThanOrEqual(614);
    }
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/choices-${count}.png` });
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
    await expect(page.locator('.choice-card')).toHaveCount(count);
    const first = page.locator('.choice-card').first();
    await expect(first).toBeEnabled();
    await first.click();
    await expect(page.getByRole('dialog', { name: '무공 성장 선택' })).toBeHidden();
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/choices-${count}.json`,
      JSON.stringify(
        {
          count,
          offers: run.offers,
          errors,
          storage: 'isolated Playwright context',
          viewport: [1093, 614],
        },
        null,
        2,
      ),
    );
  });

test('만렙 없이 수련 비용으로 후보가 두 개일 때 5언어·3화면에서 안내와 보관을 쓴다', async ({
  page,
}) => {
  test.setTimeout(120000);
  const state = emptyGame();
  startRun(state, '비용 제한 검증', 123);
  const run = state.run!,
    f = run.fighter;
  Object.assign(f, {
    progressionVersion: 2,
    growth: { constitution: 1, strength: 1, agility: 1, inner: 1 },
    level: 50,
    xp: xpThreshold(50),
    spent: 50,
    augments: ['iron', 'tempo', 'resolve'],
    augmentOffers: [],
    trainingPoints: 2,
  });
  f.arts = (['huashan', 'wudang', 'tianmo', 'samja'] as const).map((id, i) => ({
    id,
    level: [2, 3, 2, 4][i],
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  run.spent = 50;
  rollOffers(run);
  expect(run.offers).toHaveLength(2);
  expect(isGameSave(state)).toBe(true);
  await page.goto('/');
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
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('.growth-defer')).toBeEnabled();
  await mkdir('docs/verification/hostile-consistency-v3', { recursive: true });
  for (const [width, height] of [
    [1366, 768],
    [1440, 900],
    [1093, 614],
  ])
    for (const locale of ['ko', 'en', 'ja', 'zh-CN', 'zh-TW']) {
      await page.setViewportSize({ width, height });
      await page.evaluate(async (locale) => {
        const path = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((u) => new URL(u).pathname === '/src/platform/i18n.ts')!;
        const { setLanguage } = await import(path);
        setLanguage(locale);
      }, locale);
      await expect(page.locator('.choice-card')).toHaveCount(2);
      const summary = page.locator('.growth-availability summary');
      await summary.click();
      await expect(page.locator('.growth-availability ul li')).toHaveCount(6);
      for (const el of [
        page.locator('.growth-defer'),
        summary,
        page.locator('.choice-card').first(),
      ]) {
        const b = (await el.boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(width + 1);
        expect(b.y + b.height).toBeLessThanOrEqual(height + 1);
      }
      const style = await page.locator('.growth-defer').evaluate((el) => {
        const s = getComputedStyle(el);
        return [s.color, s.backgroundColor];
      });
      expect(style).toEqual(['rgb(38, 61, 49)', 'rgb(247, 240, 223)']);
      await page.screenshot({
        path: `docs/verification/hostile-consistency-v3/training-${locale}-${width}.png`,
      });
      await summary.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.growth-availability')).not.toHaveAttribute('open', '');
    }
  await page.locator('.growth-defer').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.growth')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await page.locator('.character-training').click();
  await expect(page.locator('.choice-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
  await expect(page.locator('.choice-card')).toHaveCount(2);
  await page.locator('.choice-card').first().click();
  await expect(page.locator('.growth')).toHaveCount(0);
});
