import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (let region = 0; region < 10; region++)
  test(`지역 ${region} 모든 역할·보스 실제 동작 그림`, async ({ page }) => {
    test.setTimeout(90000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const result = await page.evaluate(async (region) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { REGION_ROSTERS, ROLE_PROFILES } = await load('/src/domain/region-enemies.ts');
      const { REGIONS } = await load('/src/domain/campaign.ts');
      const { isBossEnemy } = await load('/src/domain/boss-resilience.ts');
      const scene = (window as any).regionScene,
        r = store.state.run;
      store.paused = true;
      scene.scene.pause();
      scene.feedback.reset();
      scene.motionClock.reset();
      const base = r.enemies[0];
      r.enemies = [...new Set<string>(REGION_ROSTERS[REGIONS[region].name])].map((role, i) => ({
        ...base,
        role,
        bossId: undefined,
        kind: ROLE_PROFILES[role].kind,
        id: 700 + i,
        x: 320 + i * 300,
        y: 400,
        aim: 0,
        facing: 0,
      }));
      for (let phase = 1; phase <= 4; phase++)
        r.enemies.push({
          ...base,
          role: undefined,
          bossId: `${region}-${phase}`,
          kind: 'chief',
          id: 720 + phase,
          x: 400 + phase * 300,
          y: 740,
          aim: 0,
          facing: 0,
        });
      const failures: string[] = [];
      for (const enemy of r.enemies)
        for (let d = 0; d < 8; d++)
          for (const [state, pose] of [
            ['windup', 2],
            ['strike', 3],
            ['recover', 0],
          ] as const) {
            scene.animationTime += 1;
            enemy.state = state;
            enemy.moving = false;
            enemy.timer = 0.15;
            enemy.aim = enemy.facing = (d * Math.PI) / 4;
            scene.drawEnemy(enemy);
            const actor = scene.actors.get(String(enemy.id)),
              mesh = scene.continuousActors.get(String(enemy.id))?.mesh;
            if (actor.getData('authoredFrame')) {
              if (!actor.visible || actor.getData('motionAction') !== state)
                failures.push(`${enemy.id}/${state}: authored action`);
              if (![actor.x, actor.y, actor.scaleX, actor.scaleY].every(Number.isFinite))
                failures.push(`${enemy.id}/${state}: authored geometry`);
              if (actor.getData('view') !== [2, 1, 0, 1, 2, 3, 4, 3][d])
                failures.push(`${enemy.id}/${state}: authored direction`);
              continue;
            }
            const native = d < 5 || state !== 'recover';
            if (actor.getData('nativePose') !== native)
              failures.push(`${enemy.role ?? enemy.bossId}/${d}/${state}: source`);
            if (d < 5 && !actor.frame.name.endsWith(`-${pose}`))
              failures.push(`${enemy.id}/${state}: frame`);
            const replacement =
              enemy.bossId === '2-1' ||
              enemy.bossId === '4-4' ||
              (!enemy.bossId &&
                region === 4 &&
                enemy.kind === 'archer' &&
                enemy.role !== 'engineer');
            if (
              native &&
              replacement &&
              !actor.texture.key.startsWith(
                d >= 5 ? 'hostile-identity-rear' : 'hostile-identity-actions',
              )
            )
              failures.push(`${enemy.id}/${state}: replacement identity`);
            if (d >= 5 && state !== 'recover' && !actor.getData('rearPose'))
              failures.push(`${enemy.id}/${d}/${state}: rear action missing`);
            if (!mesh.vertices.every(Number.isFinite))
              failures.push(`${enemy.id}/${state}: geometry`);
            if (Math.abs(actor.y - enemy.y) > 10) failures.push(`${enemy.id}/${state}: feet`);
          }
      for (const enemy of r.enemies) {
        scene.animationTime += 1;
        enemy.state = 'approach';
        enemy.staggerTime = 0.09;
        enemy.aim = enemy.facing = 0;
        scene.feedback.receive(
          [
            {
              kind: 'impact',
              target: enemy.id,
              x: enemy.x,
              y: enemy.y,
              amount: 1,
              angle: 0,
              killed: false,
            },
          ],
          scene.animationTime,
          false,
        );
        scene.drawEnemy(enemy);
        const hurtPose = scene.actors.get(String(enemy.id)).frame.name.endsWith('-4');
        // Bosses intentionally keep their combat stance on damage; this became
        // a rule after the original per-region presentation audit was written.
        if (isBossEnemy(enemy) ? hurtPose : !hurtPose)
          failures.push(`${enemy.id}: ${isBossEnemy(enemy) ? 'boss flinched' : 'hurt missing'}`);
        enemy.state = 'strike';
        scene.drawEnemy(enemy);
        const actor = scene.actors.get(String(enemy.id));
        if (
          actor.getData('authoredFrame')
            ? actor.getData('motionAction') !== 'strike'
            : actor.getData('drawingPose') !== 3
        )
          failures.push(`${enemy.id}: impact masked attack`);
        scene.drawEnemy(enemy, 0.18);
        if (!scene.actors.get(String(enemy.id)).frame.name.endsWith('-5'))
          failures.push(`${enemy.id}: death`);
      }
      scene.feedback.reset();
      for (const enemy of r.enemies) {
        enemy.state = 'windup';
        enemy.staggerTime = 0;
        enemy.timer = 0.15;
        scene.animationTime += 1;
        enemy.aim = enemy.facing = 0;
      }
      scene.draw(r);
      return { failures, count: r.enemies.length };
    }, region);
    expect(result.failures).toEqual([]);
    expect(result.count).toBeGreaterThan(4);
    expect(errors).toEqual([]);
    await mkdir('docs/verification/hostile-consistency-v3', { recursive: true });
    await page.screenshot({
      path: `docs/verification/hostile-consistency-v3/region-${region}-ready.png`,
    });
  });
