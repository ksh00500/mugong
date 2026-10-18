import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, rollOffers } from '../../src/domain/game';
import { xpThreshold } from '../../src/domain/content';
import { isGameSave } from '../../src/platform/save-validation';

test('공개 성장 화면의 두 후보·비용 안내·보관·재개', async ({ page }) => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, '공개 배포 검사 전용');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const state = emptyGame();
  startRun(state, '성장 배포 검증', 123);
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
  await page.setViewportSize({ width: 1093, height: 614 });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, 'current');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.choice-card')).toHaveCount(2);
  const summary = page.locator('.growth-availability summary');
  await summary.click();
  await expect(page.locator('.growth-availability ul li')).toHaveCount(6);
  const color = await page.locator('.growth-defer').evaluate((el) => getComputedStyle(el).color);
  expect(color).toBe('rgb(38, 61, 49)');
  const proof = 'docs/verification/daytona-20261004-hostile-consistency-v3/public';
  await mkdir(proof, { recursive: true });
  await page.screenshot({ path: `${proof}/training-two-options.png` });
  await summary.click();
  await page.screenshot({ path: `${proof}/training-two-options-closed.png` });
  await page.locator('.growth-defer').click();
  await expect(page.locator('.growth')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await page.locator('.character-training').click();
  await expect(page.locator('.choice-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.choice-card')).toHaveCount(2);
  await page.locator('.choice-card').first().click();
  await expect(page.locator('.growth')).toHaveCount(0);
  expect(errors).toEqual([]);
  await writeFile(
    `${proof}/training.json`,
    JSON.stringify(
      { color, errors, storage: 'isolated Playwright context', offers: run.offers },
      null,
      2,
    ),
  );
});
