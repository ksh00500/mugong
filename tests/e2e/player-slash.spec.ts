import { test, expect } from '@playwright/test';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const directory = process.env.MUGONG_SLASH_PROOF ?? 'docs/verification/hero-slash-v1';
const webgl = process.env.MUGONG_SLASH_RENDERER === 'WebGL';
const prefix = webgl ? 'continuous-webgl' : 'continuous';
test.use({
  viewport: { width: 1280, height: 720 },
  video: { mode: 'on', size: { width: 1280, height: 720 } },
});

for (const batch of [0, 1])
  test(`continuous player cut review, five identities (${batch})`, async ({ page }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const getExtension = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : getExtension.call(this, name);
          };
        }
      });
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
    const review = await page.evaluate(async (batch) => {
      const module = (window as any).regionModule;
      const { gameStore } = await module('/src/platform/store.ts');
      const { makeLootItem, WEAPON_STYLES } = await module('/src/domain/items.ts');
      const { ART_WEAPONS } = await module('/src/domain/content.ts');
      const { ContinuousActor } = await module('/src/game/continuous-actor.ts');
      const { MotionClock } = await module('/src/game/directional-motion.ts');
      const { PoseTransition } = await module('/src/game/pose-transition.ts');
      const scene = (window as any).regionScene,
        f = gameStore.state.run.fighter;
      gameStore.paused = true;
      scene.scene.pause();
      for (const child of scene.children.list) child.setVisible(false);
      scene.game.scale.resize(1280, 720);
      scene.cameras.main.setZoom(1).centerOn(640, 360).setBackgroundColor('#d9cfba');
      const canvas = scene.game.canvas;
      canvas.dataset.slashReview = 'true';
      document.body.append(canvas);
      const css = document.createElement('style');
      css.textContent =
        'canvas[data-slash-review] {position:fixed!important;inset:0!important;width:1280px!important;height:720px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
      document.head.append(css);
      const heading = scene.add
        .text(40, 35, '', { fontSize: '26px', color: '#132b20' })
        .setDepth(900);
      scene.add
        .text(40, 80, 'Real renderer / authored poses / 0.09s contact / no attack timing changes', {
          fontSize: '16px',
          color: '#132b20',
        })
        .setDepth(900);
      const pool = Array.from({ length: 5 }, (_, slot) => {
        const actor = new ContinuousActor(scene, 'hero-isolated');
        const weapon = scene.add.image(0, 0, 'hero').setVisible(false);
        const smear = scene.add.graphics();
        scene.add
          .text(95 + slot * 250, 550, `Identity ${batch * 5 + slot}`, {
            fontSize: '19px',
            color: '#132b20',
          })
          .setDepth(900);
        return { actor, weapon, smear, clock: new MotionClock(), transition: new PoseTransition() };
      });
      const contacts: any[] = [];
      const bladeSteps: any[] = [];
      const swordPreviews = new Map<number, (elapsed: number) => void>();
      let renderedFrames = 0;
      for (const style of WEAPON_STYLES)
        for (const dir of [0, 1, 2, 3, 4, 5, 6, 7]) {
          const item = makeLootItem(`weapon-${style}-0`, style, 'weapon');
          const id = Object.keys(ART_WEAPONS).find((k) => ART_WEAPONS[k] === style)!;
          f.items = [item];
          f.arts = [{ id, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
          f.bindings = { [id]: item.id };
          f.active = 0;
          heading.setText(`${style} / ${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][dir]}`);
          scene.feedback.reset();
          const start = scene.animationTime + 1;
          for (const copy of pool) {
            copy.clock.reset();
            copy.transition.reset();
          }
          let previousElapsed = -1;
          const draw = (elapsed: number, record = false) => {
            if (elapsed < previousElapsed)
              for (const copy of pool) {
                copy.clock.reset();
                copy.transition.reset();
              }
            previousElapsed = elapsed;
            const attacking = elapsed < 0.28;
            scene.animationTime = start + elapsed;
            scene.feedback.contact = start + 0.09;
            f.action = attacking ? 'attack' : 'idle';
            f.actionTime = attacking ? 0.28 - elapsed : 0;
            f.facing = (dir * Math.PI) / 4;
            f.x = 640;
            f.y = 500;
            for (let slot = 0; slot < 5; slot++) {
              f.appearance = batch * 5 + slot;
              // Each review actor has an independent pose start, like a real actor.
              scene.motionClock = pool[slot].clock;
              scene.poseTransition = pool[slot].transition;
              scene.drawHero(f, false);
              const source = scene.continuousActors.get('hero').mesh;
              const weapon = scene.heldWeapon.image,
                body = scene.actors.get('hero');
              const copy = pool[slot],
                x = 125 + slot * 250;
              copy.actor.mesh.setTexture(source.texture.key);
              copy.actor.mesh.vertices.splice(0, source.vertices.length, ...source.vertices);
              copy.actor.mesh
                .setPosition(x + source.x - f.x, source.y)
                .setRotation(source.rotation)
                .setDepth(500)
                .setVisible(true);
              copy.weapon
                .setTexture(weapon.texture.key, weapon.frame.name)
                .setOrigin(weapon.originX, weapon.originY)
                .setScale(weapon.scaleX, weapon.scaleY)
                .setPosition(x + weapon.x - f.x, weapon.y)
                .setRotation(weapon.rotation)
                .setAlpha(weapon.alpha)
                .setDepth(500 + weapon.depth - source.depth)
                .setVisible(weapon.visible);
              copy.smear.clear().setDepth(copy.weapon.depth - 0.02);
              const ribbons = (weapon.getData('bladeRibbons') ?? []).map((ribbon: any) => ({
                ...ribbon,
                points: ribbon.points.map((p: any) => ({ ...p, x: p.x + x - f.x })),
              }));
              for (const ribbon of ribbons) {
                copy.smear.fillStyle(style === 'dao' ? 0xffe6b2 : 0xf5f6ee, ribbon.alpha);
                copy.smear.fillPoints(ribbon.points, true);
              }
              // Record the explicit contact sample once. A rAF frame may also
              // land on 90ms when browser timer precision is rounded.
              if (record && Math.abs(elapsed - 0.09) < 1e-7) {
                const paintedAxis = style === 'fan' ? -Math.PI / 2 : Math.PI / 2;
                const error = Math.atan2(
                  Math.sin(weapon.rotation + paintedAxis - body.rotation - f.facing),
                  Math.cos(weapon.rotation + paintedAxis - body.rotation - f.facing),
                );
                contacts.push({
                  appearance: f.appearance,
                  style,
                  dir,
                  error,
                  source: body.getData('heldSlash'),
                });
              }
              if (record && style === 'sword') {
                const axis = weapon.rotation + Math.PI / 2;
                bladeSteps.push({
                  appearance: f.appearance,
                  dir,
                  elapsed,
                  wristY: weapon.y,
                  tipY: weapon.y + Math.sin(axis) * weapon.displayHeight * (1 - weapon.originY),
                  angle: axis - body.rotation,
                  lengthScale: weapon.getData('bladeLengthScale'),
                  authoredPose: weapon.getData('authoredPose'),
                });
              }
            }
            scene.continuousActors.get('hero').hide();
            scene.heldWeapon.image.setVisible(false);
            scene.heldWeapon.smear.setVisible(false);
            renderedFrames++;
          };
          if (style === 'sword') swordPreviews.set(dir, draw);
          if (style === 'sword') for (const elapsed of [0, 0.09, 0.16]) draw(elapsed, true);
          else draw(0.09, true); // Exact simulation contact is checked independently of rAF.
          await new Promise<void>((resolve) => {
            const born = performance.now();
            const frame = (now: number) => {
              const elapsed = (now - born) / 1000;
              draw(Math.min(0.64, elapsed));
              if (elapsed < 0.64) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
        }
      (window as any).heroSlashPreview = (elapsed: number, direction = 0) => {
        const item = makeLootItem('weapon-sword-0', 'preview', 'weapon');
        f.items = [item];
        f.arts = [{ id: 'huashan', level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
        f.bindings = { huashan: item.id };
        f.active = 0;
        heading.setText(
          `sword / ${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][direction]} / one real 0.28s cut`,
        );
        swordPreviews.get(direction)!(elapsed);
      };
      return {
        contacts,
        bladeSteps,
        renderedFrames,
        renderer: scene.game.renderer.type,
        note: 'Continuous render review. Simulation is paused; this is not an AI/gameplay test.',
      };
    }, batch);
    expect(review.contacts).toHaveLength(240);
    expect(review.renderer).toBe(webgl ? 2 : 1);
    for (const contact of review.contacts) {
      expect(Math.abs(contact.error)).toBeLessThan(1e-7);
      expect(contact.source[0]).toBe(contact.appearance);
      expect(contact.source[1]).toBe(1);
    }
    expect(review.renderedFrames).toBeGreaterThan(180);
    expect(review.bladeSteps).toHaveLength(120);
    for (let i = 0; i < 5; i++)
      for (let dir = 0; dir < 8; dir++) {
        const rows = review.bladeSteps.filter(
          (r: any) => r.appearance === batch * 5 + i && r.dir === dir,
        );
        const [ready, contact, follow] = [0, 0.09, 0.16].map((t) =>
          rows.find((r: any) => r.elapsed === t)!,
        );
        expect(ready.tipY).toBeLessThan(ready.wristY);
        for (const sample of [ready, contact, follow]) {
          expect(sample.lengthScale).toBe(1);
          expect(sample.authoredPose).toContain(`${batch * 5 + i}/sword/attack/`);
        }
        if (dir === 0 || dir === 4) {
          expect(ready.tipY).toBeLessThan(contact.tipY);
          expect(follow.tipY).toBeGreaterThan(follow.wristY);
        }
      }
    expect(errors).toEqual([]);
    await mkdir(directory, { recursive: true });
    if (!webgl) {
      const times = [
        0, 0.015, 0.03, 0.045, 0.06, 0.075, 0.09, 0.105, 0.12, 0.14, 0.17, 0.2, 0.24, 0.279, 0.3,
        0.36, 0.44, 0.6,
      ];
      for (const direction of [0, 2, 6]) {
        const folder = direction === 0 ? `preview-${batch}` : `preview-${batch}-D${direction}`;
        await mkdir(`${directory}/${folder}`, { recursive: true });
        for (const [frame, elapsed] of times.entries()) {
          await page.evaluate(
            ({ elapsed, direction }) => (window as any).heroSlashPreview(elapsed, direction),
            { elapsed, direction },
          );
          await page.waitForTimeout(40);
          await page.locator('canvas[data-slash-review]').screenshot({
            path: `${directory}/${folder}/${String(frame).padStart(2, '0')}.png`,
          });
        }
        await writeFile(`${directory}/${folder}/times.json`, JSON.stringify(times));
      }
    }
    await writeFile(
      `${directory}/${prefix}-${batch}.json`,
      JSON.stringify({ ...review, errors }, null, 2),
    );
    const video = page.video()!;
    await page.close();
    await copyFile(await video.path(), `${directory}/${prefix}-${batch}.webm`);
  });
