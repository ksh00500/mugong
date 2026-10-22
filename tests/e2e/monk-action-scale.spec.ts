import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import measurements from '../../docs/verification/monk-scale-v2/source-measurements.json' with { type: 'json' };

test.use({ viewport: { width: 1400, height: 1200 } });
for (const webgl of [false, true])
  test(`${webgl ? 'WebGL' : 'Canvas'} monk bodies keep scale across combat transitions`, async ({
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
      gameStore.paused = true;
      scene.scene.pause();
      scene.feedback.reset();
      const base = gameStore.state.run.enemies[0];
      const enemies = Array.from({ length: 7 }, (_, slot) => ({
        ...base,
        id: 800 + slot,
        kind: slot < 3 ? ['sword', 'spear', 'archer'][slot] : 'chief',
        role: undefined,
        bossId: slot < 3 ? undefined : `4-${slot - 2}`,
        x: 100 + slot * 180,
        y: 300,
        staggerTime: 0,
        timer: 0.15,
        speed: 80,
        strike: undefined,
      }));
      const paths: Record<string, string> = {
        'region-direction-4-isolated': '/art/hostile-consistency-v3/region-4-directions.webp',
        'region-motion-4-isolated': '/art/animation-rebuild-v2/region-4.webp',
        'region-rear-4-isolated': '/art/hostile-consistency-v3/region-4-rear.webp',
        'hostile-identity-directions-isolated':
          '/art/hostile-consistency-v3/identity-directions.webp',
        'hostile-identity-actions-isolated': '/art/animation-rebuild-v2/identity.webp',
        'hostile-identity-rear-isolated': '/art/hostile-consistency-v3/identity-rear.webp',
      };
      const phases = ['walk', 'windup', 'strike', 'recover', 'hurt', 'death'];
      const records: any[] = [];
      const render = (enemy: any, d: number, phase: string) => {
        enemy.facing = enemy.aim = (d * Math.PI) / 4;
        enemy.state = ['walk', 'hurt', 'death'].includes(phase) ? 'approach' : phase;
        enemy.moving = phase === 'walk';
        enemy.staggerTime = phase === 'hurt' ? 0.09 : 0;
        scene.feedback.reset();
        scene.motionClock.reset();
        scene.poseTransition.reset();
        scene.animationTime += 1;
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
        if (phase === 'walk') {
          enemy.x += 3;
          scene.animationTime += 0.15;
          scene.drawEnemy(enemy);
          enemy.x -= 3;
        }
        const actor = scene.actors.get(String(enemy.id));
        if (actor.getData('authoredFrame'))
          return {
            id: enemy.id,
            d,
            phase,
            texture: actor.texture.key,
            frame: actor.frame.name,
            height: actor.displayHeight,
            sourceScale: actor.scaleY,
            headWidth: null,
          };
        const m = measurements.find(
          (m) => m.path === paths[actor.texture.key] && m.frame === actor.frame.name,
        );
        if (!m) throw Error(`Unmeasured ${actor.texture.key}/${actor.frame.name}`);
        const mesh = scene.continuousActors.get(String(enemy.id)).mesh;
        if (!mesh.vertices.every(Number.isFinite)) throw Error('Invalid mesh');
        return {
          id: enemy.id,
          d,
          phase,
          texture: actor.texture.key,
          frame: actor.frame.name,
          height: actor.displayHeight,
          headWidth: (m.skull.span * actor.displayHeight) / actor.frame.cutHeight,
        };
      };
      for (const enemy of enemies)
        for (let d = 0; d < 8; d++)
          for (const phase of phases) records.push(render(enemy, d, phase));
      const canvas = scene.game.canvas;
      canvas.dataset.monkAction = 'true';
      document.body.append(canvas);
      const css = document.createElement('style');
      css.textContent =
        'canvas[data-monk-action]{position:fixed!important;inset:0!important;width:1400px!important;height:1200px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
      document.head.append(css);
      scene.game.scale.resize(1400, 1200);
      scene.cameras.main.setZoom(1).centerOn(700, 600).setBackgroundColor('#637267');
      (window as any).monkComparison = (d: number) => {
        for (const child of scene.children.list) child.setVisible(false);
        for (const [row, enemy] of enemies.entries())
          for (const [col, phase] of phases.entries()) {
            const clone = {
              ...enemy,
              id: 1000 + row * 6 + col,
              x: 110 + col * 230,
              y: 135 + row * 160,
            };
            render(clone, d, phase);
            scene.add.text(clone.x - 85, clone.y + 25, `${row}: ${phase}`, {
              fontSize: '17px',
              color: '#fff',
            });
          }
      };
      (window as any).monkMovie = (index: number) => {
        if (index === 0) {
          for (const child of scene.children.list) child.setVisible(false);
          scene.feedback.reset();
          scene.motionClock.reset();
          scene.poseTransition.reset();
        }
        scene.animationTime += 0.08;
        const phase = ['walk', 'windup', 'strike', 'recover'][Math.floor(index / 4)];
        for (const [row, d] of [2, 6].entries())
          for (const [slot, source] of enemies.entries()) {
            const enemy = {
              ...source,
              id: 2000 + row * 7 + slot,
              x: 100 + slot * 200,
              y: 155 + row * 180 + (row === 0 ? 1 : -1) * Math.min(index, 3) * 2,
              state: phase === 'walk' ? 'approach' : phase,
              moving: phase === 'walk',
              staggerTime: 0,
              timer: 0.32 - (index % 4) * 0.07,
              aim: (d * Math.PI) / 4,
              facing: (d * Math.PI) / 4,
            };
            scene.drawEnemy(enemy);
            if (index === 0)
              scene.add.text(
                enemy.x - 65,
                enemy.y + 35,
                `${slot} / ${d === 2 ? 'front' : 'rear'}`,
                { fontSize: '16px', color: '#fff' },
              );
            const mesh = scene.continuousActors.get(String(enemy.id))?.mesh;
            const actor = scene.actors.get(String(enemy.id));
            if (
              mesh
                ? !mesh.vertices.every(Number.isFinite)
                : ![actor.x, actor.y, actor.scaleX].every(Number.isFinite)
            )
              throw Error('Invalid transition geometry');
          }
      };
      return { records, renderer: scene.game.renderer.type };
    }, measurements);
    expect(result.renderer).toBe(webgl ? 2 : 1);
    expect(errors).toEqual([]);
    const root = 'docs/verification/enemy-scale-health-v3/actions';
    await mkdir(root, { recursive: true });
    await writeFile(`${root}/${webgl ? 'webgl' : 'canvas'}.json`, JSON.stringify(result, null, 2));
    for (const d of [2, 6, 0, 5]) {
      await page.evaluate((d) => (window as any).monkComparison(d), d);
      await page
        .locator('canvas[data-monk-action]')
        .screenshot({ path: `${root}/${webgl ? 'webgl' : 'canvas'}-D${d}.png` });
    }
    for (let slot = 0; slot < 7; slot++)
      for (let d = 0; d < 8; d++) {
        const subset = result.records.filter((r) => r.id === 800 + slot && r.d === d);
        const walk = subset.find((r) => r.phase === 'walk')!;
        for (const r of subset) {
          if (r.sourceScale !== undefined) {
            expect(r.sourceScale).toBe(walk.sourceScale);
            continue;
          }
          expect(r.headWidth / walk.headWidth, `${slot}/${d}/${r.phase}`).toBeCloseTo(1, 8);
        }
      }
    for (let i = 0; i < 16; i++) {
      await page.evaluate((i) => (window as any).monkMovie(i), i);
      await page.screenshot({
        path: `${root}/${webgl ? 'sequence' : 'canvas-sequence'}-${String(i).padStart(2, '0')}.png`,
        clip: { x: 0, y: 0, width: 1400, height: 400 },
      });
    }
    if (webgl) {
      await page.evaluate(() => {
        const scene = (window as any).regionScene;
        for (let id = 2000; id < 2014; id++) {
          scene.continuousActors.get(String(id))?.hide();
          scene.actors.get(String(id)).setVisible(true);
        }
      });
      await page.screenshot({
        path: `${root}/source-sprites.png`,
        clip: { x: 0, y: 0, width: 1400, height: 400 },
      });
    }
  });
