import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { command, emptyGame } from '../../src/domain/game';
import { isGameSave } from '../../src/platform/save-validation';
import { observeScene } from './support/region';
const mode = process.env.MUGONG_FRAME_MODE ?? 'source',
  proof = `.local-preview/frame-browser-${mode}`;
function fixture() {
  const state = emptyGame(),
    now = 1800000000000;
  state.family.recruitment = {
    tickets: 2,
    anchor: now,
    observedAt: now,
    sequence: 1,
    candidates: [
      {
        id: 'frame-case',
        seed: 777,
        appearance: 0,
        growth: { constitution: 1.2, strength: 1.2, agility: 1.3, inner: 1.3 },
        innate: 'focus',
      },
    ],
  };
  command(state, { type: 'startRecruit', id: 'frame-case', name: '프레임 검증' }, now);
  while (state.run!.offers.length)
    command(state, { type: 'choose', offer: state.run!.offers[0] }, now);
  // Frozen enemies keep timing/render comparisons independent of random damage/menus.
  for (const e of state.run!.enemies) {
    e.state = 'windup';
    e.timer = 1000;
  }
  return state;
}
async function seed(page: Page, webgl: boolean) {
  await page.addInitScript(() => {
    (window as any).regionModule = async (name: string) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .find((u) => new URL(u).pathname === name) ?? name
      );
  });
  if (webgl)
    await page.addInitScript(() => {
      // Exercise the WebGL path on this software-rendered test host; not a native-GPU benchmark.
      for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
        const get = proto.getExtension;
        proto.getExtension = function (name: string) {
          return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
        };
      }
    });
  const state = fixture();
  expect(isGameSave(state)).toBe(true);
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async (value) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve) => {
      const tx = db.transaction('saves', 'readwrite');
      tx.objectStore('saves').put(value, 'current');
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, state);
  await page.reload();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
    timeout: 60000,
  });
}
async function readSave(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('mugong-local-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    const value = await new Promise<any>((resolve) => {
      const q = db.transaction('saves', 'readonly').objectStore('saves').get('current');
      q.onsuccess = () => resolve(q.result);
    });
    db.close();
    return value;
  });
}
if (mode === 'source')
  for (const webgl of [false, true])
    test(`${webgl ? 'WebGL' : 'Canvas'}: real actor poses advance on 60/120/144/240Hz drawing schedules`, async ({
      page,
    }) => {
      await seed(page, webgl);
      await observeScene(page);
      const rows = await page.evaluate(async () => {
        const w = window as any,
          scene = w.regionScene,
          store = (await w.regionModule('/src/platform/store.ts')).gameStore;
        scene.scene.pause();
        store.lastRequestedSave = Infinity;
        store.paused = false;
        store.busy = false;
        const saved = structuredClone(store.state),
          rows = [];
        for (const hz of [60, 120, 144, 240]) {
          store.state = structuredClone(saved);
          scene.accumulator = 0;
          scene.keys.clear();
          scene.keys.add('d');
          scene.activeRun = '';
          const poses = [];
          for (let frame = 0; frame < hz; frame++) {
            scene.update((frame * 1000) / hz, 1000 / hz);
            poses.push(scene.actors.get('hero').x);
          }
          const warm = poses.slice(Math.ceil(hz / 30));
          rows.push({
            hz,
            changed: warm.slice(1).filter((x, i) => Math.abs(x - warm[i]) > 0.01).length,
            frames: warm.length - 1,
            maxJump: Math.max(...warm.slice(1).map((x, i) => Math.abs(x - warm[i]))),
            authoritativeX: store.state.run.fighter.x,
          });
        }
        return rows;
      });
      for (const row of rows) {
        expect(row.changed).toBe(row.frames);
        expect(row.maxJump).toBeLessThanOrEqual(265 / row.hz + 0.001);
      }
      expect(new Set(rows.map((r) => r.authoritativeX)).size).toBe(1);
      await mkdir(proof, { recursive: true });
      await writeFile(`${proof}/refresh-${webgl}.json`, JSON.stringify(rows, null, 2));
    });
for (const [width, height, webgl] of [
  [1440, 900, false],
  [1366, 768, false],
  [1093, 614, true],
] as const)
  test(`local ${width}: keyboard movement persists, attack, bag, pause and renderer attributes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page, webgl);
    const graphics = await page.locator('.game-canvas canvas').evaluate((canvas) => {
      const c = canvas as HTMLCanvasElement;
      const gl = c.getContext('webgl2') ?? c.getContext('webgl');
      return { width: c.width, height: c.height, attributes: gl?.getContextAttributes() ?? null };
    });
    if (webgl) {
      expect(graphics.attributes).not.toBeNull();
      expect(graphics.attributes!.alpha).toBe(false);
      expect(graphics.attributes!.antialias).toBe(false);
    }
    await page.keyboard.down('d');
    await page.waitForTimeout(550);
    await page.keyboard.up('d');
    await page.waitForTimeout(1300);
    const saved = await readSave(page);
    expect(saved.run.fighter.x).toBeGreaterThan(1000);
    expect(isGameSave(saved)).toBe(true);
    await page.mouse.move(width * 0.6, height * 0.5);
    await page.mouse.down();
    await page.waitForTimeout(350);
    await page.mouse.up();
    await expect
      .poll(async () => (await readSave(page)).run.fighter.attackSeq)
      .toBeGreaterThan(saved.run.fighter.attackSeq);
    await page.getByRole('button', { name: '가방 Tab', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('.pause-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.pause-menu')).toHaveCount(0);
    for (const selector of ['.wuxia-hud .ultimate-panel', '.wuxia-hud .defense-panel']) {
      const box = await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
    }
    await mkdir(proof, { recursive: true });
    await page.screenshot({ path: `${proof}/combat-${width}.png` });
    await writeFile(`${proof}/graphics-${width}.json`, JSON.stringify(graphics, null, 2));
    expect(errors).toEqual([]);
  });
