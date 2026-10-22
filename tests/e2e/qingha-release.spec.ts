import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = process.env.MUGONG_QINGHA_PROOF ?? 'docs/verification/qingha-family-v1';
test('Qingha dao slash, spear thrust and crossbow bolt show contact at actual release', async ({
  page,
}) => {
  test.setTimeout(90000);
  await seedRegion(page, 0, true, undefined, ['raider', 'guard', 'bowman']);
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
    for (const role of ['raider', 'guard', 'bowman'])
      for (let d = 0; d < 8; d++) {
        for (const key of [
          'offers',
          'zones',
          'projectiles',
          'encounterObjects',
          'formations',
          'encounters',
        ])
          run[key] = [];
        const angle = (d * Math.PI) / 4;
        const e = {
          ...base,
          id: 9000 + d,
          kind: role === 'bowman' ? 'archer' : role === 'guard' ? 'spear' : 'sword',
          role,
          bossId: undefined,
          elite: false,
          x: 800,
          y: 500,
          targetX: 800 + Math.cos(angle) * 75,
          targetY: 500 + Math.sin(angle) * 75,
          state: 'windup',
          timer: 0,
          aim: angle,
          facing: angle,
          staggerTime: 0,
          skillClock: 100,
          hp: 10000,
          maxHp: 10000,
          strike: undefined,
          move: undefined,
          pattern: 0,
        };
        run.enemies = [e];
        Object.assign(run.fighter, {
          x: e.targetX,
          y: e.targetY,
          hp: 120,
          arts: [],
          shield: 0,
          guard: 0,
          fortify: 0,
          invulnerable: 0,
        });
        scene.motionClock.reset();
        scene.feedback.reset();
        const step = () => {
          tick(
            run,
            { dx: 0, dy: 0, aim: angle, attack: false, defense: false, ultimate: false },
            1 / 120,
          );
          scene.animationTime += 1 / 120;
        };
        step();
        const before = run.fighter.hp;
        if (role !== 'bowman')
          for (let frame = 0; frame < 60; frame++) {
            if (run.fighter.hp < before) break;
            step();
          }
        scene.drawEnemy(e);
        const actor = scene.actors.get(String(e.id)),
          f = actor.getData('authoredFrame');
        const released = run.projectiles.filter((p: any) => p.owner === e.id);
        records.push({
          role,
          d,
          state: e.state,
          action: actor.getData('motionAction'),
          kind: f.kind,
          pose: f.pose,
          texture: f.texture,
          before,
          hp: run.fighter.hp,
          projectiles: released.length,
          landing: released[0]?.landing?.kind,
          forward: released.map((p: any) => p.vx * Math.cos(angle) + p.vy * Math.sin(angle)),
        });
      }
    return records;
  });
  for (const r of records) {
    expect(r.state).toBe('strike');
    expect(r.action).toBe('strike');
    expect(r.kind).toBe('combat');
    expect(r.pose).toBe(2);
    expect(r.texture).toContain(`qingha-family-qingha${r.role}-`);
    if (r.role === 'bowman') {
      expect(r.projectiles).toBe(1);
      expect(r.landing).toBeUndefined();
      for (const f of r.forward) expect(f).toBeGreaterThan(0);
    } else {
      expect(r.before).toBe(120);
      expect(r.hp).toBeLessThan(120);
    }
  }
  await mkdir(proof, { recursive: true });
  await writeFile(`${proof}/actual-release.json`, JSON.stringify(records, null, 2));
});
