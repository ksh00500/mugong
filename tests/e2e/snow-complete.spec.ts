import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/snow-special-complete-v2';
for (const region of [3])
  for (const webgl of [false, true])
    for (const reduced of [false, true])
      test(`${webgl ? 'WebGL' : 'Canvas'} region ${region} installed special poses ${reduced ? 'reduced' : 'full'}`, async ({
        page,
      }) => {
        test.setTimeout(180000);
        await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
        if (webgl)
          await page.addInitScript(() => {
            for (const proto of [
              WebGLRenderingContext.prototype,
              WebGL2RenderingContext.prototype,
            ]) {
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
        const result = await page.evaluate(async (region) => {
          const load = (window as any).regionModule;
          const { gameStore } = await load('/src/platform/store.ts');
          const { enemyAttack } = await load('/src/domain/combat.ts');
          const { SNOW_COMPLETE_ART, bossSpecialArt } = await load('/src/game/boss-special.ts');
          const SNOW_ALL_ART = {
            characters: SNOW_COMPLETE_ART.characters.map((a: any) =>
              bossSpecialArt({ bossId: a.bossId }, 3),
            ),
          };
          const scene = (window as any).regionScene;
          gameStore.paused = true;
          scene.scene.pause();
          const run = gameStore.state.run,
            base = run.enemies[3],
            saved = JSON.stringify(run);
          const failures: any[] = [],
            contacts: any[] = [];
          let count = 0;
          const barHeights = new Map<string, number>();
          const render = (
            art: any,
            move: string,
            d: number,
            action: string,
            p: number,
            x = 400,
            y = 400,
          ) => {
            const e = {
              ...base,
              id: 9000 + Number(art.bossId.split('-')[1]) * 100 + art.moves.indexOf(move) * 8 + d,
              bossId: art.bossId,
              kind: 'chief',
              move,
              x,
              y,
              pattern: 0,
              aim: (d * Math.PI) / 4,
              facing: (d * Math.PI) / 4,
              state: action,
              guardTime: 0,
              moving: false,
              staggerTime: 0.2,
            };
            const profile = enemyAttack(e),
              spec = profile.melee ?? { duration: 0.18, contacts: [0] };
            e.timer =
              (action === 'windup'
                ? profile.windup
                : action === 'recover'
                  ? profile.recovery
                  : spec.duration) *
              (1 - p);
            e.strike =
              action === 'strike'
                ? { duration: spec.duration, fromX: x, fromY: y, toX: x, toY: y }
                : undefined;
            scene.motionClock.reset();
            scene.feedback.reset();
            scene.feedback.receive(
              [{ kind: 'impact', target: e.id, x, y, amount: 1, angle: 0, killed: false }],
              scene.animationTime - 0.06,
              false,
            );
            scene.drawEnemy(e);
            const actor = scene.actors.get(String(e.id)),
              frame = actor.getData('authoredFrame'),
              bar = actor.getData('healthBar'),
              motion = actor.getData('bossMotion');
            count++;
            if (
              !actor.texture.has(frame.name) ||
              actor.frame.name !== frame.name ||
              actor.frame.cutX !== frame.x ||
              actor.frame.cutY !== frame.y ||
              actor.frame.cutWidth !== frame.width ||
              actor.frame.cutHeight !== frame.height ||
              !actor.getData('specialPose') ||
              frame.move !== move ||
              actor.scaleX !== 0.225 ||
              actor.scaleY !== 0.225 ||
              bar.renderedTop - bar.y - bar.height < 7 ||
              actor.rotation !== 0
            )
              failures.push({ boss: art.bossId, move, d, action, p, frame, bar });
            const h = y - bar.y;
            if (barHeights.has(art.bossId) && Math.abs(barHeights.get(art.bossId)! - h) > 0.00001)
              failures.push({ boss: art.bossId, unstableBar: h });
            barHeights.set(art.bossId, h);
            return {
              pose: frame.pose,
              cycle: motion.cycle,
              contact: motion.contact,
              direction: actor.getData('motionDirection'),
              view: frame.view,
              flip: actor.flipX,
            };
          };
          for (const art of SNOW_ALL_ART.characters.filter(
            (a: any) => Number(a.bossId.split('-')[0]) === region,
          ))
            for (const move of art.moves)
              for (let d = 0; d < 8; d++) {
                const spec = enemyAttack({ ...base, bossId: art.bossId, move, pattern: 0 })
                  .melee ?? { duration: 0.18, contacts: [0] };
                for (const action of ['windup', 'strike', 'recover'])
                  for (let n = 0; n <= 12; n++) render(art, move, d, action, n / 12);
                for (const [n, t] of spec.contacts.entries())
                  contacts.push({
                    expected: n,
                    d,
                    ...render(art, move, d, 'strike', t / spec.duration),
                  });
              }
          const unchanged = saved === JSON.stringify(run);
          // A contact plate rendered by the actual Phaser path, at native game scale.
          const canvas = scene.game.canvas;
          canvas.dataset.specialReview = 'true';
          document.body.append(canvas);
          const css = document.createElement('style');
          css.textContent =
            'canvas[data-special-review]{position:fixed!important;inset:0!important;width:1440px!important;height:4000px!important;z-index:100000!important;margin:0!important}';
          document.head.append(css);
          scene.game.scale.resize(1440, 4000);
          scene.cameras.main.setZoom(1).centerOn(720, 2000).setBackgroundColor('#e5dfcd');
          (window as any).specialPlate = (action: string, p: number) => {
            for (const child of scene.children.list) child.setVisible(false);
            scene.graphics.clear().setVisible(true);
            let row = 0;
            for (const art of SNOW_ALL_ART.characters.filter(
              (a: any) => Number(a.bossId.split('-')[0]) === region,
            ))
              for (const move of art.moves) {
                for (let d = 0; d < 8; d++) {
                  const spec = enemyAttack({ ...base, bossId: art.bossId, move, pattern: 0 })
                    .melee ?? { duration: 0.18, contacts: [0] };
                  const x = 100 + d * 172,
                    y = 230 + row * 200;
                  render(
                    art,
                    move,
                    d,
                    action,
                    action === 'strike'
                      ? spec.contacts[Math.min(p >= 1 ? 1 : 0, spec.contacts.length - 1)] /
                          spec.duration
                      : p,
                    x,
                    y,
                  );
                  scene.add.text(
                    x - 55,
                    y + 12,
                    `${art.id} ${move}\n${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][d]}`,
                    { fontSize: '12px', color: '#20382d' },
                  );
                }
                row++;
              }
          };
          return {
            count,
            failures,
            contacts,
            unchanged,
            renderer: scene.game.renderer.type,
            reduced: scene.reducedMotion,
          };
        }, region);
        expect(result.renderer).toBe(webgl ? 2 : 1);
        expect(result.reduced).toBe(reduced);
        expect(result.failures).toEqual([]);
        expect(result.unchanged).toBe(true);
        for (const c of result.contacts) {
          expect(c.pose).toBe(2);
          expect(c.contact).toBe(c.expected);
          expect(c.cycle).toBe(c.expected);
          expect(c.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][c.d]);
          expect(c.flip).toBe([false, false, false, true, true, true, false, false][c.d]);
        }
        expect(errors).toEqual([]);
        await mkdir(proof, { recursive: true });
        const prefix = `${proof}/${region}-${webgl ? 'webgl' : 'canvas'}-${reduced ? 'reduced' : 'full'}`;
        await writeFile(prefix + '.json', JSON.stringify({ ...result, errors }, null, 2));
        for (const [action, p] of [
          ['windup', 0.8],
          ['strike', 0],
          ['recover', 0.25],
        ] as const) {
          await page.evaluate(
            ([action, p]) => (window as any).specialPlate(action, p),
            [action, p],
          );
          await page
            .locator('canvas[data-special-review]')
            .screenshot({ path: prefix + '-' + action + '.png' });
        }
        if (region === 3) {
          await page.evaluate(() => (window as any).specialPlate('strike', 1));
          await page
            .locator('canvas[data-special-review]')
            .screenshot({ path: prefix + '-second-contact.png' });
        }
      });
