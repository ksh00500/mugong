import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (let region = 0; region < 10; region++)
  test(`지역 ${region} 전술 이동과 4보스 실전 진행`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region, false);
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {timeout:45000});
    await observeScene(page);
    const result = await page.evaluate(async (region) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { tick } = await load('/src/domain/game.ts');
      const { REGION_ROSTERS, ROLE_PROFILES } = await load('/src/domain/region-enemies.ts');
      const { REGIONS } = await load('/src/domain/campaign.ts');
      store.paused = true;
      (window as any).regionScene.scene.pause();
      const r = store.state.run,
        scene = (window as any).regionScene;
      const roster = REGION_ROSTERS[REGIONS[region].name];
      r.enemies.forEach((e: any, n: number) => {
        e.state = 'approach';
        e.timer = n * 0.07;
        if (n < 3) {
          e.role = roster[n];
          e.kind = ROLE_PROFILES[e.role].kind;
        } else e.role = undefined;
      });
      r.fighter.hp = r.fighter.maxHp = 100000;
      const starts = r.enemies.map((e: any) => ({ id: e.id, x: e.x, y: e.y }));
      const states: Record<string, Set<string>> = {};
      for (let frame = 0; frame < 720; frame++) {
        tick(
          r,
          {
            dx: 0,
            dy: frame % 240 < 120 ? 0.5 : -0.5,
            aim: 0,
            attack: false,
            defense: false,
            ultimate: false,
          },
          1 / 60,
        );
        r.enemies.forEach((e: any) => {
          (states[e.id] ??= new Set()).add(e.state);
        });
        scene.animationTime += 1 / 60;
        if (frame % 60 === 0) {
          scene.draw(r);
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
      scene.draw(r);
      return {
        hp: r.fighter.hp,
        phase: r.phase,
        finite: r.enemies.every((e: any) => Number.isFinite(e.x + e.y + e.aim)),
        actors: starts.map((start: any) => {
          const e = r.enemies.find((e: any) => e.id === start.id);
          return {
            id: e.id,
            role: e.role,
            bossId: e.bossId,
            moved: Math.hypot(e.x - start.x, e.y - start.y),
            states: [...states[e.id]],
          };
        }),
      };
    }, region);
    expect(result.finite).toBe(true);
    expect(result.phase).toBe('combat');
    expect(result.hp).toBeLessThan(100000);
    for (const actor of result.actors) {
      expect(actor.moved).toBeGreaterThan(1);
      expect(actor.states, JSON.stringify(actor)).toContain('strike');
      expect(actor.states).toContain('recover');
    }
    expect(errors).toEqual([]);
    const proof = process.env.MUGONG_TACTICS_PROOF ?? 'docs/verification/enemy-tactics-v3';
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/region-${region}.png` });
    await writeFile(`${proof}/region-${region}.json`, JSON.stringify(result, null, 2));
  });
