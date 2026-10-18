import { test, expect } from '@playwright/test';
import { seedRegion, observeScene } from './support/region';

test('주인공 공격과 기관 장치 실제 표시 검사', async ({ page }) => {
  test.setTimeout(90000);
  await seedRegion(page, 6, false);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene, r = store.state.run;
    store.paused = true;
    scene.scene.pause();
    r.encounterObjects = ['blade', 'drone'].map((mechanic, i) => ({ mechanic, kind: 'flag', id: 9000 + i,
      x: 650 + i * 500, y: 450, life: 10, warning: 0, age: 12, radius: 30 }));
    const masses: number[] = [];
    for (const [action, actionTime] of [['idle', 0], ['attack', .3], ['attack', .12]] as const) {
      r.fighter.action = action; r.fighter.actionTime = actionTime; r.fighter.facing = Math.PI / 2;
      scene.animationTime += 1; scene.draw(r);
      const actor = scene.actors.get('hero'); const f = scene.heroFrames.get(actor.frame.name);
      masses.push(f.bodyUnit ** 2 * actor.scaleX * actor.scaleY);
    }
    return { masses, rotations: [9000, 9001].map(id => scene.actors.get(`object-${id}`).rotation) };
  });
  expect(result.rotations).toEqual([0, 0]);
  for (const mass of result.masses) expect(mass / result.masses[0]).toBeCloseTo(1, 3);
  await page.screenshot({ path: 'docs/verification/animation-calibration-v7/hero-attack-and-machines.png' });
});
