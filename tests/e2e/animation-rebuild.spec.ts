import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

test('new hero reactions and drone wingbeats keep body scale and orientation', async ({ page }) => {
  await seedRegion(page, 6);
  await observeScene(page);
  const proof = await page.evaluate(async () => {
    const { gameStore: store } = await (window as any).regionModule('/src/platform/store.ts');
    const scene = (window as any).regionScene,
      run = store.state.run;
    store.paused = true;
    scene.scene.pause();
    scene.feedback.reset();
    const rows: any[] = [];
    for (let direction = 0; direction < 8; direction++) {
      run.fighter.facing = (direction * Math.PI) / 4;
      run.fighter.action = 'idle';
      scene.animationTime += 1;
      scene.drawHero(run.fighter, false);
      const idle = scene.heroFrames.get(`0-${direction}`),
        actor = scene.actors.get('hero');
      const mass = idle.bodyUnit ** 2 * actor.scaleX * actor.scaleY;
      for (const dead of [false, true]) {
        run.fighter.action = 'attack';
        run.fighter.actionTime = 0.12;
        scene.feedback.impacts.set('hero', { born: scene.animationTime, angle: 0 });
        scene.drawHero(run.fighter, dead);
        const pose = scene.motionFrames.get('hero-reactions').get(actor.frame.name);
        const mesh = scene.continuousActors.get('hero').mesh;
        rows.push({
          direction,
          dead,
          frame: actor.frame.name,
          ratio: (pose.bodyUnit ** 2 * actor.scaleX * actor.scaleY) / mass,
          weaponVisible: scene.heldWeapon.image.visible,
          finite: mesh.vertices.every(Number.isFinite),
          native: actor.getData('nativePose'),
          rotation: actor.rotation,
        });
      }
      scene.feedback.reset();
    }
    run.encounterObjects = [
      {
        id: 9001,
        kind: 'flag',
        mechanic: 'drone',
        x: 900,
        y: 500,
        radius: 30,
        warning: 0,
        life: 10,
        age: 0,
      },
    ];
    const frames = new Set<string>(),
      rotations = new Set<number>();
    for (let i = 0; i < 4; i++) {
      run.encounterObjects[0].age = i / 8;
      scene.draw(run);
      const actor = scene.actors.get('object-9001');
      frames.add(actor.frame.name);
      rotations.add(actor.rotation);
    }
    return { rows, droneFrames: [...frames], rotations: [...rotations] };
  });
  expect(proof.rows).toHaveLength(16);
  for (const row of proof.rows) {
    expect(row.frame).toBe(`${row.dead ? 1 : 0}-${row.direction}`);
    expect(row.ratio).toBeCloseTo(1, 3);
    expect(row.weaponVisible).toBe(false);
    expect(row.rotation).toBe(0);
    expect(row.finite && row.native).toBe(true);
  }
  expect(proof.droneFrames).toEqual(['0-0', '0-1', '0-2', '0-3']);
  expect(proof.rotations).toEqual([0]);
  await mkdir('docs/verification/animation-rebuild-v2', { recursive: true });
  await writeFile(
    'docs/verification/animation-rebuild-v2/runtime-reactions.json',
    JSON.stringify(proof, null, 2),
  );
  await page.screenshot({
    path: 'docs/verification/animation-rebuild-v2/runtime-reactions-and-drone.png',
  });
});
