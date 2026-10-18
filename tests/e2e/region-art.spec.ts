import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { REGIONS } from '../../src/domain/campaign';
import { seedRegion, observeScene } from './support/region';
test('regional melee attack changes pose on the actual damage tick', async ({ page }) => {
  await seedRegion(page, 0);
  await observeScene(page);
  await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    store.paused = true;
    const scene = (window as any).regionScene,
      run = store.state.run,
      enemy = run.enemies[0];
    run.enemies = [enemy];
    Object.assign(enemy, {
      bossId: undefined,
      kind: 'sword',
      x: run.fighter.x + 60,
      y: run.fighter.y,
      aim: Math.PI,
      facing: Math.PI,
      state: 'windup',
      timer: 0.3,
    });
    run.fighter.iframe = 0;
    const before = run.fighter.hp;
    (window as any).regionalContact = { before, frames: [] };
    const original = scene.draw;
    scene.draw = function (r: any) {
      original.call(this, r);
      const proof = (window as any).regionalContact;
      proof.frames.push(this.continuousActors.get(String(enemy.id)).mesh.getData('action'));
      if (enemy.state === 'strike') {
        proof.after = r.fighter.hp;
        proof.contactFrame = this.continuousActors.get(String(enemy.id)).mesh.getData('action');
        proof.contactTime = r.elapsed;
        store.paused = true;
      }
    };
    store.paused = false;
  });
  await page.waitForFunction(() => (window as any).regionalContact.after !== undefined);
  const proof = await page.evaluate(() => (window as any).regionalContact);
  expect(proof.frames).toContain('windup');
  expect(proof.contactFrame).toBe('strike');
  expect(proof.after).toBeLessThan(proof.before);
  await mkdir('docs/verification/enemy-motion-v1', { recursive: true });
  await page.screenshot({ path: 'docs/verification/enemy-motion-v1/actual-contact.png' });
});

for (let index = 0; index < REGIONS.length; index++) {
  test(`${REGIONS[index].name}: floor, three mobs and four boss identities`, async ({ page }) => {
    await page.setViewportSize({ width: 1093, height: 614 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, index);
    await observeScene(page);
    const frames = await page.evaluate(() => {
      const scene = (window as any).regionScene;
      return Array.from(scene.actors.values() as Iterable<any>)
        .filter((a) => a.texture.key.startsWith('region-direction-'))
        .map((a) => Number(String(a.frame.name).split('-')[0]))
        .sort();
    });
    expect(frames).toEqual([0, 1, 2, 3, 4, 5, 6]);
    await mkdir('docs/verification/region-art-v1', { recursive: true });
    await page.screenshot({ path: `docs/verification/region-art-v1/region-${index}-1093.png` });
    await mkdir('docs/verification/enemy-motion-v1', { recursive: true });
    for (const stage of ['walkA', 'walkB', 'windup', 'strike', 'hit', 'death']) {
      const shown = await page.evaluate(
        async ({ stage, index }) => {
          const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
          store.paused = true;
          const scene = (window as any).regionScene,
            run = store.state.run;
          scene.animationTime = stage === 'walkB' ? 0.13 : 0;
          for (const enemy of run.enemies) {
            enemy.state = stage.startsWith('walk')
              ? 'approach'
              : stage === 'hit'
                ? 'recover'
                : stage;
            enemy.timer = 0.1;
          }
          if (stage === 'hit')
            scene.feedback.receive(
              run.enemies.map((e: any) => ({
                kind: 'impact',
                target: e.id,
                x: e.x,
                y: e.y,
                angle: 0,
                amount: 1,
                killed: false,
              })),
              0,
              scene.reducedMotion,
            );
          if (stage === 'death') for (const enemy of run.enemies) enemy.hp = 0;
          scene.draw(run);
          const actors = run.enemies.map((e: any) => scene.actors.get(String(e.id)));
          return {
            count: scene.motionFrames.get(`region-motion-${index}`).size,
            directions: scene.directionFrames.get(`region-direction-${index}`).size,
            actions: run.enemies.map((e: any) =>
              scene.continuousActors.get(String(e.id)).mesh.getData('action'),
            ),
            frames: actors.map((a: any) => String(a.frame.name)),
            invalidSize: actors.some(
              (a: any) =>
                !Number.isFinite(a.displayWidth) || a.displayWidth <= 0 || a.displayHeight <= 0,
            ),
          };
        },
        { stage, index },
      );
      expect(shown.count).toBe(42);
      expect(shown.directions).toBe(35);
      expect(shown.invalidSize).toBe(false);
      for (let slot = 0; slot < 7; slot++) {
        expect(shown.frames[slot]).toMatch(new RegExp(`^${slot}-[0-4]$`));
        expect(shown.actions[slot]).toBe(
          stage.startsWith('walk') ? 'walk' : stage === 'hit' ? 'hurt' : stage,
        );
      }
      await page.screenshot({
        path: `docs/verification/enemy-motion-v1/region-${index}-${stage}.png`,
      });
    }
    expect(errors).toEqual([]);
    const canvas = await page.locator('.game-canvas canvas').boundingBox();
    expect(canvas!.width).toBeGreaterThan(1000);
    expect(canvas!.height).toBeLessThanOrEqual(615);
  });
}

for (const [width, height] of [
  [1366, 768],
  [1440, 900],
]) {
  test(`regional combat art ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedRegion(page, 2);
    await page.screenshot({ path: `docs/verification/region-art-v1/region-2-${width}.png` });
  });
}

test('next region is fetched in advance; its pending art never advances combat', async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/art/enemy-motion-v1/1-motion.webp', async (route) => {
    await gate;
    await route.continue();
  });
  await seedRegion(page, 0);
  const before = await page.evaluate(async () => {
    const storePath = '/src/platform/store.ts',
      gamePath = '/src/domain/game.ts';
    const { gameStore: store } = await (window as any).regionModule(storePath);
    const { spawnWave } = await (window as any).regionModule(gamePath);
    store.state.run.wave = 6;
    spawnWave(store.state.run);
    store.notify();
    return { elapsed: store.state.run.elapsed, id: store.state.run.id };
  });
  await page.waitForTimeout(250);
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'false');
  await expect(page.getByRole('heading', { name: '강호를 준비하고 있습니다' })).toBeVisible();
  expect(
    await page.evaluate(async () => {
      const path = '/src/platform/store.ts';
      const { gameStore: store } = await (window as any).regionModule(path);
      return store.state.run.elapsed;
    }),
  ).toBe(before.elapsed);
  release();
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-art-region', '1');
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const path = '/src/platform/store.ts';
        const { gameStore: store } = await (window as any).regionModule(path);
        return store.state.run.elapsed;
      }),
    )
    .toBeGreaterThan(before.elapsed);
  expect(
    await page.evaluate(async () => {
      const path = '/src/platform/store.ts';
      const { gameStore: store } = await (window as any).regionModule(path);
      return store.state.run.id;
    }),
  ).toBe(before.id);
});

for (const asset of [
  'regions-v1/0-actors',
  'enemy-motion-v1/0-motion-v2',
  'direction-v2/0-directions',
]) {
  test(`a missing initial atlas ${asset} offers retry with the same run`, async ({ page }) => {
    await page.route(`**/art/${asset}.webp`, (route) => route.abort());
    await seedRegion(page, 0, false);
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
    const before = await page.evaluate(async () => {
      const path = '/src/platform/store.ts';
      const { gameStore: store } = await (window as any).regionModule(path);
      return { id: store.state.run.id, elapsed: store.state.run.elapsed };
    });
    await page.unroute(`**/art/${asset}.webp`);
    await page.getByRole('button', { name: '다시 시도' }).click();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true');
    expect(
      await page.evaluate(async () => {
        const path = '/src/platform/store.ts';
        const { gameStore: store } = await (window as any).regionModule(path);
        return store.state.run.id;
      }),
    ).toBe(before.id);
  });
}

for (const reduced of [false, true]) {
  test(`regional walk, windup, strike, impact and death presentation; reduced motion=${reduced}`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await seedRegion(page, 0);
    await observeScene(page);
    const poses = await page.evaluate(async () => {
      const path = '/src/platform/store.ts';
      const { gameStore: store } = await (window as any).regionModule(path);
      store.paused = true;
      const scene = (window as any).regionScene,
        run = store.state.run,
        enemy = run.enemies[0];
      const id = String(enemy.id);
      const pose = () => {
        const actor = scene.actors.get(id);
        const mesh = scene.continuousActors.get(id).mesh;
        return {
          x: actor.x,
          y: actor.y,
          rotation: actor.rotation,
          height: actor.displayHeight,
          alpha: actor.alpha,
          frame: actor.frame.name,
          vertices: mesh.vertices.slice(),
          action: mesh.getData('action'),
        };
      };
      enemy.state = 'approach';
      scene.animationTime = 0;
      scene.draw(run);
      const walk1 = pose();
      scene.animationTime = 0.13;
      enemy.x += 21;
      scene.draw(run);
      const walk2 = pose();
      const footX = scene.directionFrames.get('region-direction-0').get(pose().frame).footX;
      const rightOrigin = scene.actors.get(id).originX;
      enemy.facing = Math.PI;
      scene.animationTime = 0.14;
      scene.draw(run);
      const leftOrigin = scene.actors.get(id).originX;
      enemy.facing = 0;
      scene.animationTime = 0.15;
      enemy.state = 'windup';
      enemy.aim = 0;
      enemy.timer = 0.1;
      scene.draw(run);
      const windup = pose();
      enemy.state = 'strike';
      enemy.timer = 0.1;
      scene.draw(run);
      const strike = pose();
      scene.animationTime = 1;
      scene.feedback.receive(
        [
          {
            kind: 'impact',
            target: enemy.id,
            x: enemy.x,
            y: enemy.y,
            angle: 0,
            amount: 1,
            killed: false,
          },
        ],
        1,
        scene.reducedMotion,
      );
      enemy.state = 'recover';
      scene.draw(run);
      const impact = pose();
      enemy.hp = 0;
      scene.draw(run);
      scene.animationTime = 1.19;
      scene.draw(run);
      const death = pose();
      scene.animationTime = 1.4;
      scene.draw(run);
      return {
        walk1,
        walk2,
        windup,
        strike,
        impact,
        death,
        x: enemy.x,
        removed: !scene.actors.has(id),
        reduced: scene.reducedMotion,
        footX,
        rightOrigin,
        leftOrigin,
      };
    });
    expect(poses.reduced).toBe(reduced);
    expect(poses.rightOrigin).toBeCloseTo(poses.footX);
    expect(poses.leftOrigin + poses.footX).toBeCloseTo(1);
    if (reduced) {
      expect(poses.walk1.y).toBe(poses.walk2.y);
      expect(poses.strike.rotation).toBe(0);
      expect(poses.impact.x).toBe(poses.x);
      expect(poses.walk1.frame).toBe(poses.walk2.frame);
    } else {
      expect(poses.walk1.vertices).not.toEqual(poses.walk2.vertices);
      expect(poses.windup.x).toBeLessThan(poses.x);
      expect(poses.strike.x).toBeGreaterThan(poses.x);
      expect(poses.impact.x).toBeGreaterThan(poses.x);
      expect(poses.death.vertices).not.toEqual(poses.walk1.vertices);
    }
    expect(poses.windup.action).toBe('windup');
    expect(poses.strike.action).toBe('strike');
    expect(poses.impact.action).toBe('hurt');
    expect(poses.death.action).toBe('death');
    expect(poses.death.rotation).toBe(0);
    expect(poses.death.alpha).toBeLessThan(1);
    expect(poses.removed).toBe(true);
    await mkdir('docs/verification/enemy-motion-v1', { recursive: true });
    await page.screenshot({
      path: `docs/verification/enemy-motion-v1/region-0-reduced-${reduced}.png`,
    });
  });
}
