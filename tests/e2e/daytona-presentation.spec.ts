import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS, bossById } from '../../src/domain/campaign';
import { xpThreshold } from '../../src/domain/content';

test('Daytona 범위선 정리 빌드에서 보스·설치물·실제 위험 구역을 표시한다', async ({ page }) => {
  test.skip(!process.env.MUGONG_DAYTONA_URL, '공개 배포 검증 전용');
  const proof = 'docs/verification/daytona-20261002-combat-presentation-v1/public';
  await mkdir(proof, { recursive: true });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const state = emptyGame(); startRun(state, '배포 전투 검증', 123);
  const run = state.run!;
  run.regionRoute = [REGIONS[9].name, REGIONS[0].name, REGIONS[3].name, REGIONS[8].name];
  run.wave = 5; spawnWave(run); run.offers = [];
  const boss = run.enemies.find(enemy => enemy.kind === 'chief' || enemy.kind === 'captain')!;
  Object.assign(boss, { x: 960, y: 390, state: 'windup', timer: 1000, speed: 0 });
  run.enemies = [boss];
  run.fighter.level = run.fighter.spent = run.spent = 16;
  run.fighter.xp = xpThreshold(16);
  Object.assign(run.fighter, { x: 1320, y: 740 });
  run.encounterObjects = ['turret', 'turret', 'seal'].map((kind, index) => ({
    id: 101 + index, owner: boss.id, kind: kind as 'turret' | 'seal',
    x: index === 2 ? 1010 : 720 + index * 480, y: index === 2 ? 680 : 460,
    radius: index === 2 ? 130 : 45, warning: 0, life: 1000, pulse: 1000,
    hp: index === 2 ? 0 : 30, maxHp: index === 2 ? 0 : 30, aim: 1,
  }));
  run.zones = [{ id: 800, kind: 'trap', x: 730, y: 760, radius: 85,
    warning: 0, life: 1000, pulse: 1000 }];
  await page.goto('/'); await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async state => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('mugong-local-v1', 1); request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>(resolve => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current'); tx.oncomplete = () => resolve();
    }); db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', '9');
  await expect(page.locator('.boss-panel > b')).toContainText(bossById(boss.bossId)!.name);
  await page.screenshot({ path: `${proof}/boss-clean.png` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.screenshot({ path: `${proof}/boss-reduced-motion.png` });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '가방 · 정보 확인' })).toBeHidden();
  expect(errors).toEqual([]);
});
