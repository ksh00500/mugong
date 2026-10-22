import { test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun } from '../../src/domain/game';
import { ARTS, ART_WEAPONS } from '../../src/domain/content';
import { makeLootItem } from '../../src/domain/items';
import type { ArtId, BoundFighter, GameState } from '../../src/domain/model';

const publicBuild = !!process.env.MUGONG_DAYTONA_URL;
const proof =
  process.env.MUGONG_FEEDBACK_PROOF ??
  `docs/verification/combat-feel-v1${publicBuild ? '/daytona' : ''}`;
test.use({ deviceScaleFactor: 2 });

function fixture(kind: 'impact' | 'dash' | 'radial' | 'counter' | 'block') {
  const state = emptyGame();
  startRun(state, '청하연', 123);
  const r = state.run!,
    f = r.fighter;
  f.arts = [
    {
      id: kind === 'counter' ? 'wudang' : kind === 'block' ? 'samja' : 'huashan',
      level: 5,
      gauge: 75,
      combo: 0,
      defenseCd: 0,
    },
  ];
  (f as BoundFighter).bindings = { [f.arts[0].id]: f.items[0].id };
  r.enemies = [
    { ...r.enemies[0], x: f.x + 70, y: f.y, hp: 10000, maxHp: 10000, timer: 100, xp: 0 },
  ];
  const e = r.enemies[0];
  if (kind === 'dash' || kind === 'radial') {
    r.wave = kind === 'dash' ? 15 : 20;
    Object.assign(e, {
      kind: kind === 'dash' ? 'chief' : 'captain',
      elite: true,
      pattern: kind === 'dash' ? 1 : 2,
      state: 'windup',
      timer: 0.6,
      x: 710,
      y: 470,
      aim: 0.3,
    });
    f.x = 1110;
    f.y = 680;
  }
  if (kind === 'counter' || kind === 'block')
    Object.assign(e, {
      kind: 'sword',
      role: 'raider',
      bossId: undefined,
      state: 'windup',
      timer: 100,
      aim: Math.PI,
      facing: Math.PI,
      targetX: f.x,
      targetY: f.y,
    });
  return state;
}

async function loadFixture(page: Page, state: GameState) {
  await page.goto('/');
  await expect(page.locator('.home-scene,.game-canvas[data-ready="true"]')).toBeVisible();
  if (!publicBuild)
    await page.evaluate(async () => {
      const path =
        performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
        '/src/platform/store.ts';
      const { gameStore: store } = await import(path);
      store.paused = true;
      await store.persist();
    });
  await page.evaluate(async (state) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('mugong-local-v1', 1);
      request.onsuccess = () => resolve(request.result);
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

async function observe(page: Page, freeze: 'impact' | 'counter' | 'block' | null) {
  await page.evaluate(async (freeze) => {
    const path =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
      '/src/platform/store.ts';
    const { gameStore: store } = await import(path);
    const proofWindow = window as any;
    proofWindow.combatStore = store;
    proofWindow.combatProof = [];
    proofWindow.combatFreezeKind = freeze;
    proofWindow.freezeCombat = false;
    if (proofWindow.combatHooked) return;
    proofWindow.combatHooked = true;
    const scenePath =
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname === '/src/game/CombatScene.ts') ??
      '/src/game/CombatScene.ts';
    const { CombatScene } = await import(scenePath);
    const draw = CombatScene.prototype.draw;
    CombatScene.prototype.draw = function (run: any) {
      proofWindow.combatScene = this;
      if (!this.__proofUpdate) {
        // Phaser caches sceneUpdate at boot; replacing only the prototype is insufficient.
        this.__proofUpdate = this.sys.sceneUpdate;
        const scene = this;
        this.sys.sceneUpdate = (time: number, delta: number) => {
          if (!proofWindow.freezeCombat) scene.__proofUpdate.call(scene, time, delta);
        };
      }
      draw.call(this, run);
    };
    const original = store.advance.bind(store);
    store.advance = (input: any, dt: number, now: number, sink: any) =>
      original(input, dt, now, (cue: any) => {
        sink?.(cue);
        proofWindow.combatProof.push({
          ...cue,
          elapsed: store.state.run.elapsed,
          time: performance.now(),
        });
        const freeze = proofWindow.combatFreezeKind;
        if (
          (freeze === 'impact' && cue.kind === 'impact' && cue.target !== 'hero') ||
          (cue.kind === 'defense' && cue.action === freeze)
        ) {
          proofWindow.freezeCombat = true;
        }
      });
  }, freeze);
  // Wait for the actual Phaser scene to render with the observer attached before
  // a cue can freeze it. Module readiness alone does not guarantee a rendered frame.
  await page.waitForFunction(() => !!(window as any).combatScene);
}

for (const [width, height] of [
  [1440, 900],
  [1366, 768],
  [1093, 614],
]) {
  test(`검격·회피 입력과 전투 가독성 ${width}×${height}`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    await page.setViewportSize({ width, height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await loadFixture(page, fixture('impact'));
    if (!publicBuild) await observe(page, 'impact');
    const canvas = await page.locator('.game-canvas canvas').boundingBox();
    expect(canvas).not.toBeNull();
    const aimX = canvas!.x + (1080 / 1920) * canvas!.width;
    const aimY = canvas!.y + (615 / 1080) * canvas!.height;
    await page.mouse.move(aimX, aimY);
    await page.mouse.down();
    if (!publicBuild) {
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as any).combatProof.some((cue: any) => cue.kind === 'impact'),
          ),
        )
        .toBe(true);
      const cues = await page.evaluate(() => (window as any).combatProof);
      expect(cues[0].kind).toBe('strike');
      expect(cues[1].kind).toBe('impact');
      expect(cues[0].elapsed).toBe(cues[1].elapsed);
      await writeFile(`${proof}/contact-${width}.json`, JSON.stringify(cues, null, 2));
      await writeFile(
        `${proof}/renderer-${width}.json`,
        JSON.stringify(
          await page.evaluate(() => {
            const scene = (window as any).combatScene;
            return {
              graphicsCommands: scene.graphics.commandBuffer.length,
              effects: scene.paintedEffects.pool.map((sprite: any) => ({
                texture: sprite.texture.key,
                frame: sprite.frame.name,
                x: sprite.x,
                y: sprite.y,
                width: sprite.displayWidth,
                height: sprite.displayHeight,
                alpha: sprite.alpha,
                visible: sprite.visible,
                depth: sprite.depth,
              })),
            };
          }),
          null,
          2,
        ),
      );
      // The native renderer paints the contact frame before the pause stops animation time.
      await page.screenshot({ path: `${proof}/contact-${width}.png` });
      await page.screenshot({
        path: `${proof}/contact-detail-${width}.png`,
        clip: {
          x: canvas!.x + canvas!.width * 0.46,
          y: canvas!.y + canvas!.height * 0.48,
          width: canvas!.width * 0.13,
          height: canvas!.height * 0.17,
        },
      });
      // Observe subsequent input without freezing the simulation on the next impact.
      await observe(page, null);
    }
    await page.mouse.up();
    await page.keyboard.press('Space');
    await expect(page.locator('.defense-slot.active .cooldown-dial b')).toHaveText(/1\.[0-8]/);
    await page.keyboard.down('d');
    await page.waitForTimeout(180);
    await page.keyboard.up('d');
    await page.screenshot({ path: `${proof}/evade-${width}.png` });
    if (!publicBuild) {
      const events = await page.evaluate(() => (window as any).combatProof);
      expect(events).toContainEqual(expect.objectContaining({ kind: 'defense', action: 'evade' }));
    }
    await page.keyboard.press('Tab');
    await expect(page.locator('.inventory-workspace')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.inventory-workspace')).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('네 무공의 실제 검격 이펙트 크기·그림·지속 시간을 확인한다', async ({ page }) => {
  test.skip(publicBuild, '개발 모듈을 관찰하는 독립 로컬 컨텍스트 전용');
  test.setTimeout(90000);
  await mkdir(proof, { recursive: true });
  await page.setViewportSize({ width: 1093, height: 614 });
  for (const art of ['huashan', 'wudang', 'tianmo', 'samja'] as ArtId[]) {
    const state = fixture('impact');
    state.run!.fighter.arts[0].id = art;
    state.run!.fighter.arts[0].combo = 0;
    state.run!.fighter.items[0] = makeLootItem(
      `weapon-${ART_WEAPONS[art]}-0`,
      'effect-test-weapon',
      'weapon',
    );
    (state.run!.fighter as BoundFighter).bindings = { [art]: state.run!.fighter.items[0].id };
    await loadFixture(page, state);
    await observe(page, 'impact');
    const canvas = (await page.locator('.game-canvas canvas').boundingBox())!;
    await page.mouse.move(
      canvas.x + (1080 / 1920) * canvas.width,
      canvas.y + (615 / 1080) * canvas.height,
    );
    await page.mouse.down();
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).combatProof.some((cue: any) => cue.kind === 'impact')),
      )
      .toBe(true);
    const rendered = await page.evaluate(() => {
      const scene = (window as any).combatScene;
      const effect = scene.paintedEffects.pool[0];
      return {
        frame: effect.frame.name,
        width: effect.displayWidth,
        height: effect.displayHeight,
        alpha: effect.alpha,
        duration: (window as any).combatStore.state.run.effects[0].duration,
      };
    });
    expect(rendered.frame).toBe(art === 'wudang' ? '1-0' : '0-0');
    expect(rendered.width).toBeGreaterThan(150);
    expect(rendered.height).toBeGreaterThan(45);
    expect(rendered.alpha).toBeGreaterThan(0.5);
    expect(rendered.duration).toBe(0.25);
    await writeFile(
      `${proof}/art-${art}.json`,
      JSON.stringify({ art: ARTS[art].name, ...rendered }, null, 2),
    );
    await page.screenshot({ path: `${proof}/art-${art}.png`, animations: 'disabled' });
    await page.mouse.up();
  }
});

test('돌진·원형 발사·반격·방어와 움직임 줄이기 실제 캡처', async ({ page }) => {
  test.skip(publicBuild, '개발 모듈을 관찰하는 독립 로컬 컨텍스트 전용');
  // Five complete renderer/save fixtures are exercised in this single test.
  test.setTimeout(120000);
  await mkdir(proof, { recursive: true });
  await page.setViewportSize({ width: 1093, height: 614 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const kind of ['dash', 'radial', 'counter', 'block'] as const) {
    await loadFixture(page, fixture(kind));
    if (kind === 'dash' || kind === 'radial') {
      await observe(page, null);
      await page.evaluate(() => {
        (window as any).freezeCombat = true;
      });
      await page.screenshot({ path: `${proof}/warning-${kind}.png` });
    } else {
      await observe(page, kind);
      // Arm when the enemy is close to release; the actual enemy strike resolves the defense.
      await page.evaluate(async () => {
        const path =
          performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .find((url) => new URL(url).pathname === '/src/platform/store.ts') ??
          '/src/platform/store.ts';
        const { gameStore: store } = await import(path);
        store.state.run.enemies[0].timer = 0.16;
      });
      await page.keyboard.press('Space');
      await expect
        .poll(() =>
          page.evaluate(
            (kind) =>
              (window as any).combatProof.some(
                (cue: any) => cue.kind === 'defense' && cue.action === kind,
              ),
            kind,
          ),
        )
        .toBe(true);
      await page.screenshot({ path: `${proof}/success-${kind}.png` });
      await writeFile(
        `${proof}/success-${kind}.json`,
        JSON.stringify(await page.evaluate(() => (window as any).combatProof), null, 2),
      );
    }
  }
  // Change the OS preference after the renderer is mounted, then attack again.
  await loadFixture(page, fixture('impact'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await observe(page, 'impact');
  const box = (await page.locator('.game-canvas canvas').boundingBox())!;
  await page.mouse.click(box.x + (box.width * 1080) / 1920, box.y + (box.height * 615) / 1080);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).combatProof.some((cue: any) => cue.kind === 'impact')),
    )
    .toBe(true);
  await page.screenshot({ path: `${proof}/reduced-motion.png` });
  const motion = await page.evaluate(() => {
    const scene = (window as any).combatScene;
    const fighter = scene.feedback.scene ? scene.actors.get('hero') : null;
    return {
      reduced: scene.reducedMotion,
      shake: scene.cameras.main.shakeEffect.isRunning,
      hero: { x: fighter.x, y: fighter.y },
    };
  });
  expect(motion).toMatchObject({ reduced: true, shake: false, hero: { x: 960, y: 650 } });
  expect(errors).toEqual([]);
});
