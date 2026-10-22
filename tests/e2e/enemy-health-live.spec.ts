import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`소림 실제 이동·공격 입력과 HP바 ${width}x${height}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 4);
    await observeScene(page);
    const start = await page.evaluate(async () => {
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      const scene = (window as any).regionScene;
      const run = gameStore.state.run;
      run.fighter.invulnerable = 100;
      run.offers = [];
      run.fighter.x = 960;
      run.fighter.y = 540;
      run.enemies.forEach((e: any, i: number) =>
        Object.assign(e, {
          x: 720 + i * 70,
          y: i % 2 ? 400 : 650,
          state: 'approach',
          timer: 0,
          moving: true,
          speed: 65,
          skillClock: 0,
          staggerTime: 0,
        }),
      );
      (window as any).liveEnemyHealth = { samples: 0, minGap: Infinity, states: [] as string[] };
      const original = scene.drawEnemy.bind(scene);
      scene.drawEnemy = (e: any, age: number | undefined) => {
        original(e, age);
        const stats = (window as any).liveEnemyHealth;
        const actor = scene.actors.get(String(e.id));
        const bar = actor.getData('healthBar');
        if (bar) {
          stats.samples++;
          stats.minGap = Math.min(stats.minGap, bar.renderedTop - bar.y - bar.height);
          if (!stats.states.includes(e.state)) stats.states.push(e.state);
        }
      };
      gameStore.paused = false;
      return { x: run.fighter.x, y: run.fighter.y };
    });
    const canvas = await page.locator('.game-canvas canvas').boundingBox();
    await page.mouse.move(canvas!.x + canvas!.width * 0.4, canvas!.y + canvas!.height * 0.5);
    await page.mouse.down();
    await page.keyboard.down('d');
    await page.waitForTimeout(500);
    await page.keyboard.up('d');
    await page.keyboard.down('w');
    await page.waitForTimeout(500);
    await page.keyboard.up('w');
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    const result = await page.evaluate(async () => {
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      gameStore.paused = true;
      return {
        ...(window as any).liveEnemyHealth,
        x: gameStore.state.run.fighter.x,
        y: gameStore.state.run.fighter.y,
      };
    });
    const proof = 'docs/verification/enemy-scale-health-v3/live';
    await mkdir(proof, { recursive: true });
    await writeFile(`${proof}/${width}.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${proof}/${width}.png` });
    expect(errors).toEqual([]);
    expect(Math.hypot(result.x - start.x, result.y - start.y)).toBeGreaterThan(30);
    expect(result.samples).toBeGreaterThan(100);
    expect(result.states).toContain('windup');
    expect(result.states).toContain('strike');
    expect(result.minGap).toBeGreaterThanOrEqual(6.9999);
  });
