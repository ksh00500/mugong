import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
test('ordinary Shaolin damage and stone release show the corresponding contact drawing', async ({
  page,
}) => {
  test.setTimeout(90000);
  await seedRegion(page, 4);
  await observeScene(page);
  const records = await page.evaluate(async () => {
    const load = (window as any).regionModule;
    const { gameStore } = await load('/src/platform/store.ts');
    const { tick } = await load('/src/domain/game.ts');
    const scene = (window as any).regionScene,
      run = gameStore.state.run;
    gameStore.paused = true;
    scene.scene.pause();
    const base = run.enemies[0],
      records = [];
    for (const role of ['brawler', 'slinger'])
      for (let d = 0; d < 8; d++) {
        run.offers = [];
        run.zones = [];
        run.projectiles = [];
        run.encounterObjects = [];
        run.formations = [];
        run.encounters = [];
        const angle = (d * Math.PI) / 4,
          e = {
            ...base,
            id: 9000 + d,
            kind: role === 'slinger' ? 'archer' : 'sword',
            role,
            bossId: undefined,
            elite: false,
            x: 800,
            y: 500,
            state: 'windup',
            timer: 0,
            aim: angle,
            facing: angle,
            staggerTime: 0,
            skillClock: 100,
            hp: 10000,
            maxHp: 10000,
            strike: undefined,
          };
        run.enemies = [e];
        Object.assign(run.fighter, {
          x: 800 + Math.cos(angle) * 75,
          y: 500 + Math.sin(angle) * 75,
          hp: 120,
          arts: [],
          shield: 0,
          guard: 0,
          fortify: 0,
          invulnerable: 0,
        });
        scene.motionClock.reset();
        scene.feedback.reset();
        tick(
          run,
          { dx: 0, dy: 0, aim: angle, attack: false, defense: false, ultimate: false },
          1 / 120,
        );
        scene.animationTime += 1 / 120;
        scene.drawEnemy(e);
        const actor = scene.actors.get(String(e.id)),
          f = actor.getData('authoredFrame');
        records.push({
          role,
          d,
          state: e.state,
          action: actor.getData('motionAction'),
          pose: f.pose,
          kind: f.kind,
          hp: run.fighter.hp,
          projectiles: run.projectiles.filter((p: any) => p.owner === e.id).length,
        });
      }
    return records;
  });
  for (const r of records) {
    expect(r.state).toBe('strike');
    expect(r.action).toBe('strike');
    expect(['combat', 'special']).toContain(r.kind);
    expect(r.pose).toBe(2);
    if (r.role === 'brawler') expect(r.hp).toBeLessThan(120);
    else expect(r.projectiles).toBe(1);
  }
  await mkdir('docs/verification/shaolin-family-v1', { recursive: true });
  await writeFile(
    'docs/verification/shaolin-family-v1/actual-release.json',
    JSON.stringify(records, null, 2),
  );
});
