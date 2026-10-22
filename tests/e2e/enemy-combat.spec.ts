import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/enemy-combat-v1';
for (const [region, role] of [
  [7, 'rider'],
  [5, 'assassin'],
  [8, 'hexer'],
  [3, 'iceweaver'],
  [0, 'guard'],
] as const)
  test(`${region} ${role}: 실제 렌더러에서 공격 동작·조준·피해 확인`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const preparation = await page.evaluate(async (role) => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const { ROLE_PROFILES } = await (window as any).regionModule('/src/domain/region-enemies.ts');
      const { tick } = await (window as any).regionModule('/src/domain/game.ts');
      const r = store.state.run,
        e = r.enemies[0],
        profile = ROLE_PROFILES[role];
      store.rendererReady = false;
      store.paused = false;
      r.enemies = [e];
      r.offers = [];
      r.zones = [];
      r.encounterObjects = [];
      r.projectiles = [];
      r.elapsed = 0;
      r.zoneClock = 0;
      Object.assign(e, {
        role,
        kind: profile.kind,
        bossId: undefined,
        x: 700,
        y: 500,
        state: 'approach',
        timer: 0,
        aim: 0,
        facing: 0,
        xp: 0,
      });
      Object.assign(r.fighter, {
        x: 700 + (profile.distance || (profile.dash ? 200 : 180)),
        y: 500,
        hp: 120,
        invulnerable: 0,
        fortify: 0,
        arts: [],
        active: 0,
      });
      (window as any).enemyIdle = {
        dx: 0,
        dy: 0,
        aim: 0,
        attack: false,
        ultimate: false,
        defense: false,
      };
      tick(r, (window as any).enemyIdle, 1 / 60);
      const scene = (window as any).regionScene;
      scene.animationTime += 1 / 60;
      scene.draw(r);
      store.notify();
      return { state: e.state, targetX: e.targetX, playerX: r.fighter.x };
    }, role);
    expect(preparation.state).toBe('windup');
    expect(preparation.targetX).toBe(preparation.playerX);
    await page.screenshot({ path: `${proof}/${role}-warning.png` });
    const result = await page.evaluate(async () => {
      const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
      const { tick } = await (window as any).regionModule('/src/domain/game.ts');
      const { isGameSave } = await (window as any).regionModule('/src/platform/save-validation.ts');
      const r = store.state.run,
        e = r.enemies[0],
        scene = (window as any).regionScene;
      let maxStep = 0,
        previous = e.x,
        strikeFrames = 0;
      const snapshots = [];
      for (let n = 0; n < 175; n++) {
        tick(r, (window as any).enemyIdle, 1 / 60);
        scene.animationTime += 1 / 60;
        scene.draw(r);
        maxStep = Math.max(maxStep, Math.abs(e.x - previous));
        previous = e.x;
        if (e.state === 'strike') strikeFrames++;
        if (n % 10 === 0) {
          const mesh = scene.continuousActors.get(String(e.id))?.mesh;
          snapshots.push({
            state: e.state,
            x: e.x,
            hp: r.fighter.hp,
            action: mesh?.getData('action'),
            visible: mesh?.visible,
            vertices: mesh ? Array.from(mesh.vertices).slice(-16) : [],
          });
        }
        if (r.fighter.hp < 120 && n > 125) break;
      }
      store.notify();
      return { hp: r.fighter.hp, maxStep, strikeFrames, valid: isGameSave(store.state), snapshots };
    });
    expect(result.hp).toBeLessThan(120);
    expect(result.maxStep).toBeLessThan(35);
    expect(result.strikeFrames).toBeGreaterThan(3);
    expect(result.valid).toBe(true);
    expect(result.snapshots.some((s: any) => s.visible)).toBe(true);
    expect(result.snapshots.some((s: any) => s.action === 'strike')).toBe(true);
    await page.screenshot({ path: `${proof}/${role}-execution.png` });
    await writeFile(`${proof}/${role}.json`, JSON.stringify(result, null, 2));
    expect(errors).toEqual([]);
  });
test('서역 투척환은 회수 전에 플레이어까지 도달한다', async ({ page }) => {
  await seedRegion(page, 7);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const { tick } = await (window as any).regionModule('/src/domain/game.ts');
    const r = store.state.run,
      e = r.enemies[0],
      scene = (window as any).regionScene;
    store.rendererReady = false;
    store.paused = false;
    r.enemies = [e];
    r.zones = [];
    r.encounterObjects = [];
    r.projectiles = [];
    r.elapsed = 0;
    Object.assign(e, {
      role: 'ringblade',
      kind: 'archer',
      bossId: undefined,
      x: 700,
      y: 500,
      aim: 0,
      state: 'windup',
      timer: 0,
      xp: 0,
    });
    Object.assign(r.fighter, { x: 1000, y: 500, hp: 120, invulnerable: 0, arts: [] });
    const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
    tick(r, idle, 1 / 60);
    e.timer = 100;
    const centre = r.projectiles[1];
    for (let n = 0; n < 20; n++) {
      tick(r, idle, 1 / 60);
      scene.animationTime += 1 / 60;
      scene.draw(r);
    }
    const outbound = { x: centre.x, returned: !!centre.returned };
    for (let n = 0; n < 45; n++) {
      tick(r, idle, 1 / 60);
      scene.animationTime += 1 / 60;
      scene.draw(r);
    }
    store.notify();
    return { outbound, hp: r.fighter.hp };
  });
  expect(result.outbound.returned).toBe(false);
  expect(result.outbound.x).toBeGreaterThan(800);
  expect(result.hp).toBeLessThan(120);
  await page.screenshot({ path: `${proof}/ringblade-outbound.png` });
});
test('기마·암살자의 8방향 리그는 이동할 때만 걷고 정지 시에는 제자리 걸음을 하지 않는다', async ({
  page,
}) => {
  await seedRegion(page, 7);
  await observeScene(page);
  const result = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene,
      r = store.state.run;
    store.rendererReady = false;
    store.paused = false;
    r.enemies = r.enemies.slice(0, 2);
    r.zones = [];
    r.encounterObjects = [];
    const samples = [];
    for (const [n, role] of ['rider', 'assassin'].entries()) {
      const e = r.enemies[n];
      Object.assign(e, {
        role,
        bossId: undefined,
        state: 'approach',
        x: 700 + n * 350,
        y: 500,
        facing: 0,
      });
      for (let d = 0; d < 8; d++) {
        e.facing = (d * Math.PI) / 4;
        scene.animationTime += 0.05;
        scene.draw(r);
        scene.animationTime += 0.05;
        scene.draw(r);
        const mesh = scene.continuousActors.get(String(e.id)).mesh;
        const idle = mesh.getData('action');
        e.x += Math.cos(e.facing) * 10;
        e.y += Math.sin(e.facing) * 10;
        scene.animationTime += 0.05;
        scene.draw(r);
        samples.push({
          role,
          d,
          idle,
          moving: mesh.getData('action'),
          direction: mesh.getData('direction'),
          mounted: mesh.getData('mounted'),
          finite: Array.from(mesh.vertices as number[]).every(Number.isFinite),
          visible: mesh.visible,
        });
      }
    }
    store.notify();
    return samples;
  });
  for (const s of result) {
    expect(s.idle).toBe('idle');
    expect(s.moving).toBe('walk');
    expect(s.direction).toBe(s.d);
    expect(s.mounted).toBe(s.role === 'rider');
    expect(s.finite && s.visible).toBe(true);
  }
  await page.screenshot({ path: `${proof}/desert-directions.png` });
  await writeFile(`${proof}/directions.json`, JSON.stringify(result, null, 2));
});
test('1093×614 실제 입력: 이동·공격·가방 닫기 뒤 전투를 이어간다', async ({ page }) => {
  await page.setViewportSize({ width: 1093, height: 614 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRegion(page, 7);
  await observeScene(page);
  await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const { makeWeapon } = await (window as any).regionModule('/src/domain/content.ts');
    const r = store.state.run,
      e = r.enemies[0];
    r.enemies = [e];
    r.offers = [];
    r.zones = [];
    r.encounterObjects = [];
    r.elapsed = 0;
    r.zoneClock = 0;
    Object.assign(e, {
      role: 'rider',
      kind: 'spear',
      bossId: undefined,
      x: 600,
      y: 500,
      state: 'approach',
      timer: 0.1,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
    });
    Object.assign(r.fighter, {
      x: 950,
      y: 500,
      hp: 120,
      invulnerable: 0,
      items: [makeWeapon('sword', 'test-blade', 'weapon')],
      arts: [{ id: 'samja', level: 3, gauge: 0, defenseCd: 0, combo: 0 }],
      bindings: { samja: 'test-blade' },
      active: 0,
    });
    store.paused = false;
    store.rendererReady = true;
    store.notify();
  });
  await page.keyboard.down('a');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        return store.state.run.fighter.x;
      }),
    )
    .toBeLessThan(900);
  await page.keyboard.up('a');
  const canvas = await page.locator('canvas').boundingBox();
  await page.mouse.move(canvas!.x + canvas!.width * 0.34, canvas!.y + canvas!.height * 0.46);
  await page.mouse.down();
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
          return store.state.run.enemies[0].hp;
        }),
      { timeout: 10000 },
    )
    .toBeLessThan(10000);
  await page.mouse.up();
  await page.keyboard.press('Tab');
  await expect(page.locator('.inventory-workspace')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.inventory-workspace')).toHaveCount(0);
  await page.keyboard.down('d');
  const x = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    return store.state.run.fighter.x;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
        return store.state.run.fighter.x;
      }),
    )
    .toBeGreaterThan(x + 20);
  await page.keyboard.up('d');
  await page.screenshot({ path: `${proof}/live-input-1093.png` });
  expect(errors).toEqual([]);
});
