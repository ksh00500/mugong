import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import measurements from '../../docs/verification/monk-scale-v2/source-measurements.json' with { type: 'json' };

const proof = 'docs/verification/enemy-scale-health-v3';
test.use({ viewport: { width: 1440, height: 1800 } });
for (const webgl of [false, true])
  for (let region = 0; region < 10; region++)
    test(`${webgl ? 'WebGL' : 'Canvas'} region ${region}: every enemy view, gait and health bar`, async ({
      page,
    }) => {
      test.setTimeout(120000);
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
      await seedRegion(page, region);
      await observeScene(page);
      const result = await page.evaluate(
        async ({ region, measurements }) => {
          const load = (window as any).regionModule;
          const { gameStore } = await load('/src/platform/store.ts');
          const { REGION_ROSTERS, ROLE_PROFILES } = await load('/src/domain/region-enemies.ts');
          const { REGIONS } = await load('/src/domain/campaign.ts');
          const scene = (window as any).regionScene;
          const run = gameStore.state.run;
          gameStore.paused = true;
          scene.scene.pause();
          const base = run.enemies[0];
          const enemies = [...new Set<string>(REGION_ROSTERS[REGIONS[region].name])].map(
            (role, i) => ({
              ...base,
              id: 800 + i,
              role,
              bossId: undefined,
              kind: ROLE_PROFILES[role].kind,
              x: 200,
              y: 300,
              staggerTime: 0,
              timer: 0.15,
              strike: undefined,
              hp: 75,
              maxHp: 100,
              speed: 80,
            }),
          );
          for (let phase = 1; phase <= 4; phase++)
            enemies.push({
              ...base,
              id: 900 + phase,
              role: undefined,
              bossId: `${region}-${phase}`,
              kind: 'chief',
              x: 200,
              y: 300,
              staggerTime: 0,
              timer: 0.15,
              strike: undefined,
              hp: 75,
              maxHp: 100,
              speed: 80,
            });
          const phases = [
            'idle',
            'walk0',
            'walk1',
            'windup',
            'strike',
            'recover',
            'recoverWalk0',
            'recoverWalk1',
            'hurt',
            'death',
          ];
          const records: any[] = [];
          const render = (enemy: any, d: number, phase: string) => {
            const angle = (d * Math.PI) / 4;
            enemy.facing = enemy.aim = angle;
            enemy.state = phase.startsWith('recover')
              ? 'recover'
              : ['windup', 'strike'].includes(phase)
                ? phase
                : 'approach';
            enemy.moving = phase.startsWith('walk') || phase.startsWith('recoverWalk');
            enemy.staggerTime = phase === 'hurt' ? 0.09 : 0;
            scene.feedback.reset();
            scene.motionClock.reset();
            scene.poseTransition.reset();
            scene.animationTime += 1;
            if (phase.endsWith('1'))
              scene.motionClock.sample(
                String(enemy.id),
                enemy.x - Math.cos(angle) * 43,
                enemy.y - Math.sin(angle) * 43,
                angle,
                scene.animationTime - 0.1,
                true,
              );
            if (phase === 'hurt')
              scene.feedback.receive(
                [
                  {
                    kind: 'impact',
                    target: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    amount: 1,
                    angle: 0,
                    killed: false,
                  },
                ],
                scene.animationTime,
                false,
              );
            scene.drawEnemy(enemy, phase === 'death' ? 0.05 : undefined);
            const actor = scene.actors.get(String(enemy.id));
            const authored = actor.getData('authoredFrame');
            if (authored) {
              const bar = actor.getData('healthBar');
              const top = actor.y + (authored.bounds.top - authored.footY) * actor.scaleY;
              return {
                id: enemy.id,
                name: enemy.role ?? enemy.bossId,
                d,
                phase,
                texture: actor.texture.key,
                frame: actor.frame.name,
                height: actor.displayHeight,
                unit: actor.scaleY,
                target: actor.getData('scaleTarget'),
                basis: 'source-pixels',
                measuredScalp: undefined,
                bar,
                gap: bar ? top - bar.y - bar.height : undefined,
                finite: [actor.x, actor.y, actor.scaleX, actor.scaleY].every(Number.isFinite),
                top,
              };
            }
            const mesh = scene.continuousActors.get(String(enemy.id)).mesh;
            const frames = [...scene.directionFrames.values(), ...scene.motionFrames.values()];
            const source =
              frames
                .map((map: any) => map.get(actor.frame.name))
                .find((f: any) => f?.texture === actor.texture.key) ??
              scene.cavalryFrames.get(Number(actor.frame.name));
            if (!source) throw Error(`Missing source ${actor.texture.key}/${actor.frame.name}`);
            const unit =
              actor.getData('scaleBasis') === 'scalp' ? source.skullUnit : source.bodyUnit;
            const plate = actor.texture.key.startsWith('region-direction-4')
              ? '/art/hostile-consistency-v3/region-4-directions.webp'
              : actor.texture.key.startsWith('region-motion-4')
                ? '/art/animation-rebuild-v2/region-4.webp'
                : actor.texture.key.startsWith('region-rear-4')
                  ? '/art/hostile-consistency-v3/region-4-rear.webp'
                  : actor.texture.key.startsWith('hostile-identity-directions')
                    ? '/art/hostile-consistency-v3/identity-directions.webp'
                    : actor.texture.key.startsWith('hostile-identity-actions')
                      ? '/art/animation-rebuild-v2/identity.webp'
                      : actor.texture.key.startsWith('hostile-identity-rear')
                        ? '/art/hostile-consistency-v3/identity-rear.webp'
                        : undefined;
            const measured = measurements.find(
              (m) => m.path === plate && m.frame === actor.frame.name,
            );
            let top = Infinity;
            for (let at = 0; at < mesh.vertices.length; at += 4)
              top = Math.min(
                top,
                mesh.y +
                  mesh.vertices[at] * Math.sin(mesh.rotation) +
                  mesh.vertices[at + 1] * Math.cos(mesh.rotation),
              );
            const bar = actor.getData('healthBar');
            return {
              id: enemy.id,
              name: enemy.role ?? enemy.bossId,
              d,
              phase,
              texture: actor.texture.key,
              frame: actor.frame.name,
              height: actor.displayHeight,
              unit: unit * actor.scaleY,
              target: actor.getData('scaleTarget'),
              basis: actor.getData('scaleBasis'),
              measuredScalp: measured ? measured.skull.span * actor.scaleY : undefined,
              bar,
              gap: bar ? top - bar.y - bar.height : undefined,
              finite: mesh.vertices.every(Number.isFinite),
              top,
            };
          };
          for (const enemy of enemies)
            for (let d = 0; d < 8; d++)
              for (const phase of phases) records.push(render(enemy, d, phase));
          const canvas = scene.game.canvas;
          canvas.dataset.enemyScale = 'true';
          document.body.append(canvas);
          const css = document.createElement('style');
          css.textContent =
            'canvas[data-enemy-scale]{position:fixed!important;inset:0!important;width:1440px!important;height:1800px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
          document.head.append(css);
          scene.game.scale.resize(1440, 1800);
          scene.cameras.main.setZoom(1).centerOn(720, 900).setBackgroundColor('#d9d0b9');
          (window as any).enemyScaleComparison = (phase: string) => {
            for (const child of scene.children.list) child.setVisible(false);
            scene.graphics.clear().setVisible(true);
            for (const [row, enemy] of enemies.entries())
              for (let d = 0; d < 8; d++) {
                const clone = {
                  ...enemy,
                  id: 2000 + row * 8 + d,
                  x: 90 + d * 180,
                  y: 200 + row * 220,
                };
                render(clone, d, phase);
                scene.add.text(clone.x - 65, clone.y + 16, `${enemy.role ?? enemy.bossId} / ${d}`, {
                  fontSize: '13px',
                  color: '#20382d',
                });
              }
          };
          return { renderer: scene.game.renderer.type, records, enemies: enemies.length };
        },
        { region, measurements },
      );
      await mkdir(proof, { recursive: true });
      const prefix = `${proof}/${webgl ? 'webgl' : 'canvas'}-R${region}`;
      await writeFile(`${prefix}.json`, JSON.stringify(result, null, 2));
      for (const phase of ['walk1', 'windup', 'strike']) {
        await page.evaluate((phase) => (window as any).enemyScaleComparison(phase), phase);
        await page
          .locator('canvas[data-enemy-scale]')
          .screenshot({ path: `${prefix}-${phase}.png` });
      }
      expect(result.renderer).toBe(webgl ? 2 : 1);
      expect(errors).toEqual([]);
      for (const r of result.records) {
        expect(r.finite).toBe(true);
        expect(r.unit, `${r.name}/${r.d}/${r.phase}`).toBeCloseTo(r.target, 8);
        if (r.phase === 'death') expect(r.bar).toBeNull();
        else expect(r.gap, `${r.name}/${r.d}/${r.phase}: HP gap`).toBeGreaterThanOrEqual(6.9999);
      }
      for (const id of new Set(result.records.map((r) => r.id))) {
        const rows = result.records.filter((r) => r.id === id);
        const targets = rows.map((r) => r.target);
        expect(Math.max(...targets) / Math.min(...targets)).toBeCloseTo(1, 8);
        const scalps = rows.flatMap((r) =>
          r.measuredScalp === undefined ? [] : [r.measuredScalp],
        );
        if (scalps.length) expect(Math.max(...scalps) / Math.min(...scalps)).toBeLessThan(1.00001);
        const offsets = rows.filter((r) => r.bar).map((r) => r.bar!.y - 300);
        expect(
          Math.max(...offsets) - Math.min(...offsets),
          `${rows[0].name}: stable bar`,
        ).toBeLessThan(5);
      }
    });
