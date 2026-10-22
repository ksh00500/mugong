import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

test('actual renderer keeps recovery sources stable between simulation frames', async ({
  page,
}) => {
  test.setTimeout(90000);
  await seedRegion(page, 5, false);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 30000,
  });
  await observeScene(page);
  const rows = await page.evaluate(async () => {
    const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
    gameStore.paused = true;
    const scene = (window as any).regionScene,
      r = gameStore.state.run;
    scene.scene.pause();
    scene.feedback.reset();
    scene.motionClock.reset();
    const results: {
      id: number;
      fps: number;
      movingSources: string[];
      stoppedSources: string[];
      movingNative: boolean[];
      stoppedNative: boolean[];
    }[] = [];
    for (const fps of [60, 120, 144])
      for (const enemy of r.enemies) {
        Object.assign(enemy, { state: 'recover', timer: 0.1, aim: 0, facing: 0, moving: true });
        const movingSources = new Set<string>(),
          stoppedSources = new Set<string>(),
          movingNative = new Set<boolean>(),
          stoppedNative = new Set<boolean>();
        for (let frame = 0; frame < Math.ceil(fps * 0.25); frame++) {
          scene.animationTime += 1 / fps;
          // Unchanged coordinates deliberately reproduce intermediate render frames.
          scene.drawEnemy(enemy);
          const actor = scene.actors.get(String(enemy.id));
          movingSources.add(actor.texture.key);
          movingNative.add(actor.getData('nativePose'));
        }
        enemy.moving = false;
        for (let frame = 0; frame < Math.ceil(fps * 0.25); frame++) {
          scene.animationTime += 1 / fps;
          scene.drawEnemy(enemy);
          const actor = scene.actors.get(String(enemy.id));
          stoppedSources.add(actor.texture.key);
          stoppedNative.add(actor.getData('nativePose'));
        }
        results.push({
          id: enemy.id,
          fps,
          movingSources: [...movingSources],
          stoppedSources: [...stoppedSources],
          movingNative: [...movingNative],
          stoppedNative: [...stoppedNative],
        });
      }
    return results;
  });
  expect(rows).toHaveLength(21);
  for (const row of rows) {
    expect(row.movingSources).toHaveLength(1);
    expect(row.stoppedSources).toHaveLength(1);
    expect(row.movingNative).toEqual([false]);
    expect(row.stoppedNative).toEqual([true]);
  }
  await mkdir('docs/verification/character-growth-v2', { recursive: true });
  await writeFile(
    'docs/verification/character-growth-v2/renderer-movement.json',
    JSON.stringify(rows, null, 2),
  );
});
