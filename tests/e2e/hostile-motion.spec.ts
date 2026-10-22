import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

for (const software of [false, true])
  for (const region of [3, 4, 7, 9])
    test(`지역 ${region} 적 공격·피격 동작 연속 영상 ${software ? 'Canvas' : 'WebGL'}`, async ({
      browser,
    }) => {
      test.setTimeout(180000);
      const proof = `${process.env.MUGONG_MOTION_PROOF ?? 'docs/verification/hostile-consistency-v3/motion'}/region-${region}`;
      await mkdir(proof, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        recordVideo: { dir: proof, size: { width: 1440, height: 900 } },
      });
      const page = await context.newPage();
      if (software)
        await page.addInitScript(() => {
          const get = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            type: string,
            ...args: any[]
          ) {
            if (/webgl/.test(type)) return null;
            return get.call(this, type as any, ...(args as any));
          } as typeof get;
        });
      else
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
      await expect(page.locator('.game-canvas')).toHaveAttribute(
        'data-renderer',
        software ? 'Canvas' : 'WebGL / AUTO',
      );
      await page.evaluate(async (region) => {
        const load = (window as any).regionModule;
        const { gameStore: store } = await load('/src/platform/store.ts');
        const { ROLE_PROFILES, REGION_ROSTERS } = await load('/src/domain/region-enemies.ts');
        const { REGIONS } = await load('/src/domain/campaign.ts');
        store.paused = true;
        (window as any).regionScene.scene.pause();
        const r = store.state.run;
        const base = r.enemies[0];
        r.enemies = [...new Set<string>(REGION_ROSTERS[REGIONS[region].name])].map((role, i) => ({
          ...base,
          id: 900 + i,
          role,
          bossId: undefined,
          kind: ROLE_PROFILES[role].kind,
          x: 300 + (i % 4) * 420,
          y: i < 4 ? 370 : 700,
          hp: 1000,
          maxHp: 1000,
          aim: 0.6,
          facing: 0.6,
        }));
        for (let phase = 1; phase <= 4; phase++) {
          const i = r.enemies.length;
          r.enemies.push({
            ...base,
            id: 900 + i,
            role: undefined,
            kind: 'chief',
            bossId: `${region}-${phase}`,
            hp: 1000,
            maxHp: 1000,
            x: 300 + (i % 4) * 420,
            y: i < 4 ? 370 : 700,
            aim: 0.6,
            facing: 0.6,
          });
        }
        const label = document.createElement('div');
        label.id = 'motion-review-label';
        label.style.cssText =
          'position:fixed;top:110px;left:20px;background:#142b20;color:#fff;padding:6px;z-index:500';
        document.body.append(label);
      }, region);
      for (const direction of [1, 6, 7]) {
        await page.evaluate((direction) => {
          for (const e of (window as any).regionScene.actors.values()) e.setAlpha(1);
          (window as any).reviewDirection = direction;
        }, direction);
        for (const stage of ['windup', 'strike', 'recover', 'hurt', 'death']) {
          for (let frame = 0; frame < 5; frame++) {
            await page.evaluate(
              async ({ stage, frame }) => {
                const { gameStore: store } = await (window as any).regionModule(
                  '/src/platform/store.ts',
                );
                const { enemyAttack } = await (window as any).regionModule('/src/domain/combat.ts');
                const scene = (window as any).regionScene,
                  r = store.state.run;
                document.getElementById('motion-review-label')!.textContent =
                  `방향 ${(window as any).reviewDirection} · ${stage} · ${frame + 1}/5`;
                scene.animationTime += 0.025;
                scene.feedback.reset();
                for (const e of r.enemies) {
                  const progress = frame / 4;
                  e.state = stage === 'hurt' || stage === 'death' ? 'recover' : stage;
                  e.aim = e.facing = ((window as any).reviewDirection * Math.PI) / 4;
                  e.moving = stage === 'recover';
                  e.staggerTime = stage === 'hurt' ? 0.09 : 0;
                  const duration = enemyAttack(e).melee?.duration ?? 0.28;
                  e.strike =
                    stage === 'strike'
                      ? {
                          fromX: e.x,
                          fromY: e.y,
                          toX: e.x,
                          toY: e.y,
                          duration,
                          damage: 1,
                          hit: false,
                        }
                      : undefined;
                  e.timer =
                    (1 - progress) *
                    (stage === 'windup'
                      ? enemyAttack(e).windup
                      : stage === 'recover'
                        ? enemyAttack(e).recovery
                        : duration);
                  if (stage === 'hurt')
                    scene.feedback.receive(
                      [
                        {
                          kind: 'impact',
                          target: e.id,
                          x: e.x,
                          y: e.y,
                          amount: 1,
                          angle: Math.PI,
                          killed: false,
                        },
                      ],
                      scene.animationTime - progress * 0.199,
                      false,
                    );
                }
                scene.draw(r);
                if (stage === 'death')
                  for (const e of r.enemies) scene.drawEnemy(e, (frame / 4) * 0.3);
              },
              { stage, frame },
            );
            await page.waitForTimeout(35);
            if (frame === 2)
              await page.screenshot({
                path: `${proof}/${software ? 'canvas' : 'webgl'}-d${direction}-${stage}-mid.png`,
              });
          }
        }
      }
      expect(errors).toEqual([]);
      const video = page.video()!;
      await context.close();
      await video.saveAs(`${proof}/${software ? 'canvas' : 'webgl'}-actions.webm`);
    });
