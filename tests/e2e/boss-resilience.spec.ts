import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const proof = 'docs/verification/boss-resilience-v1';
for (let region = 0; region < 10; region++)
  test(`지역 ${region}: 보스 4종 팔방 피격이 준비·공격·회수를 덮지 않는다`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mkdir(proof, { recursive: true });
    await seedRegion(page, region);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const { enemyAttack } = await (window as any).regionModule('/src/domain/combat.ts');
      const scene = (window as any).regionScene,
        r = store.state.run;
      store.rendererReady = false;
      const enemies = r.enemies.filter((e: any) => e.bossId);
      r.enemies = enemies;
      r.zones = [];
      r.effects = [];
      r.projectiles = [];
      r.encounterObjects = [];
      r.formations = [];
      const failures: any[] = [];
      let cases = 0,
        maxRecoil = 0;
      for (const e of enemies) {
        // Include stale saved CC: renderer must also ignore it before the next tick.
        e.staggerTime = 4;
        e.confused = 4;
        e.moving = false;
        for (let dir = 0; dir < 8; dir++)
          for (const state of ['approach', 'windup', 'strike', 'recover']) {
            e.state = state;
            e.aim = e.facing = (dir * Math.PI) / 4;
            const p = enemyAttack(e);
            const duration = p.melee?.duration ?? 0.18;
            e.timer = state === 'strike' ? duration * 0.5 : 0.2;
            e.strike =
              state === 'strike'
                ? {
                    fromX: e.x,
                    fromY: e.y,
                    toX: e.x,
                    toY: e.y,
                    duration,
                    damage: 1,
                    hit: false,
                    contactsDone: 0,
                  }
                : undefined;
            scene.feedback.reset();
            scene.drawEnemy(e);
            const mesh = scene.continuousActors.get(String(e.id)).mesh;
            const actor = scene.actors.get(String(e.id));
            const before = {
              action: mesh.getData('action'),
              texture: actor.texture.key,
              frame: actor.frame.name,
              width: actor.displayWidth,
              height: actor.displayHeight,
              x: actor.x,
              y: actor.y,
              vertices: Array.from(mesh.vertices) as number[],
            };
            scene.feedback.receive(
              [
                {
                  kind: 'impact',
                  target: e.id,
                  x: e.x,
                  y: e.y,
                  angle: 0,
                  amount: 1,
                  killed: false,
                },
              ],
              scene.animationTime - 0.01,
              false,
            );
            scene.drawEnemy(e);
            const delta = Math.hypot(actor.x - before.x, actor.y - before.y);
            maxRecoil = Math.max(maxRecoil, delta);
            if (
              !Number.isFinite(delta) ||
              ![
                actor.x,
                actor.y,
                actor.displayWidth,
                actor.displayHeight,
                ...before.vertices,
                ...mesh.vertices,
              ].every(Number.isFinite) ||
              mesh.getData('action') !== before.action ||
              mesh.getData('action') === 'hurt' ||
              actor.texture.key !== before.texture ||
              actor.frame.name !== before.frame ||
              actor.displayWidth !== before.width ||
              actor.displayHeight !== before.height ||
              JSON.stringify(Array.from(mesh.vertices)) !== JSON.stringify(before.vertices) ||
              delta > 0.350001
            )
              failures.push({ id: e.bossId, dir, state, delta });
            cases++;
          }
      }
      // Show four identities in ready/contact rows; all are receiving hits.
      r.enemies = enemies.flatMap((e: any, i: number) =>
        ['windup', 'strike'].map((state, row) => ({
          ...e,
          id: 800 + i + row * 4,
          x: 400 + i * 370,
          y: 400 + row * 280,
          state,
          aim: 0,
          facing: 0,
          timer: 0.15,
          strike: undefined,
          moving: false,
        })),
      );
      scene.feedback.reset();
      scene.feedback.receive(
        r.enemies.map((e: any) => ({
          kind: 'impact',
          target: e.id,
          x: e.x,
          y: e.y,
          angle: 0,
          amount: 1,
          killed: false,
        })),
        scene.animationTime - 0.01,
        false,
      );
      scene.draw(r);
      return { cases, maxRecoil, failures };
    });
    expect(result.cases).toBe(128);
    expect(result.failures).toEqual([]);
    expect(Number.isFinite(result.maxRecoil)).toBe(true);
    expect(result.maxRecoil).toBeLessThanOrEqual(0.35);
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/region-${region}.json`,
      JSON.stringify({ ...result, errors }, null, 2),
    );
    await page.screenshot({ path: `${proof}/region-${region}.png` });
  });
