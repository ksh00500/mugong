import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = process.env.MUGONG_ZHUGE_PROOF ?? 'docs/verification/zhuge-family-v1';
for (const webgl of [false, true])
  for (const reduced of [false, true])
    test(`${webgl ? 'WebGL' : 'Canvas'} all Zhuge identities, directions and ${reduced ? 'reduced' : 'full'} motion`, async ({
      page,
    }) => {
      test.setTimeout(180000);
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
      await seedRegion(page, 9, true, undefined, ['engineer', 'gatekeeper', 'crossbow']);
      await observeScene(page);
      const result = await page.evaluate(async () => {
        const load = (window as any).regionModule;
        const { gameStore } = await load('/src/platform/store.ts');
        const { enemyAttack, STRIKE_TIMING } = await load('/src/domain/combat.ts');
        const { authoredEnemyArt } = await load('/src/game/authored-enemy.ts');
        const scene = (window as any).regionScene;
        gameStore.paused = true;
        scene.scene.pause();
        const base = gameStore.state.run.enemies[0];
        const { bossHealthClearance } = await (window as any).regionModule('/src/game/boss-special.ts');
        const identities = [
          { kind: 'archer', role: 'engineer' },
          { kind: 'spear', role: 'gatekeeper' },
          { kind: 'archer', role: 'crossbow' },
          ...[1, 2, 3, 4].map((n) => ({ kind: 'chief', bossId: `9-${n}` })),
        ];
        const phases = ['idle', 'walk', 'windup', 'strike', 'recover', 'hurt', 'death'];
        const records: any[] = [],
          contacts: any[] = [],
          tops = new Map<string, number>();
        const render = (
          slot: number,
          d: number,
          phase: string,
          p: number,
          x = 300,
          y = 300,
          impact = false,
          move?: string,
        ) => {
          const e = {
            ...base,
            role: undefined,
            bossId: undefined,
            ...identities[slot],
            id: 6000 + slot * 100 + d,
            x,
            y,
            facing: (d * Math.PI) / 4,
            aim: (d * Math.PI) / 4,
            state: ['windup', 'strike', 'recover'].includes(phase) ? phase : 'approach',
            moving: phase === 'walk',
            staggerTime: phase === 'hurt' || impact ? 0.12 : 0,
            strike: undefined,
            move,
            pattern: 0,
            hp: 75,
            maxHp: 100,
          };
          const profile = enemyAttack(e),
            duration =
              profile.melee?.duration ??
              (profile.ranged || profile.move === 'hazard' ? 0.18 : STRIKE_TIMING.duration);
          e.timer =
            (phase === 'windup'
              ? profile.windup
              : phase === 'recover'
                ? profile.recovery
                : duration) *
            (1 - p);
          if (phase === 'strike')
            e.strike = {
              fromX: x,
              fromY: y,
              toX: x,
              toY: y,
              duration,
              damage: 1,
              hit: false,
            } as any;
          scene.motionClock.reset();
          scene.feedback.reset();
          scene.animationTime += 1;
          if (phase === 'walk')
            scene.motionClock.sample(
              String(e.id),
              x - Math.cos(e.facing) * p * 84,
              y - Math.sin(e.facing) * p * 84,
              e.facing,
              scene.animationTime - 0.1,
              true,
            );
          if (phase === 'hurt' || impact)
            scene.feedback.receive(
              [{ kind: 'impact', target: e.id, x, y, amount: 1, angle: 0, killed: false }],
              scene.animationTime - 0.06,
              false,
            );
          scene.drawEnemy(e, phase === 'death' ? 0.05 : undefined);
          const actor = scene.actors.get(String(e.id)),
            f = actor.getData('authoredFrame'),
            bar = actor.getData('healthBar'),
            key = f.texture + '/' + f.name;
          if (!tops.has(key)) {
            const canvas = document.createElement('canvas');
            canvas.width = f.width;
            canvas.height = f.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
            ctx.drawImage(
              scene.textures.get(f.texture).source[0].image,
              f.x,
              f.y,
              f.width,
              f.height,
              0,
              0,
              f.width,
              f.height,
            );
            const rgba = ctx.getImageData(0, 0, f.width, f.height).data;
            let top = Infinity;
            for (let i = 3; i < rgba.length; i += 4)
              if (rgba[i] >= 128) top = Math.min(top, Math.floor((i - 3) / 4 / f.width));
            tops.set(key, top);
          }
          const art = authoredEnemyArt(e, 9);
          return {
            slot,
            d,
            phase,
            p,
            identity: actor.getData('authoredIdentity'),
            texture: f.texture,
            pose: f.pose,
            kind: f.kind,
            action: actor.getData('motionAction'),
            view: actor.getData('view'),
            flip: actor.flipX,
            scale: actor.scaleX,
            scaleY: actor.scaleY,
            mesh: scene.continuousActors.get(String(e.id))?.mesh.visible ?? false,
            gap: bar
              ? actor.y + (tops.get(key)! - f.footY) * actor.scaleY - bar.y - bar.height
              : null,
            barY: bar?.y ?? null,
            expectedBarY: y - ((bossHealthClearance(e, 9, art.healthClearance) - 12) * (e.bossId ? 1.2 : 1) + 12),
          };
        };
        for (let slot = 0; slot < 7; slot++)
          for (let d = 0; d < 8; d++)
            for (const phase of phases)
              for (const p of [0, 0.2, 0.35, 0.65, 0.95]) records.push(render(slot, d, phase, p));
        const moves = [
          ['thrust', 'sweep', 'stance', 'combo'],
          ['fan', 'combo', 'stance', 'thrust'],
          ['thrust', 'combo', 'sweep', 'dash', 'stance'],
          ['stance', 'fan', 'hazard', 'combo', 'sweep'],
        ];
        for (let n = 0; n < 4; n++)
          for (const move of moves[n]) {
            const profile = enemyAttack({
              ...base,
              kind: 'chief',
              bossId: `9-${n + 1}`,
              move,
              pattern: 0,
            });
            for (const contact of profile.melee.contacts)
              for (let d = 0; d < 8; d++)
                contacts.push(
                  render(
                    n + 3,
                    d,
                    'strike',
                    contact / profile.melee.duration,
                    300,
                    300,
                    true,
                    move,
                  ),
                );
          }
        const canvas = scene.game.canvas;
        canvas.dataset.familyReview = 'true';
        document.body.append(canvas);
        const css = document.createElement('style');
        css.textContent =
          'canvas[data-family-review]{position:fixed!important;inset:0!important;width:1440px!important;height:1120px!important;z-index:100000!important;margin:0!important}';
        document.head.append(css);
        scene.game.scale.resize(1440, 1120);
        scene.cameras.main.setZoom(1).centerOn(720, 560).setBackgroundColor('#e5dfcd');
        (window as any).familyComparison = (phase: string) => {
          for (const child of scene.children.list) child.setVisible(false);
          scene.graphics.clear().setVisible(true);
          for (let slot = 0; slot < 7; slot++)
            for (let d = 0; d < 8; d++) {
              const x = 100 + d * 172,
                y = 145 + slot * 150;
              const profile = enemyAttack({ ...base, ...identities[slot], pattern: 0 });
              const p =
                phase === 'strike' && profile.melee
                  ? profile.melee.contacts[0] / profile.melee.duration
                  : phase === 'strike'
                    ? 0
                    : phase === 'walk'
                      ? 0.5
                      : 0.35;
              render(slot, d, phase, p, x, y);
              scene.add.text(
                x - 60,
                y + 16,
                `${['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'][d]} / ${slot}`,
                { fontSize: '13px', color: '#20382d' },
              );
            }
        };
        return {
          records,
          contacts,
          renderer: scene.game.renderer.type,
          reduced: scene.reducedMotion,
        };
      });
      expect(result.renderer).toBe(webgl ? 2 : 1);
      expect(result.reduced).toBe(reduced);
      expect(new Set(result.records.map((r) => r.identity)).size).toBe(7);
      for (const r of result.records) {
        expect(r.scale).toBe(r.slot >= 3 ? 0.225 * 1.2 : 0.225);
        expect(r.scaleY).toBe(r.slot >= 3 ? 0.225 * 1.2 : 0.225);
        expect(r.mesh).toBe(false);
        expect(r.view).toBe([2, 1, 0, 1, 2, 3, 4, 3][r.d]);
        expect(r.flip).toBe([false, false, false, true, true, true, false, false][r.d]);
        if (r.phase === 'death') expect(r.barY).toBeNull();
        else {
          expect(r.gap).toBeGreaterThanOrEqual(7);
          expect(r.barY).toBeCloseTo(r.expectedBarY, 8);
        }
        if (r.slot >= 3 && r.phase === 'hurt') expect(r.action).toBe('idle');
      }
      for (const r of result.contacts) {
        expect(r.action).toBe('strike');
        expect(r.kind).toBe('combat');
        expect(r.pose).toBe(2);
      }
      expect(errors).toEqual([]);
      await mkdir(proof, { recursive: true });
      const prefix = `${proof}/${webgl ? 'webgl' : 'canvas'}-${reduced ? 'reduced' : 'full'}`;
      await writeFile(prefix + '.json', JSON.stringify({ ...result, errors }, null, 2));
      for (const phase of ['walk', 'windup', 'strike', 'recover']) {
        await page.evaluate((phase) => (window as any).familyComparison(phase), phase);
        await page
          .locator('canvas[data-family-review]')
          .screenshot({ path: prefix + '-' + phase + '.png' });
      }
    });
