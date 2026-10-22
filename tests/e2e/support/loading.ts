import { expect, type Page } from '@playwright/test';
import { emptyGame, startRun, spawnWave } from '../../../src/domain/game';
import { REGIONS } from '../../../src/domain/campaign';
import { xpThreshold } from '../../../src/domain/content';
import type { Fighter } from '../../../src/domain/model';
export async function seedLoadingRun(
  page: Page,
  region = 3,
  wave = 1,
  appearance?: Fighter['appearance'],
  wait = true,
) {
  await page.addInitScript(() => {
    (window as any).regionModule = async (name: string) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((url) => new URL(url).pathname === name) ?? name
      );
  });
  const state = emptyGame();
  startRun(state, '로딩 검증', 123);
  const r = state.run!,
    f = r.fighter;
  r.regionRoute = [
    ...REGIONS.filter((_, i) => i !== region)
      .slice(0, 3)
      .map((r) => r.name),
  ];
  r.regionRoute.splice(Math.floor((wave - 1) / 5), 0, REGIONS[region].name);
  r.wave = wave;
  spawnWave(r);
  r.offers = [];
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.augments = ['swift'];
  f.augmentOffers = [];
  if (appearance !== undefined) f.appearance = appearance;
  for (const e of r.enemies) {
    e.hp = e.maxHp = 100000;
    e.timer = 1000;
    e.state = 'windup';
  }
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
  await page.reload({ waitUntil: 'domcontentloaded' });
  if (wait)
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 30000,
    });
  return state;
}
