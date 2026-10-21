import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, spawnWave } from '../../src/domain/game';
import { REGIONS } from '../../src/domain/campaign';
import { isGameSave } from '../../src/platform/save-validation';
import type { GameState } from '../../src/domain/model';
import { observeScene } from './support/region';
const mode = process.env.MUGONG_SQUAD_MODE ?? 'source';
const proof = `docs/verification/enemy-coordination-v1/${mode}`;
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    return new Promise<GameState>((resolve) => {
      const q = db.transaction('saves').objectStore('saves').get('current');
      q.onsuccess = () => {
        resolve(q.result);
        db.close();
      };
    });
  });
}
async function seed(page: Page) {
  await mkdir(proof, { recursive: true });
  const state = emptyGame();
  startRun(state, '협공 장면 검사', 123);
  const r = state.run!;
  r.regionRoute = [REGIONS[1].name, REGIONS[0].name, REGIONS[2].name, REGIONS[3].name];
  r.wave = 6;
  spawnWave(r);
  r.offers = [];
  r.zones = [];
  r.fighter.invulnerable = 100;
  r.fighter.x = 960;
  r.fighter.y = 530;
  r.enemies.forEach((e, n) => {
    const a = (n / r.enemies.length) * Math.PI * 2;
    e.x = 960 + Math.cos(a) * 310;
    e.y = 530 + Math.sin(a) * 200;
    e.timer = 0;
  });
  expect(isGameSave(state)).toBe(true);
  if (mode === 'source')
    await page.addInitScript(() => {
        (window as any).regionModule = (name: string) => {
          const loaded = performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>new URL(url).pathname===name);
          return import(loaded??name);
        };
    });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible({ timeout: 30000 });
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(state, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 45000,
  });
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
])
  test(`playable saved squad ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page);
    const initial = await saved(page);
    await page.keyboard.down('d');
    try {
      await expect.poll(async()=> (await saved(page)).run!.fighter.x, {timeout:15000}).toBeGreaterThan(initial.run!.fighter.x+100);
    } finally {
      await page.keyboard.up('d');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'계속하기',exact:true})).toBeEnabled();
    await expect
      .poll(async () => (await saved(page)).run!.elapsed)
      .toBeGreaterThan(initial.run!.elapsed + 0.25);
    const pause = await saved(page);
    expect(pause.run!.fighter.x).toBeGreaterThan(initial.run!.fighter.x + 80);
    expect(
      pause.run!.enemies.filter((e) => e.state === 'windup' || e.state === 'strike').length,
    ).toBeLessThanOrEqual(3);
    expect(isGameSave(pause)).toBe(true);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'계속하기',exact:true})).toBeEnabled();
    const resumed = await saved(page);
    expect(resumed.run!.fighter.x).toBeCloseTo(pause.run!.fighter.x);
    expect(resumed.run!.enemies.map((e) => e.id)).toEqual(pause.run!.enemies.map((e) => e.id));
    expect(resumed.run!.enemies.map((e) => e.maxHp)).toEqual(
      initial.run!.enemies.map((e) => e.maxHp),
    );
    expect(
      resumed.run!.enemies.some(
        (e) =>
          Math.hypot(
            e.x - initial.run!.enemies.find((o) => o.id === e.id)!.x,
            e.y - initial.run!.enemies.find((o) => o.id === e.id)!.y,
          ) > 10,
      ),
    ).toBe(true);
    await page.screenshot({ path: `${proof}/play-${width}.png` });
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/play-${width}.json`,
      JSON.stringify(
        {
          width,
          height,
          initialElapsed: initial.run!.elapsed,
          pausedElapsed: pause.run!.elapsed,
          playerTravel: pause.run!.fighter.x - initial.run!.fighter.x,
          memberCount: resumed.run!.enemies.length,
          validSavedResume: true,
          errors,
          invulnerableFixture: true,
        },
        null,
        2,
      ) + '\n',
    );
  });

for (const [width, height, webgl] of [
  [1440, 900, false],
  [1093, 614, false],
  [1440, 900, true],
] as const)
  test(`source role movement and admission spacing ${width} ${webgl ? 'WebGL' : 'Canvas'}`, async ({
    page,
  }) => {
    test.skip(
      mode !== 'source',
      'Source-only observation; compiled coverage uses actual input and saved state.',
    );
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    await seed(page);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const w = window as any,
        scene = w.regionScene,
        store = (await w.regionModule('/src/platform/store.ts')).gameStore;
      const { tick } = await w.regionModule('/src/domain/game.ts'),
        { squadAssignment } = await w.regionModule('/src/domain/enemy-coordination.ts');
      scene.scene.pause();
      store.paused = false;
      const r = store.state.run;
      let maximum = 0;
      const starts: number[] = [];
      for (let frame = 0; frame < 600; frame++) {
        const before = new Map(r.enemies.map((e: any) => [e.id, e.state]));
        r.zoneClock = 0;
        tick(
          r,
          {
            dx: frame < 180 ? 1 : frame < 360 ? -1 : 0,
            dy: frame < 360 ? 0.35 : 0,
            aim: 0,
            attack: false,
            defense: false,
            ultimate: false,
          },
          1 / 60,
        );
        maximum = Math.max(
          maximum,
          r.enemies.filter((e: any) => e.state === 'windup' || e.state === 'strike').length,
        );
        for (const e of r.enemies)
          if (e.state === 'windup' && before.get(e.id) !== 'windup') starts.push(r.elapsed);
      }
      scene.draw(r);
      store.notify();
      const assignments = r.enemies.map((e: any) => ({
        id: e.id,
        role: e.role,
        state: e.state,
        x: e.x,
        y: e.y,
        ...squadAssignment(r, e),
      }));
      return { maximum, starts, renderer: scene.game.renderer.type, assignments };
    });
    expect(result.maximum).toBeLessThanOrEqual(3);
    expect(result.starts.length).toBeGreaterThan(5);
    for (let n = 1; n < result.starts.length; n++)
      expect(result.starts[n] - result.starts[n - 1]).toBeGreaterThanOrEqual(0.22 - 1e-6);
    expect(result.renderer).toBe(webgl ? 2 : 1);
  expect(result.assignments.some((e: { role?: string }) => e.role === 'volley')).toBe(true);
  expect(result.assignments.some((e: { role?: string }) => e.role === 'intercept')).toBe(true);
    await page.screenshot({
      path: `${proof}/formation-${width}-${webgl ? 'webgl' : 'canvas'}.png`,
    });
    expect(errors).toEqual([]);
    await writeFile(
      `${proof}/formation-${width}-${webgl ? 'webgl' : 'canvas'}.json`,
      JSON.stringify({ ...result, errors }, null, 2) + '\n',
    );
  });
