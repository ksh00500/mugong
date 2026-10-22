import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

test('registers Dokmu special frames when loading another region at runtime', async ({ page }) => {
  test.setTimeout(180000);
  await seedRegion(page, 4);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const load = (window as any).regionModule;
    const { gameStore } = await load('/src/platform/store.ts');
    const { DOKMU_SPECIAL_ART } = await load('/src/game/boss-special.ts');
    const scene = (window as any).regionScene;
    gameStore.paused = true;
    scene.scene.pause();
    const before = JSON.stringify(gameStore.state.run);
    await scene.loadRegion(1);
    const failures: string[] = [];
    let count = 0;
    for (const art of DOKMU_SPECIAL_ART.characters)
      for (const f of art.frames) {
        const texture = scene.textures.get(f.texture);
        const actual = texture.get(f.name);
        count++;
        if (
          !texture.has(f.name) ||
          actual.name !== f.name ||
          actual.cutX !== f.x ||
          actual.cutY !== f.y ||
          actual.cutWidth !== f.width ||
          actual.cutHeight !== f.height
        )
          failures.push(f.texture + '/' + f.name);
      }
    return { count, failures, unchanged: before === JSON.stringify(gameStore.state.run) };
  });
  expect(result.count).toBe(240);
  expect(result.failures).toEqual([]);
  expect(result.unchanged).toBe(true);
  await mkdir('docs/verification/dokmu-special-v1', { recursive: true });
  await writeFile(
    'docs/verification/dokmu-special-v1/runtime-region.json',
    JSON.stringify(result, null, 2),
  );
});
