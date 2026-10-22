import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/enemy-footwork-v4';
for (const region of [0, 1, 7, 9])
  test(`지역 ${region} 대기 스텝과 공격·회복 연결`, async ({ browser }) => {
    test.setTimeout(120000);
    await mkdir(proof, { recursive: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: proof, size: { width: 1440, height: 900 } },
    });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        const get = proto.getExtension;
        proto.getExtension = function (name: string) {
          return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
        };
      }
    });
    await seedRegion(page, region, false);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await observeScene(page);
    await page.evaluate(async (region) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { REGION_ROSTERS, ROLE_PROFILES } = await load('/src/domain/region-enemies.ts');
      const { REGIONS } = await load('/src/domain/campaign.ts');
      const r = store.state.run,
        scene = (window as any).regionScene;
      store.paused = true;
      scene.scene.pause();
      r.offers = [];
      r.zones = [];
      r.encounterObjects = [];
      r.fighter.invulnerable = 100;
      r.fighter.action = 'idle';
      const base = r.enemies[0];
      r.enemies = [...new Set<string>(REGION_ROSTERS[REGIONS[region].name])].map((role, i) => {
        const d = ROLE_PROFILES[role].distance || 90,
          a = (i * 2 * Math.PI) / 3;
        return {
          ...base,
          id: 800 + i,
          role,
          kind: ROLE_PROFILES[role].kind,
          bossId: undefined,
          x: r.fighter.x + Math.cos(a) * d,
          y: r.fighter.y + Math.sin(a) * d,
          timer: 0.2 + i * 0.12,
          state: 'approach',
          skillClock: 0,
          hp: 10000,
          maxHp: 10000,
        };
      });
      (window as any).footworkStats = r.enemies.map((e: any) => ({
        id: e.id,
        role: e.role,
        travel: 0,
        still: 0,
        maxStill: 0,
        attacks: 0,
        walkRecovery: 0,
      }));
    }, region);
    for (let slice = 0; slice < 18; slice++) {
      await page.evaluate(async () => {
        const load = (window as any).regionModule;
        const { gameStore: store } = await load('/src/platform/store.ts');
        const { tick } = await load('/src/domain/game.ts');
        const scene = (window as any).regionScene,
          r = store.state.run;
        for (let frame = 0; frame < 20; frame++) {
          const previous = r.enemies.map((e: any) => ({ x: e.x, y: e.y, state: e.state }));
          tick(r, { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false }, 1 / 60);
          scene.animationTime += 1 / 60;
          scene.draw(r);
          r.enemies.forEach((e: any, i: number) => {
            const stat = (window as any).footworkStats[i],
              before = previous[i];
            const moved = Math.hypot(e.x - before.x, e.y - before.y);
            stat.travel += moved;
            stat.still = moved < 0.05 ? stat.still + 1 / 60 : 0;
            stat.maxStill = Math.max(stat.maxStill, stat.still);
            if (before.state !== 'strike' && e.state === 'strike') stat.attacks++;
            const mesh = scene.continuousActors.get(String(e.id)).mesh;
            if (e.state === 'recover' && moved > 0.05 && mesh.getData('action') === 'walk')
              stat.walkRecovery++;
            if (!mesh.vertices.every(Number.isFinite))
              throw new Error(`invalid geometry ${e.role}`);
          });
        }
      });
      await page.waitForTimeout(90);
      if ([3, 8, 15].includes(slice))
        await page.screenshot({ path: `${proof}/region-${region}-${slice}.png` });
    }
    const stats = await page.evaluate(() => (window as any).footworkStats);
    for (const stat of stats) {
      expect(stat.travel).toBeGreaterThan(30);
      expect(stat.maxStill).toBeLessThan(3);
      expect(stat.attacks).toBeGreaterThanOrEqual(1);
      expect(stat.walkRecovery).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
    await writeFile(`${proof}/region-${region}.json`, JSON.stringify(stats, null, 2));
    const video = page.video()!;
    await context.close();
    await video.saveAs(`${proof}/region-${region}.webm`);
  });
