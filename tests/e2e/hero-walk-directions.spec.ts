import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const directory = 'docs/verification/hero-walk-directions';
// Independently recorded from the actual sheets, not the production selector.
const reviewed = [
  [
    [4, true],
    [7, false],
    [2, false],
    [7, true],
    [4, false],
    [5, true],
    [6, false],
    [5, false],
  ],
  [
    [4, true],
    [7, false],
    [2, false],
    [7, true],
    [4, false],
    [5, true],
    [6, false],
    [5, false],
  ],
  [
    [4, true],
    [7, false],
    [2, false],
    [7, true],
    [4, false],
    [5, true],
    [6, false],
    [5, false],
  ],
  [
    [4, true],
    [7, false],
    [2, false],
    [7, true],
    [4, false],
    [5, true],
    [6, false],
    [5, false],
  ],
  [
    [4, true],
    [7, false],
    [2, false],
    [7, true],
    [4, false],
    [5, true],
    [6, false],
    [5, false],
  ],
  [
    [7, false],
    [1, false],
    [2, false],
    [1, true],
    [7, true],
    [4, false],
    [6, false],
    [4, true],
  ],
  [
    [5, true],
    [0, false],
    [2, false],
    [0, true],
    [5, false],
    [4, false],
    [6, false],
    [4, true],
  ],
  [
    [5, true],
    [7, false],
    [2, false],
    [7, true],
    [5, false],
    [4, false],
    [6, false],
    [4, true],
  ],
  [
    [5, true],
    [7, false],
    [2, false],
    [7, true],
    [5, false],
    [4, false],
    [6, false],
    [4, true],
  ],
  [
    [5, true],
    [0, false],
    [2, false],
    [0, true],
    [5, false],
    [4, false],
    [6, false],
    [4, true],
  ],
];
for (const renderer of ['Canvas', 'WebGL'])
  for (const batch of [0, 1])
    test(`${renderer}: input-driven walking keeps every roster identity facing its eight directions (${batch})`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((renderer) => {
        if (renderer === 'Canvas') {
          const getContext = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            kind: string,
            options?: any,
          ) {
            return kind.includes('webgl') ? null : (getContext as any).call(this, kind, options);
          } as typeof getContext;
        } else {
          for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
            const getExtension = proto.getExtension;
            proto.getExtension = function (name: string) {
              return name === 'WEBGL_debug_renderer_info' ? null : getExtension.call(this, name);
            };
          }
        }
      }, renderer);
      await page.setViewportSize({ width: 1600, height: 1000 });
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
      const proof = await page.evaluate(
        async ({ batch, reviewed }) => {
          const module = (window as any).regionModule;
          const { gameStore: store } = await module('/src/platform/store.ts');
          const { tick } = await module('/src/domain/game.ts');
          const { ContinuousActor } = await module('/src/game/continuous-actor.ts');
          const scene = (window as any).regionScene,
            run = store.state.run,
            f = run.fighter;
          store.paused = true;
          scene.scene.pause();
          scene.feedback.reset();
          run.enemies = [run.enemies[0]];
          Object.assign(run.enemies[0], {
            x: 1750,
            y: 950,
            timer: 1000,
            speed: 0,
            state: 'windup',
          });
          const vectors = [
            [1, 0],
            [1, 1],
            [0, 1],
            [-1, 1],
            [-1, 0],
            [-1, -1],
            [0, -1],
            [1, -1],
          ];
          const failures: any[] = [],
            rows: any[] = [];
          let count = 0;
          for (let slot = 0; slot < 5; slot++) {
            f.appearance = batch * 5 + slot;
            for (let dir = 0; dir < 8; dir++) {
              Object.assign(f, { x: 960, y: 520, action: 'idle', actionTime: 0 });
              // Isolate locomotion from the seeded snow map's cold fields.
              run.zones = [];
              run.zoneClock = 0;
              run.encounterObjects = [];
              run.projectiles = [];
              Object.assign(f, { freezeTime: 0, capturedTime: 0, coldStacks: 0, slowTime: 0 });
              scene.motionClock.reset();
              const [dx, dy] = vectors[dir];
              const [view, flip] = reviewed[f.appearance][dir];
              const signatures = new Set<string>(),
                gaits: number[] = [];
              const start = { x: f.x, y: f.y };
              let handError = 0;
              for (let step = 0; step < 40; step++) {
                // An intentionally opposite mouse aim must not override walking.
                tick(
                  run,
                  {
                    dx,
                    dy,
                    aim: Math.PI + (dir * Math.PI) / 4,
                    attack: false,
                    defense: false,
                    ultimate: false,
                  },
                  1 / 60,
                );
                scene.animationTime += 1 / 60;
                scene.drawHero(f, false);
                const actor = scene.actors.get('hero'),
                  surface = scene.continuousActors.get('hero'),
                  mesh = surface.mesh;
                const signature = `${actor.texture.key}/${actor.frame.name}/${actor.flipX}`;
                signatures.add(signature);
                gaits.push(actor.getData('renderRig').stride);
                const weapon = scene.heldWeapon.image,
                  uv = weapon.getData('handUV');
                if (weapon.visible && uv) {
                  const point = surface.localPoint(...uv);
                  handError = Math.max(
                    handError,
                    Math.hypot(weapon.x - actor.x - point.x, weapon.y - actor.y - point.y),
                  );
                }
                if (
                  f.action !== 'walk' ||
                  mesh.getData('direction') !== dir ||
                  actor.frame.name !== `${slot}-${view}` ||
                  actor.flipX !== flip ||
                  !mesh.vertices.every(Number.isFinite)
                )
                  failures.push({
                    appearance: f.appearance,
                    dir,
                    step,
                    action: f.action,
                    sector: mesh.getData('direction'),
                    signature,
                  });
                count++;
              }
              if (
                (dx && Math.sign(f.x - start.x) !== dx) ||
                (dy && Math.sign(f.y - start.y) !== dy)
              )
                failures.push({ dir, error: 'world movement' });
              rows.push({
                appearance: f.appearance,
                dir,
                signatures: [...signatures],
                strideRange: Math.max(...gaits) - Math.min(...gaits),
                handError,
              });
            }
          }
          // Render the same actual Mesh2D geometry as a readable direction contact sheet.
          for (const child of scene.children.list) child.setVisible(false);
          scene.game.scale.resize(1600, 1000);
          scene.cameras.main.setZoom(1).centerOn(800, 500).setBackgroundColor('#d9cfba');
          const canvas = scene.game.canvas;
          canvas.dataset.directionReview = 'true';
          document.body.append(canvas);
          const css = document.createElement('style');
          css.textContent =
            'canvas[data-direction-review]{position:fixed!important;inset:0!important;width:1600px!important;height:1000px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
          document.head.append(css);
          ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'].forEach((name, dir) =>
            scene.add
              .text(135 + dir * 190, 25, name, { fontSize: '24px', color: '#132b20' })
              .setDepth(9999),
          );
          for (let slot = 0; slot < 5; slot++)
            for (let dir = 0; dir < 8; dir++) {
              f.appearance = batch * 5 + slot;
              Object.assign(f, {
                x: 140 + dir * 190,
                y: 210 + slot * 185,
                facing: (dir * Math.PI) / 4,
                action: 'walk',
                actionTime: 0,
              });
              scene.motionClock.reset();
              scene.animationTime += 1;
              scene.drawHero(f, false);
              const body = scene.actors.get('hero');
              const surface = new ContinuousActor(scene, body.texture.key);
              surface.draw(body, body.getData('renderRig'), dir, 'walk');
              const sourceWeapon = scene.heldWeapon.image;
              if (sourceWeapon.visible)
                scene.add
                  .image(
                    sourceWeapon.x,
                    sourceWeapon.y,
                    sourceWeapon.texture.key,
                    sourceWeapon.frame.name,
                  )
                  .setDisplaySize(sourceWeapon.displayWidth, sourceWeapon.displayHeight)
                  .setOrigin(sourceWeapon.originX, sourceWeapon.originY)
                  .setRotation(sourceWeapon.rotation)
                  .setDepth(sourceWeapon.depth);
              if (dir === 0)
                scene.add
                  .text(5, 150 + slot * 185, `ID ${f.appearance}`, {
                    fontSize: '18px',
                    color: '#132b20',
                  })
                  .setDepth(9999);
            }
          scene.continuousActors.get('hero').hide();
          scene.heldWeapon.image.setVisible(false);
          return { count, rows, failures };
        },
        { batch, reviewed },
      );
      expect(proof.count).toBe(1600);
      expect(proof.failures).toEqual([]);
      for (const row of proof.rows) {
        expect(row.signatures).toHaveLength(1);
        expect(row.strideRange).toBeGreaterThan(0.03);
        expect(row.handError).toBeLessThan(0.00001);
      }
      expect(errors).toEqual([]);
      await mkdir(directory, { recursive: true });
      await writeFile(
        `${directory}/${renderer}-${batch}.json`,
        JSON.stringify({ ...proof, errors }, null, 2),
      );
      await page.screenshot({ path: `${directory}/${renderer}-${batch}.png` });
    });
