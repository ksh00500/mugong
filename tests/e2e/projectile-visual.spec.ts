import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { ART_WEAPONS, xpThreshold } from '../../src/domain/content';
import { emptyGame, startRun } from '../../src/domain/game';
import { makeLootItem } from '../../src/domain/items';
import type { ArtId, BoundFighter, GameState } from '../../src/domain/model';
import { PROJECTILE_VISUALS } from '../../src/domain/projectile-visual';

const proof = 'docs/verification/projectiles-comparison-v1';
function fixture(art: ArtId = 'tang', level = 1, tier = 0) {
  const state = emptyGame();
  startRun(state, 'Tester', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  f.arts = [{ id: art, level, gauge: 0, combo: 0, defenseCd: 0 }];
  f.items = [makeLootItem(`weapon-${ART_WEAPONS[art]}-${tier}`, 'weapon', 'weapon')];
  f.bindings = { [art]: 'weapon' };
  r.offers = [];
  r.wave = 3;
  r.regionRoute = ['청하현', '설산', '독무곡', '천검산'];
  r.enemies = [
    {
      ...r.enemies[0],
      x: 1500,
      y: f.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      timer: 200,
      state: 'recover',
    },
  ];
  return state;
}
async function seed(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
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
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
}
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

// Test-only observers in each independent browser; no runtime debug hooks or user save edits.
async function observe(page: Page, freezeOnShot = false) {
  await page.evaluate(async (freezeOnShot) => {
    const modulePath = (name: string) =>
      performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .find((url) => new URL(url).pathname === name) ?? name;
    const { gameStore: store } = await import(modulePath('/src/platform/store.ts'));
    const { CombatScene } = await import(modulePath('/src/game/CombatScene.ts'));
    const w = window as any;
    w.projectileStore = store;
    const draw = CombatScene.prototype.draw;
    CombatScene.prototype.draw = function (run: any) {
      w.projectileScene = this;
      draw.call(this, run);
    };
    if (freezeOnShot) {
      const advance = store.advance.bind(store);
      store.advance = (...args: any[]) => {
        if (w.projectileFrozen) return;
        advance(...args);
        if (store.state.run?.projectiles.some((p: any) => p.friendly)) w.projectileFrozen = true;
      };
    } else store.advance = () => {};
  }, freezeOnShot);
  await expect.poll(() => page.evaluate(() => !!(window as any).projectileScene)).toBe(true);
}
async function painted(page: Page) {
  return page.evaluate(() =>
    (window as any).projectileScene.paintedEffects.pool
      .filter(
        (s: any) =>
          s.visible &&
          [
            'painted-projectiles',
            'painted-stone',
            'hostile-projectiles',
            'boss-mechanics',
          ].includes(s.texture.key),
      )
      .map((s: any) => ({
        frame:
          s.texture.key === 'painted-stone'
            ? 'stone'
            : s.texture.key === 'boss-mechanics'
              ? 'palm-wave'
              : s.frame.name,
        width: s.displayWidth,
        height: s.displayHeight,
        rotation: s.rotation,
        depth: s.depth,
        alpha: s.alpha,
      })),
  );
}
test.beforeEach(async () => {
  await mkdir(proof, { recursive: true });
});
for (const [art, level, tier, expected] of [
  ['tang', 1, 0, 'bronze-dart'],
  ['tang', 1, 1, 'steel-needle'],
  ['tang', 1, 2, 'jade-needle'],
  ['jegal', 1, 0, 'wind-blade'],
  ['samja', 9, 0, 'sword-wave'],
  ['samja', 10, 0, 'flying-sword'],
] as const) {
  test(`실제 발사와 전용 그림·저장 ${expected}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page, fixture(art, level, tier));
    await observe(page, true);
    const canvas = (await page.locator('.game-canvas canvas').boundingBox())!;
    await page.mouse.move(canvas.x + canvas.width * 0.72, canvas.y + canvas.height * 0.52);
    await page.mouse.down();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).projectileStore.state.run.projectiles[0]?.visual),
      )
      .toBe(expected);
    await page.mouse.up();
    await expect
      .poll(async () => (await painted(page)).map((s: any) => s.frame))
      .toContain(expected);
    if (art === 'tang' || art === 'jegal')
      expect(
        await page.evaluate(
          () =>
            (window as any).projectileScene.paintedEffects.pool.filter(
              (s: any) => s.visible && s.texture.key === 'painted-effects',
            ).length,
        ),
      ).toBe(0);
    await page.evaluate(async () => {
      await (window as any).projectileStore.persist();
    });
    expect((await saved(page)).run!.projectiles[0].visual).toBe(expected);
    await page.screenshot({ path: `${proof}/shot-${expected}.png` });
    expect(errors).toEqual([]);
  });
}
for (const render of ['Canvas', 'WebGL'] as const) {
  test(`18종 투사체 렌더링·방향·재사용 ${render}`, async ({ page }) => {
    if (render === 'WebGL')
      await page.addInitScript(() => {
        for (const prototype of [
          WebGLRenderingContext.prototype,
          WebGL2RenderingContext.prototype,
        ]) {
          const original = prototype.getExtension;
          prototype.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : original.call(this, name);
          };
        }
      });
    const state = fixture();
    state.run!.projectiles = PROJECTILE_VISUALS.map((visual, n) => ({
      visual,
      x: 560 + (n % 5) * 185,
      y: 300 + Math.floor(n / 5) * 140,
      vx: 0,
      vy: 0,
      life: 999,
      friendly: n < 6,
      damage: 0,
      radius: 12,
      hits: [],
    }));
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seed(page, state);
    await observe(page);
    const sprites = await painted(page);
    expect(sprites.map((s: any) => s.frame).sort()).toEqual([...PROJECTILE_VISUALS].sort());
    expect(
      sprites.every(
        (s: any) =>
          s.width >= 22 && s.width <= 64 && s.height > 6 && s.height <= 64 && s.alpha === 1,
      ),
    ).toBe(true);
    expect(sprites.filter((s: any) => s.depth === 5003)).toHaveLength(
      PROJECTILE_VISUALS.length - 6,
    );
    await page.screenshot({ path: `${proof}/projectiles-${render}.png` });
    await page.evaluate(() => {
      const r = (window as any).projectileStore.state.run;
      r.projectiles = r.projectiles
        .slice(0, 3)
        .map((p: any, n: number) => ({ ...p, vx: 0, vy: n === 0 ? 100 : -100 }));
    });
    await expect.poll(async () => (await painted(page)).length).toBe(3);
    const turned = await painted(page);
    expect(turned[0].rotation).toBeCloseTo(Math.PI / 2);
    expect(turned[1].rotation).toBeCloseTo(-Math.PI / 2);
    await writeFile(
      `${proof}/renderer-${render}.json`,
      JSON.stringify({ sprites, turned, errors }, null, 2),
    );
    expect(errors).toEqual([]);
  });
}
test('동작 줄이기에서 회전 칼날은 방향만 유지한다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const state = fixture();
  state.run!.projectiles = [
    {
      visual: 'returning-blade',
      x: 1000,
      y: 400,
      vx: 0,
      vy: 0,
      life: 999,
      friendly: false,
      damage: 0,
      radius: 14,
      hits: [],
    },
  ];
  await seed(page, state);
  await observe(page);
  expect((await painted(page))[0].rotation).toBe(0);
});
