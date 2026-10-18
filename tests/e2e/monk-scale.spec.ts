import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import measurements from '../../docs/verification/monk-scale-v2/source-measurements.json' with { type: 'json' };

test.use({ viewport: { width: 1400, height: 1000 } });

for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'} monks keep physical scalp scale through eight walking directions`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    if (webgl)
      await page.addInitScript(() => {
        for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
          const get = proto.getExtension;
          proto.getExtension = function (name: string) {
            return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
          };
        }
      });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 4);
    await observeScene(page);
    const result = await page.evaluate(async (measurements) => {
      const scene = (window as any).regionScene;
      const { gameStore } = await (window as any).regionModule('/src/platform/store.ts');
      const run = gameStore.state.run;
      gameStore.paused = true;
      scene.scene.pause();
      scene.feedback.reset();
      const base = run.enemies[0],
        records: any[] = [];
      const enemies = Array.from({ length: 7 }, (_, slot) => ({
        ...base,
        id: 800 + slot,
        kind: slot < 3 ? ['sword', 'spear', 'archer'][slot] : 'chief',
        role: undefined,
        bossId: slot < 3 ? undefined : `4-${slot - 2}`,
        x: 300 + slot * 200,
        y: 450,
        staggerTime: 0,
        moving: true,
        timer: 0.1,
        speed: 80,
      }));
      for (const enemy of enemies)
        for (let d = 0; d < 8; d++)
          for (const time of [0, 0.2]) {
            enemy.state = 'approach';
            enemy.facing = enemy.aim = (d * Math.PI) / 4;
            scene.motionClock.reset();
            scene.poseTransition.reset();
            scene.animationTime = 10;
            scene.drawEnemy(enemy);
            enemy.x += 20;
            scene.animationTime += time;
            scene.drawEnemy(enemy);
            const actor = scene.actors.get(String(enemy.id));
            if (actor.getData('authoredFrame')) {
              records.push({
                id: enemy.id,
                d,
                time,
                texture: actor.texture.key,
                frame: actor.frame.name,
                height: actor.displayHeight,
                stature: null,
                scalp: null,
                sourceScale: actor.scaleY,
              });
              continue;
            }
            const paths: Record<string, string> = {
              'region-direction-4-isolated': '/art/hostile-consistency-v3/region-4-directions.webp',
              'region-motion-4-isolated': '/art/animation-rebuild-v2/region-4.webp',
              'hostile-identity-directions-isolated':
                '/art/hostile-consistency-v3/identity-directions.webp',
              'hostile-identity-actions-isolated': '/art/animation-rebuild-v2/identity.webp',
            };
            const record = measurements.find(
              (m) => m.frame === actor.frame.name && m.path === paths[actor.texture.key],
            );
            if (!record)
              throw Error(`Unmeasured monk frame ${actor.texture.key}/${actor.frame.name}`);
            // Source-pixel scalp span is independent of leg bend and foreshortening.
            // Equal full-body height would stretch a shorter walking drawing.
            const stature = (record.standingHeight * actor.displayHeight) / actor.frame.cutHeight;
            const scalp = (record.skull.span * actor.displayHeight) / actor.frame.cutHeight;
            records.push({
              id: enemy.id,
              d,
              time,
              texture: actor.texture.key,
              frame: actor.frame.name,
              height: actor.displayHeight,
              stature,
              scalp,
            });
          }
      scene.motionClock.reset();
      scene.poseTransition.reset();
      scene.animationTime += 2;
      const canvas = scene.game.canvas;
      canvas.dataset.monkScale = 'true';
      document.body.append(canvas);
      const css = document.createElement('style');
      css.textContent =
        'canvas[data-monk-scale]{position:fixed!important;inset:0!important;width:1400px!important;height:1000px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
      document.head.append(css);
      for (const child of scene.children.list) child.setVisible(false);
      scene.game.scale.resize(1400, 1000);
      scene.cameras.main.setZoom(1).centerOn(700, 500).setBackgroundColor('#637267');
      for (const [row, dir] of [2, 6, 0, 4].entries())
        for (const [slot, enemy] of enemies.entries()) {
          enemy.id = 900 + row * 7 + slot;
          enemy.state = 'approach';
          enemy.moving = true;
          enemy.facing = enemy.aim = (dir * Math.PI) / 4;
          enemy.x = 100 + slot * 200;
          enemy.y = 180 + row * 220;
          scene.drawEnemy(enemy);
          scene.add.text(
            enemy.x - 85,
            enemy.y + 25,
            `${slot} / ${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][dir]}`,
            { fontSize: '18px', color: '#fff' },
          );
        }
      return { records, renderer: scene.game.renderer.type };
    }, measurements);
    expect(result.renderer).toBe(webgl ? 2 : 1);
    expect(errors).toEqual([]);
    for (let slot = 0; slot < 7; slot++) {
      const authored = result.records.filter(
        (r) => r.id === 800 + slot && r.sourceScale !== undefined,
      );
      if (authored.length) {
        expect(new Set(authored.map((r) => r.sourceScale)).size).toBe(1);
        expect(authored[0].sourceScale).toBe(0.225);
        continue;
      }
      const scalps = result.records.filter((r) => r.id === 800 + slot).map((r) => r.scalp);
      expect(Math.max(...scalps) / Math.min(...scalps)).toBeLessThan(1.00001);
    }
    const root = 'docs/verification/enemy-scale-health-v3/walking';
    await mkdir(root, { recursive: true });
    await writeFile(`${root}/${webgl ? 'webgl' : 'canvas'}.json`, JSON.stringify(result, null, 2));
    await page
      .locator('canvas[data-monk-scale]')
      .screenshot({ path: `${root}/${webgl ? 'webgl' : 'canvas'}.png` });
  });
