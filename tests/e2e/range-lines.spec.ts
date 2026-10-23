import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = '.local-preview/range-lines';
for (const webgl of [false, true])
  for (const region of [0, 9])
    test(`no attack outlines, actual fields and poses remain R${region} ${webgl ? 'WebGL' : 'Canvas'}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1093, height: 614 });
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (webgl)
        await page.addInitScript(() => {
          for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
            const get = proto.getExtension;
            proto.getExtension = function (name: string) {
              return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
            };
          }
        });
      await seedRegion(page, region);
      await observeScene(page);
      const result = await page.evaluate(async () => {
        const w = window as any,
          s = w.regionScene,
          store = (await w.regionModule('/src/platform/store.ts')).gameStore;
        s.scene.pause();
        const r = store.state.run;
        store.paused = false;
        store.rendererReady = false;
        r.effects = [];
        r.formations = [];
        r.encounterObjects = [];
        const b = r.enemies.find((e: any) => e.bossId);
        r.enemies.forEach((e: any) => {
          e.state = 'windup';
          e.timer = 0.15;
          e.aim = 0;
        });
        r.zones = [
          {
            id: 1,
            owner: b.id,
            kind: 'poison',
            x: 550,
            y: 530,
            radius: 110,
            life: 5,
            warning: 0,
            pulse: 0,
          },
          {
            id: 2,
            owner: b.id,
            kind: 'poison',
            x: 1350,
            y: 530,
            radius: 110,
            life: 5,
            warning: 1,
            pulse: 0,
          },
        ];
        r.projectiles = [
          {
            x: 1000,
            y: 400,
            vx: 50,
            vy: 50,
            radius: 10,
            life: 1,
            friendly: false,
            owner: b.id,
            damage: 1,
            visual: 'poison-bomb',
            landing: { x: 1250, y: 750, radius: 120, kind: 'poison' },
          },
        ];
        const before = JSON.stringify(r),
          outlineCalls: string[] = [];
        for (const layer of [s.ground, s.clarity.edges])
          for (const method of ['strokeCircle', 'strokeEllipse', 'strokePath', 'lineBetween']) {
            const old = layer[method];
            layer[method] = function (...args: unknown[]) {
              outlineCalls.push(method);
              return old.apply(this, args);
            };
          }
        s.draw(r);
        store.notify();
        return {
          renderer: s.game.renderer.type,
          unchanged: before === JSON.stringify(r),
          outlineCalls,
          rangeLayersRemoved: s.clarity.ink === undefined && s.bossReadability.ground === undefined,
          images: s.paintedZones.pool
            .filter((p: any) => p.visible)
            .map((p: any) => ({ x: p.x, y: p.y })),
          poses: r.enemies.map(
            (e: any) =>
              s.actors.get(String(e.id))?.getData('motionAction') ??
              s.continuousActors.get(String(e.id))?.mesh.getData('action'),
          ),
          projectile: s.paintedEffects.pool.some(
            (p: any) => p.visible && p.frame.name === 'poison-bomb',
          ),
        };
      });
      expect(result.renderer).toBe(webgl ? 2 : 1);
      expect(result.unchanged).toBe(true);
      expect(result.rangeLayersRemoved).toBe(true);
      expect(result.outlineCalls).toEqual([]);
      expect(result.images.some((p: any) => p.x === 550)).toBe(true);
      expect(result.images.some((p: any) => p.x === 1350 || p.x === 1250)).toBe(false);
      expect(result.poses.every((p: string) => p === 'windup')).toBe(true);
      expect(result.projectile).toBe(true);
      expect(errors).toEqual([]);
      await mkdir(proof, { recursive: true });
      await page.screenshot({ path: `${proof}/R${region}-${webgl}.png` });
      await writeFile(`${proof}/R${region}-${webgl}.json`, JSON.stringify(result, null, 2));
    });
