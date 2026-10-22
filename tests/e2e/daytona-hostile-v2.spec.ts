import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { REGION_ROSTERS, ROLE_PROFILES } from '../../src/domain/region-enemies';
import { hazardProjectileVisual } from '../../src/domain/projectile-visual';
import { xpThreshold } from '../../src/domain/content';
import { isGameSave } from '../../src/platform/save-validation';

for (const region of [3, 5]) test(`Daytona 최신 지역 ${region} 투척수·장판 그림`, async ({ page }) => {
  test.skip(!process.env.MUGONG_DAYTONA_URL);
  const proof = 'docs/verification/daytona-20261002-hostile-balance-v2/public';
  await mkdir(proof, { recursive: true });
  const errors: string[] = [], failed: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
  const state = emptyGame(); startRun(state, '공개 그림 검증', 123);
  const run = state.run!;
  run.regionRoute = [REGIONS[region].name, ...REGIONS.filter((_, i) => i !== region).slice(0, 3).map(r => r.name)]; run.offers = [];
  run.fighter.level = run.fighter.spent = run.spent = 16;
  run.fighter.xp = xpThreshold(16);
  const base = run.enemies[0];
  const roles = [...new Set(REGION_ROSTERS[REGIONS[region].name])];
  run.enemies = roles.map((role, i) => ({ ...base, id: 900 + i, role,
    bossId: undefined, kind: ROLE_PROFILES[role].kind, x: 500 + i * 430,
    y: 410, speed: 0, state: 'windup', timer: 1000, skillClock: 0 }));
  run.zones = [{ id: 800, kind: region === 3 ? 'cold' : 'trap', x: 900,
    y: 650, radius: 100, warning: 0, life: 1000, pulse: 1000 }];
  run.encounterObjects = []; run.projectiles = roles.filter(role => ROLE_PROFILES[role].zone).map(role => ({
    x: 1080, y: 520, vx: 0, vy: 0, life: 1000, friendly: false, damage: 10,
    radius: 14, hits: [], visual: hazardProjectileVisual(ROLE_PROFILES[role].zone!),
    landing: { x: 1100, y: 520, radius: 65, kind: ROLE_PROFILES[role].zone! },
  }));
  expect(isGameSave(state)).toBe(true);
  await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const q = indexedDB.open('mugong-local-v1', 1); q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>(resolve => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, 'current'); tx.oncomplete = () => resolve();
    }); db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', String(region));
  const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r => new URL(r.name).pathname));
  for (const asset of ['enemy-role-directions-v2.png', 'hostile-projectiles-v2.png', 'zone-art-v2.png'])
    expect(resources).toContain(`/art/${asset}`);
  await page.screenshot({ path: `${proof}/region-${region}.png` });
  await writeFile(`${proof}/region-${region}.json`, JSON.stringify({ roles, resources, errors, failed }, null, 2));
  expect(errors).toEqual([]); expect(failed).toEqual([]);
});
