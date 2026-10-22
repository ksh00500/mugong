import { expect, type Page } from '@playwright/test';
import { emptyGame, startRun, spawnWave } from '../../../src/domain/game';
import { REGIONS } from '../../../src/domain/campaign';
import { xpThreshold } from '../../../src/domain/content';
import { ROLE_PROFILES } from '../../../src/domain/region-enemies';
import type { Enemy, Fighter } from '../../../src/domain/model';
export async function seedRegion(
  page: Page,
  index: number,
  wait = true,
  appearance?: Fighter['appearance'],
  ordinaryRoles?: Enemy['role'][],
) {
  await page.addInitScript(() => {
    (window as any).regionModule = async (name: string) => {
      const path =
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === name) ?? name;
      return import(path);
    };
  });
  const state = emptyGame();
  startRun(state, '지역 검증', 123);
  const run = state.run!;
  run.regionRoute = [
    REGIONS[index].name,
    ...REGIONS.filter((_, n) => n !== index)
      .slice(0, 3)
      .map((r) => r.name),
  ];
  run.wave = 5;
  spawnWave(run);
  const f = run.fighter;
  if (appearance !== undefined) f.appearance = appearance;
  f.level = f.spent = run.spent = 16;
  f.augments = ['swift'];
  f.augmentOffers = [];
  f.xp = xpThreshold(16);
  f.x = 960;
  f.y = 520;
  run.offers = [];
  const enemy = run.enemies[0];
  run.enemies = Array.from({ length: 7 }, (_, slot) => ({
    ...enemy,
    id: 500 + slot,
    kind: slot < 3 ? (['sword', 'spear', 'archer'] as const)[slot] : ('chief' as const),
    bossId: slot < 3 ? undefined : `${index}-${slot - 2}`,
    ...(ordinaryRoles
      ? {
          role: slot < 3 ? ordinaryRoles[slot] : undefined,
          kind: slot < 3 ? ROLE_PROFILES[ordinaryRoles[slot]!].kind : ('chief' as const),
        }
      : {}),
    x: slot < 3 ? 480 + slot * 480 : 390 + (slot - 3) * 380,
    y: slot < 3 ? 380 : 680,
    hp: 100000,
    maxHp: 100000,
    speed: 0,
    state: 'windup' as const,
    timer: 1000,
    skillClock: 0,
  }));
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
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
  if (!wait) return;
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', String(index));
}

export async function observeScene(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/game/CombatScene.ts';
    const { CombatScene } = await (window as any).regionModule(path);
    const draw = CombatScene.prototype.draw;
    CombatScene.prototype.draw = function (run: unknown) {
      (window as any).regionScene = this;
      draw.call(this, run);
    };
  });
  await page.waitForFunction(() => !!(window as any).regionScene);
}
