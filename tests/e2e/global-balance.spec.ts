import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { isGameSave } from '../../src/platform/save-validation';
const proof =
  process.env.MUGONG_GLOBAL_BROWSER_PROOF ?? 'docs/verification/global-balance-v1/source';
for (const [stage, hp, width, height] of [
  [1, 1100, 1440, 900],
  [2, 1900, 1366, 768],
  [3, 2900, 1093, 614],
  [4, 4000, 1093, 614],
])
  test(`boss stage ${stage}: actual saved HP and readable HUD ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = emptyGame();
    startRun(state, '보스 HUD 검증', 123);
    const r = state.run!;
    r.wave = stage * 5;
    spawnWave(r);
    r.offers = [];
    // Freeze only the seeded encounter for reproducible visual inspection; not a win-rate test.
    r.enemies.forEach((e) => {
      e.state = 'windup';
      e.timer = 1000;
    });
    expect(r.enemies[0].maxHp).toBe(hp);
    expect(isGameSave(state)).toBe(true);
    await page.goto('/');
    await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
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
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    const bar = page.locator('.boss-panel [role="meter"]');
    await expect(bar).toHaveAttribute('aria-valuemax', String(hp));
    await expect(bar).toHaveAttribute('aria-valuenow', String(hp));
    const boxes = await page
      .locator('.boss-panel,.boss-health')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width);
      expect(b.bottom).toBeLessThanOrEqual(height);
    }
    await page.screenshot({ path: `${proof}/boss-stage-${stage}.png` });
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/boss-stage-${stage}.json`,
      JSON.stringify(
        { stage, wave: r.wave, hp, width, height, boxes, errors, seededFrozenEncounter: true },
        null,
        2,
      ) + '\n',
    );
  });
