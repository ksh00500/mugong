import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const proof = 'docs/verification/combat-presentation-v1';
test('기관 보스·설치물·진법에서 판정선 없이 실제 그림과 전투 상태를 유지한다', async ({ page }) => {
  await mkdir(proof, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seedRegion(page, 9);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene,
      run = store.state.run;
    store.rendererReady = false;
    const boss = run.enemies[3];
    Object.assign(boss, {
      bossId: '9-1',
      kind: 'chief',
      role: undefined,
      x: 960,
      y: 370,
      aim: 1.2,
      targetX: 1250,
      targetY: 650,
      timer: 0.25,
      phase: 1,
      guardTime: 1,
    });
    run.enemies = [boss];
    run.effects = [];
    run.zones = [];
    run.encounterObjects = [
      {
        id: 101,
        owner: boss.id,
        kind: 'turret',
        x: 730,
        y: 440,
        radius: 48,
        warning: 0,
        life: 12,
        pulse: 0,
        hp: 30,
        maxHp: 30,
        aim: 0.6,
      },
      {
        id: 102,
        owner: boss.id,
        kind: 'turret',
        x: 1200,
        y: 440,
        radius: 48,
        warning: 0,
        life: 12,
        pulse: 0,
        hp: 30,
        maxHp: 30,
        aim: 1.1,
      },
      {
        id: 103,
        owner: boss.id,
        kind: 'mine',
        x: 760,
        y: 710,
        radius: 90,
        warning: 0,
        life: 12,
        pulse: 0.8,
        hp: 0,
        maxHp: 0,
        aim: 0,
      },
      {
        id: 104,
        owner: boss.id,
        kind: 'seal',
        x: 990,
        y: 650,
        radius: 145,
        warning: 0,
        life: 12,
        pulse: 0.8,
        hp: 0,
        maxHp: 0,
        aim: 0,
      },
    ];
    run.formations = [{ x: 420, y: 560, life: 5, damage: 1, pulse: 1, pulses: 1, kind: 'earth' }];
    Object.assign(run.fighter, { x: 1330, y: 700 });
    run.projectiles = [
      {
        id: 250,
        x: 1060,
        y: 470,
        vx: 100,
        vy: 150,
        owner: boss.id,
        hostileToEnemies: false,
        damage: 10,
        radius: 12,
        life: 1,
        color: 0xd6513e,
        visual: 'poison-bomb',
        landing: { x: 1430, y: 820, radius: 120, kind: 'poison' },
      },
    ];
    const before = JSON.stringify(run);
    const geometry: string[] = [];
    for (const graphics of [scene.ground, scene.graphics])
      for (const method of ['strokeCircle', 'strokeEllipse', 'strokePath', 'lineBetween']) {
        const original = graphics[method];
        graphics[method] = function (...args: unknown[]) {
          geometry.push(method);
          return original.apply(this, args);
        };
      }
    scene.draw(run);
    store.notify();
    const images = scene.paintedZones.pool
      .filter((image: any) => image.visible)
      .map((image: any) => ({ frame: image.frame.name, x: image.x, y: image.y }));
    return {
      geometry,
      unchanged: before === JSON.stringify(run),
      images,
      bossAction: scene.continuousActors.get(String(boss.id)).mesh.getData('action'),
      projectile: scene.paintedEffects.pool.some(
        (image: any) =>
          image.visible &&
          image.texture.key === 'hostile-projectiles' &&
          image.frame.name === 'poison-bomb',
      ),
    };
  });
  expect(result.geometry).toEqual([]);
  expect(result.unchanged).toBe(true);
  expect(result.bossAction).toBe('windup');
  expect(result.projectile).toBe(true);
  expect(result.images.some((image: any) => image.x === 1430)).toBe(false);
  expect(result.images.filter((image: any) => image.frame === 'gate')).toHaveLength(2);
  for (const [width, height] of [
    [1440, 900],
    [1093, 614],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `${proof}/boss-clean-${width}x${height}.png` });
  }
  expect(errors).toEqual([]);
  await writeFile(`${proof}/boss-clean.json`, JSON.stringify(result, null, 2));
});

test('21종 일반 적과 40보스의 준비·회복에서 범위와 타이머 도형을 그리지 않는다', async ({
  page,
}) => {
  await seedRegion(page, 0);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const { ROLE_PROFILES } = await (window as any).regionModule('/src/domain/region-enemies.ts');
    const { enemyAttack } = await (window as any).regionModule('/src/domain/combat.ts');
    const scene = (window as any).regionScene,
      run = store.state.run,
      enemy = run.enemies[0];
    store.rendererReady = false;
    run.enemies = [enemy];
    run.effects = [];
    run.projectiles = [];
    run.zones = [];
    run.formations = [];
    run.encounterObjects = [];
    const calls: string[] = [];
    for (const graphics of [scene.ground, scene.graphics])
      for (const method of ['strokeCircle', 'strokeEllipse', 'strokePath', 'lineBetween']) {
        const original = graphics[method];
        graphics[method] = function (...args: unknown[]) {
          calls.push(method);
          return original.apply(this, args);
        };
      }
    const states: { id: string; action: string; unchanged: boolean }[] = [];
    function check(id: string) {
      for (const state of ['windup', 'recover']) {
        Object.assign(enemy, {
          state,
          timer: enemyAttack(enemy).windup * 0.35,
          x: 960,
          y: 400,
          targetX: 1200,
          targetY: 600,
          aim: 0.5,
          rageTime: 1,
          guardTime: 1,
        });
        const before = JSON.stringify(run);
        scene.draw(run);
        states.push({
          id: `${id}:${state}`,
          action: scene.continuousActors.get(String(enemy.id)).mesh.getData('action'),
          unchanged: before === JSON.stringify(run),
        });
      }
    }
    for (const [role, profile] of Object.entries(ROLE_PROFILES) as [string, any][]) {
      Object.assign(enemy, { role, kind: profile.kind, bossId: undefined, phase: 0 });
      check(role);
    }
    for (let region = 0; region < 10; region++)
      for (let boss = 1; boss <= 4; boss++) {
        Object.assign(enemy, {
          role: undefined,
          kind: 'chief',
          bossId: `${region}-${boss}`,
          phase: 2,
        });
        check(enemy.bossId);
      }
    return { calls, states };
  });
  expect(result.calls).toEqual([]);
  expect(result.states).toHaveLength(122);
  expect(result.states.every((state) => state.unchanged)).toBe(true);
  expect(result.states.filter((state) => state.action === 'windup')).toHaveLength(61);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => (window as any).regionScene.reducedMotion === true);
  const reduced = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene,
      run = store.state.run,
      enemy = run.enemies[0];
    const points = () => Array.from(scene.continuousActors.get(String(enemy.id)).mesh.vertices);
    enemy.state = 'windup';
    enemy.timer = 0.35;
    scene.draw(run);
    const ready = points();
    enemy.timer = 0.15;
    scene.draw(run);
    const later = points();
    enemy.state = 'approach';
    scene.draw(run);
    const idle = points();
    return { enabled: scene.reducedMotion, ready, later, idle };
  });
  expect(reduced.enabled).toBe(true);
  expect(reduced.ready).toEqual(reduced.later);
  expect(reduced.ready).not.toEqual(reduced.idle);
  await writeFile(`${proof}/all-enemies.json`, JSON.stringify(result, null, 2));
});

test('독·냉기·함정은 발동 전에 숨기고 발동 후 그림을 유지하며 만료하면 회수한다', async ({
  page,
}) => {
  await seedRegion(page, 1);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene,
      run = store.state.run;
    store.rendererReady = false;
    run.effects = [];
    run.projectiles = [];
    run.encounterObjects = [];
    run.formations = [];
    run.zones = ['poison', 'cold', 'trap'].map((kind, index) => ({
      id: index + 1,
      kind,
      x: 550 + index * 350,
      y: 550,
      radius: 100,
      warning: 0.5,
      life: 5,
      pulse: 0,
    }));
    scene.draw(run);
    const before = scene.paintedZones.pool.filter((image: any) => image.visible).length;
    run.zones.forEach((zone: any) => (zone.warning = 0));
    scene.draw(run);
    const active = scene.paintedZones.pool
      .filter((image: any) => image.visible)
      .map((image: any) => image.frame.name);
    const allocated = scene.paintedZones.pool.length;
    for (let frame = 0; frame < 120; frame++) scene.draw(run);
    const stable = allocated === scene.paintedZones.pool.length;
    run.zones.forEach((zone: any) => (zone.life = 0));
    scene.draw(run);
    const expired = scene.paintedZones.pool.filter((image: any) => image.visible).length;
    return { before, active, stable, expired };
  });
  expect(result).toEqual({
    before: 0,
    active: ['poison', 'cold', 'trap'],
    stable: true,
    expired: 0,
  });
});
