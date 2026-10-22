import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import { MOTION_DIRECTIONS } from '../../src/game/directional-motion';
import { enemyDirectionFlip } from '../../src/platform/region-art';

const evidence = 'docs/verification/directional-motion-v2';
for (let index = 0; index < 10; index++) {
  test(`region ${index}: all seven actors animate in eight directions`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1093, height: 614 });
    await seedRegion(page, index);
    await observeScene(page);
    await mkdir(evidence, { recursive: true });
    for (let direction = 0; direction < 8; direction++) {
      const proof = await page.evaluate(
        async ({ direction, index }) => {
          const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
          const { hostileIdentitySlot } = await (window as any).regionModule(
            '/src/platform/region-art.ts',
          );
          store.paused = true;
          const scene = (window as any).regionScene,
            run = store.state.run;
          scene.scene.pause();
          scene.feedback.reset();
          scene.animationTime += 1;
          run.fighter.facing = (direction * Math.PI) / 4;
          run.fighter.action = 'walk';
          for (const enemy of run.enemies) {
            enemy.state = 'approach';
            enemy.moving = false;
            enemy.facing = enemy.aim = (direction * Math.PI) / 4;
          }
          scene.draw(run);
          const first = run.enemies.map((e: any) => {
            const actor = scene.actors.get(String(e.id));
            return actor.getData('authoredFrame')
              ? actor.frame.name
              : scene.continuousActors.get(String(e.id)).mesh.vertices.slice();
          });
          scene.animationTime += 0.1;
          for (const enemy of run.enemies) enemy.x += 21;
          run.fighter.x += 21;
          scene.draw(run);
          return {
            hero: scene.continuousActors.get('hero').mesh.getData('direction'),
            enemies: run.enemies.map((e: any, slot: number) => {
              const actor = scene.actors.get(String(e.id));
              if (actor.getData('authoredFrame'))
                return {
                  slot,
                  frameSlot: slot,
                  authored: true,
                  special: false,
                  direction: actor.getData('motionDirection'),
                  frame: actor.frame.name,
                  visible: actor.visible,
                  flip: actor.flipX,
                  changed: actor.frame.name !== first[slot],
                  sourceHeight: actor.frame.height,
                  finite: [actor.x, actor.y, actor.scaleX, actor.scaleY].every(Number.isFinite),
                };
              const mesh = scene.continuousActors.get(String(e.id)).mesh;
              return {
                slot,
                frameSlot: hostileIdentitySlot(e, index) ?? (e.bossId === '5-2' ? 3 : slot),
                authored: false,
                special: e.bossId === '5-2',
                direction: mesh.getData('direction'),
                frame: actor.frame.name,
                visible: mesh.visible,
                flip: actor.flipX,
                changed: mesh.vertices.some(
                  (v: number, n: number) => n % 4 < 2 && Math.abs(v - first[slot][n]) > 0.001,
                ),
                sourceHeight: actor.frame.height,
                finite: mesh.vertices.every(Number.isFinite),
              };
            }),
          };
        },
        { direction, index },
      );
      expect(proof.hero).toBe(direction);
      for (const enemy of proof.enemies) {
        expect(enemy.direction).toBe(direction);
        expect(enemy.frame).toBe(
          enemy.authored
            ? `${MOTION_DIRECTIONS[direction].view}-locomotion-0`
            : `${enemy.frameSlot}-${MOTION_DIRECTIONS[direction].view}`,
        );
        expect(enemy.flip).toBe(
          enemy.authored
            ? MOTION_DIRECTIONS[direction].flip
            : enemy.special
              ? MOTION_DIRECTIONS[direction].view === 3
                ? !MOTION_DIRECTIONS[direction].flip
                : MOTION_DIRECTIONS[direction].flip
              : enemyDirectionFlip(
                  index,
                  enemy.slot,
                  MOTION_DIRECTIONS[direction].view,
                  MOTION_DIRECTIONS[direction].flip,
                ),
        );
        expect(enemy.visible && enemy.finite).toBe(true);
        // Authored idle is a fixed drawing when the simulation reports no movement.
        expect(enemy.changed).toBe(!enemy.authored);
        expect(enemy.sourceHeight).toBeGreaterThan(100);
      }
      if ([0, 2, 5, 6, 7].includes(direction))
        await page.screenshot({ path: `${evidence}/region-${index}-dir-${direction}-1093.png` });
    }
    expect(errors).toEqual([]);
  });
}

test('hero actions and bag pause preserve geometry and input timing', async ({ page }) => {
  await seedRegion(page, 0);
  await observeScene(page);
  const proof = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    store.paused = true;
    const scene = (window as any).regionScene,
      run = store.state.run,
      f = run.fighter;
    const actions: string[] = [];
    for (let direction = 0; direction < 8; direction++) {
      f.facing = (direction * Math.PI) / 4;
      for (const [action, time] of [
        ['idle', 0],
        ['walk', 0],
        ['attack', 0.25],
        ['attack', 0.16],
        ['attack', 0.025],
        ['ultimate', 0.35],
        ['defense', 0.15],
      ] as const) {
        scene.animationTime += 1;
        f.action = action;
        f.actionTime = time;
        scene.draw(run);
        const mesh = scene.continuousActors.get('hero').mesh;
        if (!mesh.visible || !mesh.vertices.every(Number.isFinite))
          throw new Error('Hero geometry failed');
        actions.push(mesh.getData('action'));
      }
    }
    store.bagOpen = true;
    store.paused = false;
    const before = {
      time: scene.animationTime,
      elapsed: run.elapsed,
      vertices: scene.continuousActors.get('hero').mesh.vertices.slice(),
    };
    scene.update(performance.now(), 16.7);
    const after = {
      time: scene.animationTime,
      elapsed: run.elapsed,
      vertices: scene.continuousActors.get('hero').mesh.vertices.slice(),
    };
    store.bagOpen = false;
    store.paused = true;
    return { actions, before, after };
  });
  expect(new Set(proof.actions)).toEqual(
    new Set(['idle', 'walk', 'windup', 'strike', 'recover', 'ultimate', 'defense']),
  );
  expect(proof.after).toEqual(proof.before);
});

test('WebGL and Canvas both draw the continuous rig', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function (name: string) {
      return name === 'WEBGL_debug_renderer_info' ? null : original.call(this, name);
    };
    const original2 = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name: string) {
      return name === 'WEBGL_debug_renderer_info' ? null : original2.call(this, name);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRegion(page, 0);
  await observeScene(page);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-renderer', 'WebGL / AUTO');
  const type = await page.evaluate(() => (window as any).regionScene.game.renderer.type);
  expect(type).toBe(2);
  await page.waitForTimeout(300);
  await mkdir(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/webgl-1440.png` });
  await writeFile(`${evidence}/webgl.json`, JSON.stringify({ type, errors }));
  expect(errors).toEqual([]);
});

test('software Canvas draws a smaller continuous mesh without losing actors', async ({ page }) => {
  await page.addInitScript(() => {
    const proto = HTMLCanvasElement.prototype,
      original = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, kind: string, options?: any) {
      return kind === 'webgl' || kind === 'webgl2' || kind === 'experimental-webgl'
        ? null
        : (original as any).call(this, kind, options);
    } as typeof original;
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedRegion(page, 5);
  await observeScene(page);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-renderer', 'Canvas');
  const proof = await page.evaluate(() => {
    const scene = (window as any).regionScene;
    return Array.from(scene.continuousActors.values() as Iterable<any>).map((a) => ({
      visible: a.mesh.visible,
      vertices: a.mesh.vertices.length,
    }));
  });
  expect(proof).toHaveLength(8);
  expect(proof.every((a) => a.visible && a.vertices === 140)).toBe(true);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${evidence}/canvas-1440.png` });
  expect(errors).toEqual([]);
});

test('capture actual directional movement and repeated attacks', async ({ browser }) => {
  await mkdir(evidence, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    locale: 'ko-KR',
    recordVideo: { dir: evidence, size: { width: 1366, height: 768 } },
  });
  const page = await context.newPage();
  await seedRegion(page, 0);
  await observeScene(page);
  await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const run = store.state.run,
      f = run.fighter;
    f.arts = [{ id: 'huashan', level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
    f.bindings = { huashan: f.items[0].id };
    run.enemies = run.enemies.slice(0, 3);
    for (const enemy of run.enemies) {
      enemy.state = 'approach';
      enemy.speed = 45;
    }
    store.notify();
  });
  for (const keys of [['d'], ['d', 's'], ['s'], ['s', 'a'], ['a'], ['a', 'w'], ['w'], ['w', 'd']]) {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(260);
    for (const key of keys) await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  const target = await page.evaluate(() => {
    const scene = (window as any).regionScene;
    const actor = scene.actors.get('hero');
    return { x: actor.x, y: actor.y };
  });
  const canvas = (await page.locator('.game-canvas canvas').boundingBox())!;
  await page.mouse.move(
    canvas.x + ((target.x + 120) / 1920) * canvas.width,
    canvas.y + (target.y / 1080) * canvas.height,
  );
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
  await page.mouse.click(
    canvas.x + (target.x / 1920) * canvas.width,
    canvas.y + (target.y / 1080) * canvas.height,
    { button: 'right' },
  );
  await page.waitForTimeout(650);
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${evidence}/actual-movement-1366.png` });
  const video = page.video()!;
  await context.close();
  await video.saveAs(`${evidence}/directional-play.webm`);
});
