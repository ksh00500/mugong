import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeScene, seedRegion } from './support/region';

const proof = 'docs/verification/shaolin-staff-v1';
for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'} staff contact drawing matches damage in eight directions`, async ({
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
    await seedRegion(page, 4);
    await observeScene(page);
    const result = await page.evaluate(async () => {
      const load = (window as any).regionModule;
      const { gameStore } = await load('/src/platform/store.ts');
      const { tick } = await load('/src/domain/game.ts');
      const { enemyAttack } = await load('/src/domain/combat.ts');
      const scene = (window as any).regionScene,
        run = gameStore.state.run;
      gameStore.paused = true;
      scene.scene.pause();
      run.offers = [];
      run.zones = [];
      run.projectiles = [];
      run.encounterObjects = [];
      run.formations = [];
      run.encounters = [];
      const base = run.enemies[0],
        records = [];
      for (let d = 0; d < 8; d++) {
        const angle = (d * Math.PI) / 4;
        const e = {
          ...base,
          id: 5000 + d,
          kind: 'spear',
          role: 'staffguard',
          bossId: undefined,
          elite: false,
          x: 800,
          y: 500,
          state: 'windup',
          timer: 0,
          aim: angle,
          facing: angle,
          staggerTime: 0,
          skillClock: 100,
          hp: 10000,
          maxHp: 10000,
          strike: undefined,
        };
        run.enemies = [e];
        Object.assign(run.fighter, {
          x: 800 + Math.cos(angle) * 75,
          y: 500 + Math.sin(angle) * 75,
          hp: 120,
          arts: [],
          shield: 0,
          guard: 0,
          fortify: 0,
          invulnerable: 0,
        });
        scene.motionClock.reset();
        scene.feedback.reset();
        e.timer = enemyAttack(e).windup * 0.3;
        scene.animationTime += 1;
        scene.drawEnemy(e);
        const preparation = scene.actors.get(String(e.id)).getData('authoredFrame').pose;
        e.timer = 0;
        let contact: any = null;
        for (let frame = 0; frame < 100; frame++) {
          tick(
            run,
            { dx: 0, dy: 0, aim: angle, attack: false, defense: false, ultimate: false },
            1 / 120,
          );
          scene.animationTime += 1 / 120;
          scene.drawEnemy(e);
          if (run.fighter.hp < 120) {
            const actor = scene.actors.get(String(e.id));
            contact = {
              action: actor.getData('motionAction'),
              pose: actor.getData('authoredFrame').pose,
              hp: run.fighter.hp,
              state: e.state,
              progress: actor.getData('motionProgress'),
            };
            break;
          }
        }
        records.push({ d, preparation, contact });
      }
      return { records, renderer: scene.game.renderer.type };
    });
    expect(result.renderer).toBe(webgl ? 2 : 1);
    for (const r of result.records) {
      expect(r.preparation).toBe(1);
      expect(r.contact).not.toBeNull();
      expect(r.contact.action).toBe('strike');
      expect(r.contact.pose).toBe(2);
      expect(r.contact.hp).toBeLessThan(120);
    }
    await mkdir(proof, { recursive: true });
    await writeFile(
      `${proof}/${webgl ? 'webgl' : 'canvas'}-damage-contact.json`,
      JSON.stringify(result, null, 2),
    );
  });
for (const webgl of [false, true])
  for (const reduced of [false, true])
    test(`${webgl ? 'WebGL' : 'Canvas'} authored staff: eight views and ${reduced ? 'reduced' : 'full'} motion`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
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
      const result = await page.evaluate(async () => {
        const load = (window as any).regionModule;
        const { gameStore } = await load('/src/platform/store.ts');
        const { enemyAttack, STRIKE_TIMING } = await load('/src/domain/combat.ts');
        const { STAFF_ART } = await load('/src/game/authored-enemy.ts');
        const scene = (window as any).regionScene;
        gameStore.paused = true;
        scene.scene.pause();
        const base = {
          ...gameStore.state.run.enemies[0],
          kind: 'spear',
          role: 'staffguard',
          bossId: undefined,
          hp: 75,
          maxHp: 100,
          staggerTime: 0,
          moving: false,
          speed: 70,
          x: 300,
          y: 300,
        };
        const phases = ['idle', 'walk', 'windup', 'strike', 'recover', 'hurt', 'death'];
        const records: any[] = [];
        const alphaTops = new Map<string, number>();
        const render = (
          id: number,
          direction: number,
          phase: string,
          progress: number,
          gait: number,
          x = 300,
          y = 300,
          impacted = false,
        ) => {
          const e = {
            ...base,
            id,
            x,
            y,
            facing: (direction * Math.PI) / 4,
            aim: (direction * Math.PI) / 4,
            state: ['idle', 'walk', 'hurt', 'death'].includes(phase) ? 'approach' : phase,
            moving: phase === 'walk',
            staggerTime: phase === 'hurt' || impacted ? 0.12 : 0,
            strike: undefined,
          };
          const profile = enemyAttack(e);
          e.timer =
            phase === 'windup'
              ? profile.windup * (1 - progress)
              : phase === 'recover'
                ? profile.recovery * (1 - progress)
                : STRIKE_TIMING.duration * (1 - progress);
          scene.feedback.reset();
          scene.animationTime += 1;
          if (phase === 'hurt' || impacted)
            scene.feedback.receive(
              [{ kind: 'impact', target: id, x, y, amount: 1, angle: 0, killed: false }],
              scene.animationTime - 0.06,
              false,
            );
          // Test the renderer through the real direction clock and draw entry point.
          scene.motionClock.reset();
          if (phase === 'walk')
            scene.motionClock.sample(
              String(id),
              x - Math.cos(e.facing) * gait * 84,
              y - Math.sin(e.facing) * gait * 84,
              e.facing,
              scene.animationTime - 0.1,
              true,
            );
          scene.drawEnemy(e, phase === 'death' ? 0.05 : undefined);
          const actor = scene.actors.get(String(id)),
            f = actor.getData('authoredFrame');
          if (!f) throw Error('Missing authored source');
          const bar = actor.getData('healthBar');
          if (!alphaTops.has(f.name)) {
            const texture = scene.textures.get(f.texture);
            const inspection = document.createElement('canvas');
            inspection.width = f.width;
            inspection.height = f.height;
            const context = inspection.getContext('2d', { willReadFrequently: true })!;
            context.drawImage(
              texture.source[0].image,
              f.x,
              f.y,
              f.width,
              f.height,
              0,
              0,
              f.width,
              f.height,
            );
            const pixels = context.getImageData(0, 0, f.width, f.height).data;
            let top = Infinity;
            for (let y = 0; y < f.height; y++)
              for (let x = 0; x < f.width; x++)
                if (pixels[(y * f.width + x) * 4 + 3] >= 128) top = Math.min(top, y);
            alphaTops.set(f.name, top);
          }
          const actualTop = actor.y + (alphaTops.get(f.name)! - f.footY) * actor.scaleY;
          return {
            id,
            direction,
            phase,
            progress,
            gait,
            view: actor.getData('view'),
            flip: actor.flipX,
            action: actor.getData('motionAction'),
            texture: actor.texture.key,
            frame: actor.frame.name,
            scale: actor.scaleX,
            scaleY: actor.scaleY,
            visible: actor.visible,
            meshVisible: scene.continuousActors.get(String(id))?.mesh.visible ?? false,
            foot: [actor.x, actor.y],
            bar,
            gap: bar ? actualTop - bar.y - bar.height : undefined,
            actualTop,
          };
        };
        for (let d = 0; d < 8; d++)
          for (const phase of phases)
            for (const p of [0, 0.2, 0.35, 0.65, 0.95])
              records.push(render(3000 + d, d, phase, p, p * 0.5));
        const impacted = render(3100, 7, 'strike', 0.35, 0, 300, 300, true);
        const canvas = scene.game.canvas;
        canvas.dataset.staffReview = 'true';
        document.body.append(canvas);
        const css = document.createElement('style');
        css.textContent =
          'canvas[data-staff-review]{position:fixed!important;inset:0!important;width:1440px!important;height:1000px!important;z-index:100000!important;margin:0!important}';
        document.head.append(css);
        scene.game.scale.resize(1440, 1000);
        scene.cameras.main.setZoom(1).centerOn(720, 500).setBackgroundColor('#ddd6c3');
        (window as any).staffComparison = (progress: number) => {
          for (const child of scene.children.list) child.setVisible(false);
          scene.graphics.clear().setVisible(true);
          for (let row = 0; row < phases.length; row++)
            for (let d = 0; d < 8; d++) {
              const x = 110 + d * 172,
                y = 130 + row * 135;
              render(4000 + row * 8 + d, d, phases[row], progress, 0.5, x, y);
              scene.add.text(
                x - 65,
                y + 20,
                `${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][d]} / ${phases[row]}`,
                { fontSize: '13px', color: '#20382d' },
              );
            }
        };
        return {
          records,
          impacted,
          renderer: scene.game.renderer.type,
          reduced: scene.reducedMotion,
          healthClearance: STAFF_ART.healthClearance,
        };
      });
      expect(result.renderer).toBe(webgl ? 2 : 1);
      expect(result.reduced).toBe(reduced);
      const views = [2, 1, 0, 1, 2, 3, 4, 3],
        flips = [false, false, false, true, true, true, false, false];
      for (const r of result.records) {
        expect(r.scale).toBe(0.225);
        expect(r.scaleY).toBe(r.scale);
        expect(r.view).toBe(views[r.direction]);
        expect(r.flip).toBe(flips[r.direction]);
        expect(r.visible).toBe(true);
        expect(r.meshVisible).toBe(false);
        if (r.phase === 'death') expect(r.bar).toBeNull();
        else {
          expect(r.gap).toBeGreaterThanOrEqual(7);
          expect(r.bar.y).toBeCloseTo(300 - result.healthClearance, 8);
        }
      }
      expect(result.impacted.action).toBe('strike');
      expect(result.impacted.frame).toBe('3-combat-2');
      expect(errors).toEqual([]);
      await mkdir(proof, { recursive: true });
      const prefix = `${proof}/${webgl ? 'webgl' : 'canvas'}-${reduced ? 'reduced' : 'full'}`;
      await writeFile(`${prefix}.json`, JSON.stringify(result, null, 2));
      for (const p of [0.2, 0.35, 0.65]) {
        await page.evaluate((p) => (window as any).staffComparison(p), p);
        await page.locator('canvas[data-staff-review]').screenshot({ path: `${prefix}-${p}.png` });
      }
    });
