import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

test('all ten lobby illustrations follow the selected identity without missing images', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).regionModule = (path: string) =>
      import(
        performance
          .getEntriesByType('resource')
          .map((r) => r.name)
          .find((url) => new URL(url).pathname === path) ?? path
      );
  });
  await page.goto('/');
  await expect(page.locator('.home-scene')).toBeVisible();
  await page.evaluate(async () => {
    const storePath = '/src/platform/store.ts',
      domainPath = '/src/domain/game.ts';
    const { gameStore } = await (window as any).regionModule(storePath);
    const { emptyGame, startRun } = await (window as any).regionModule(domainPath);
    const state = emptyGame();
    startRun(state, '외형 검증', 123);
    const f = state.run!.fighter;
    state.run = null;
    state.family.roster = [f];
    state.selectedId = f.id;
    gameStore.state = state;
    gameStore.notify();
  });
  for (let appearance = 0; appearance < 10; appearance++) {
    await page.evaluate(async (appearance) => {
      const storePath = '/src/platform/store.ts';
      const { gameStore } = await (window as any).regionModule(storePath);
      gameStore.state.family.roster[0].appearance = appearance;
      gameStore.notify();
    }, appearance);
    const image = page.locator('.home-hero-image');
    await expect(image).toHaveAttribute('src', `/art/hero-roster-v1/lobby-${appearance}.webp`);
    await expect
      .poll(() =>
        image.evaluate(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
  }
  await mkdir('docs/verification/hero-roster-v1', { recursive: true });
  await page.screenshot({ path: 'docs/verification/hero-roster-v1/lobby.png' });
});

for (const batch of [0, 1])
  test(`all five identities in roster batch ${batch} keep scale across directions and actions`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedRegion(page, 1);
    await page.evaluate(async (appearance) => {
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      gameStore.state.run.fighter.appearance = appearance;
      await gameStore.persist();
    }, batch * 5);
    await page.reload();
    await expect(page.locator('.game-canvas')).toHaveAttribute('data-ready', 'true', {
      timeout: 45000,
    });
    await observeScene(page);
    const rows = await page.evaluate(async (batch) => {
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      const scene = (window as any).regionScene,
        f = gameStore.state.run.fighter;
      gameStore.paused = true;
      scene.scene.pause();
      const rows: any[] = [];
      for (let slot = 0; slot < 5; slot++) {
        f.appearance = batch * 5 + slot;
        const base = scene.motionFrames.get('hero-roster-directions').get(`${slot}-2`);
        const mass = ((110 * base.bodyUnit) / base.height) ** 2;
        for (let dir = 0; dir < 8; dir++)
          for (const state of ['idle', 'walk', 'windup', 'strike', 'hurt', 'death']) {
            scene.feedback.reset();
            scene.motionClock.reset();
            scene.animationTime += 1;
            f.facing = (dir * Math.PI) / 4;
            f.action =
              state === 'walk' ? 'walk' : ['windup', 'strike'].includes(state) ? 'attack' : 'idle';
            f.actionTime = state === 'windup' ? 0.23 : 0.19;
            if (state === 'hurt')
              scene.feedback.impacts.set('hero', { born: scene.animationTime, angle: 0 });
            scene.drawHero(f, state === 'death');
            const actor = scene.actors.get('hero'),
              source = actor.getData('sourceFrame');
            const mesh = scene.continuousActors.get('hero').mesh;
            rows.push({
              appearance: f.appearance,
              dir,
              state,
              frame: actor.frame.name,
              ratio: (source.bodyUnit ** 2 * actor.scaleX * actor.scaleY) / mass,
              finite: mesh.vertices.every(Number.isFinite),
              identity: actor.getData('appearance'),
              texture: source.texture,
              weaponVisible: scene.heldWeapon.image.visible,
            });
          }
      }
      scene.feedback.reset();
      f.appearance = batch * 5;
      f.action = 'idle';
      f.facing = Math.PI / 2;
      scene.draw(gameStore.state.run);
      return rows;
    }, batch);
    expect(rows).toHaveLength(240);
    for (const row of rows) {
      expect(row.ratio).toBeCloseTo(1, 4);
      expect(row.identity).toBe(row.appearance);
      if (row.state === 'windup' || row.state === 'strike')
        expect(row.texture).toBe(`hero-slash-${row.appearance}-isolated`);
      else expect(row.frame.startsWith(`${row.appearance % 5}-`)).toBe(true);
      expect(row.finite).toBe(true);
      if (row.state === 'death') expect(row.weaponVisible).toBe(false);
    }
    expect(errors).toEqual([]);
    const directory = 'docs/verification/hero-roster-v1';
    await mkdir(directory, { recursive: true });
    await writeFile(`${directory}/batch-${batch}.json`, JSON.stringify({ rows, errors }, null, 2));
    await page.screenshot({ path: `${directory}/combat-${batch}.png` });
  });
