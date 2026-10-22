import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import type { Fighter } from '../../src/domain/model';
import { PLAYER_VISUAL_SCALE } from '../../src/game/player-visual';
const proof = process.env.MUGONG_SIZE_PROOF ?? 'docs/verification/player-size-v1';
const baselineProof = process.env.MUGONG_SIZE_BASELINE ?? proof;
const stage = process.env.MUGONG_SIZE_STAGE ?? 'after';
for (const renderer of ['Canvas', 'WebGL'])
  for (const batch of [0, 1]) {
    test(`player visual size ${renderer} batch ${batch}`, async ({ page }) => {
      test.setTimeout(120000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (renderer === 'WebGL')
        await page.addInitScript(() => {
          for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
            const get = proto.getExtension;
            proto.getExtension = function (name: string) {
              return name === 'WEBGL_debug_renderer_info' ? null : get.call(this, name);
            };
          }
        });
      await seedRegion(page, 6, true, (batch * 5) as Fighter['appearance'], [
        'trapper',
        'guard',
        'crossbow',
      ]);
      await observeScene(page);
      const report = await page.evaluate(async (batch) => {
        const load = (window as any).regionModule;
        const { gameStore } = await load('/src/platform/store.ts');
        const { makeLootItem } = await load('/src/domain/items.ts');
        const { ART_WEAPONS } = await load('/src/domain/content.ts');
        const scene = (window as any).regionScene,
          f = gameStore.state.run.fighter;
        gameStore.paused = true;
        scene.scene.pause();
        const records: any[] = [];
        const appearances: (number | undefined)[] = Array.from(
          { length: 5 },
          (_, n) => batch * 5 + n,
        );
        if (batch === 0) appearances.push(undefined);
        const phases = [
          ['idle', 0],
          ['walk', 0.1],
          ...[0, 0.025, 0.055, 0.085, 0.11, 0.16, 0.21, 0.255].map((t) => ['attack', t]),
          ['ultimate', 0.24],
          ['defense', 0.1],
          ['hurt', 0.05],
          ['death', 0.1],
        ] as const;
        for (const appearance of appearances)
          for (const style of ['sword', 'dao', 'staff', 'fan', 'dart', 'gauntlet']) {
            const item = makeLootItem(`weapon-${style}-0`, style, 'weapon');
            const art = Object.keys(ART_WEAPONS).find((key) => ART_WEAPONS[key] === style)!;
            f.appearance = appearance;
            f.items = [item];
            f.arts = [{ id: art, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
            f.bindings = { [art]: item.id };
            f.active = 0;
            for (let dir = 0; dir < 8; dir++)
              for (const reduced of [false, true])
                for (const [action, time] of phases) {
                  scene.feedback.reset();
                  scene.motionClock.reset();
                  scene.poseTransition.reset();
                  scene.heroDeathAt = -1;
                  scene.reducedMotion = reduced;
                  scene.animationTime = 100 + Number(time);
                  f.x = 960;
                  f.y = 520;
                  f.facing = (dir * Math.PI) / 4;
                  f.action = action === 'hurt' || action === 'death' ? 'idle' : action;
                  f.actionTime =
                    Math.max(
                      0,
                      ({ attack: 0.28, ultimate: 0.6, defense: 0.3 } as any)[action] - Number(time),
                    ) || 0;
                  if (action === 'hurt')
                    scene.feedback.impacts.set('hero', { born: 100, angle: f.facing });
                  scene.graphics.clear();
                  scene.drawHero(f, action === 'death');
                  const body = scene.actors.get('hero'),
                    weapon = scene.heldWeapon.image;
                  records.push({
                    key: [appearance ?? 'legacy', style, dir, reduced, action, time].join('/'),
                    source: `${body.texture.key}/${body.frame.name}`,
                    width: body.displayWidth,
                    height: body.displayHeight,
                    origin: [body.originX, body.originY],
                    flip: body.flipX,
                    rotation: body.rotation,
                    weaponWidth: weapon.visible ? weapon.displayWidth : null,
                    weaponHeight: weapon.visible ? weapon.displayHeight : null,
                    weaponOffset: weapon.visible ? [weapon.x - body.x, weapon.y - body.y] : null,
                    weaponRotation: weapon.visible ? weapon.rotation : null,
                  });
                }
          }
        // Restore a representative live-arena pose for before/after comparison.
        scene.feedback.reset();
        scene.motionClock.reset();
        scene.poseTransition.reset();
        f.appearance = batch * 5 + 1;
        f.action = 'idle';
        f.actionTime = 0;
        f.facing = Math.PI / 2;
        scene.reducedMotion = false;
        scene.graphics.clear();
        scene.drawHero(f, false);
        return { renderer: scene.game.renderer.type, records };
      }, batch);
      expect(report.renderer).toBe(renderer === 'Canvas' ? 1 : 2);
      expect(errors).toEqual([]);
      await mkdir(proof, { recursive: true });
      const file = `${renderer.toLowerCase()}-${batch}`;
      if (stage === 'after') {
        const baseline = JSON.parse(await readFile(`${baselineProof}/before-${file}.json`, 'utf8'));
        expect(report.records).toHaveLength(baseline.records.length);
        const failures: any[] = [];
        const near = (a: number, b: number) => Number.isFinite(a + b) && Math.abs(a - b) < 1e-7;
        for (let n = 0; n < report.records.length; n++) {
          const actual = report.records[n],
            old = baseline.records[n];
          const problems = [];
          if (actual.key !== old.key || actual.source !== old.source) problems.push('source');
          if (
            !near(actual.width / old.width, PLAYER_VISUAL_SCALE) ||
            !near(actual.height / old.height, PLAYER_VISUAL_SCALE)
          )
            problems.push('body scale');
          if (
            JSON.stringify(actual.origin) !== JSON.stringify(old.origin) ||
            actual.flip !== old.flip
          )
            problems.push('foot/orientation');
          if ((actual.weaponWidth === null) !== (old.weaponWidth === null))
            problems.push('weapon visibility');
          if (actual.weaponWidth !== null) {
            if (
              !near(actual.weaponWidth / old.weaponWidth, PLAYER_VISUAL_SCALE) ||
              !near(actual.weaponHeight! / old.weaponHeight, PLAYER_VISUAL_SCALE)
            )
              problems.push('weapon scale');
            if (!near(actual.weaponRotation!, old.weaponRotation)) problems.push('weapon angle');
            for (let axis = 0; axis < 2; axis++)
              if (!near(actual.weaponOffset![axis], old.weaponOffset[axis] * PLAYER_VISUAL_SCALE))
                problems.push(`hand axis ${axis}`);
          }
          if (problems.length && failures.length < 30)
            failures.push({ key: actual.key, problems, actual, old });
        }
        expect(failures).toEqual([]);
      }
      await page.waitForTimeout(80);
      await page.screenshot({ path: `${proof}/${stage}-${file}.png` });
      await writeFile(
        `${proof}/${stage}-${file}.json`,
        JSON.stringify({ ...report, errors }, null, 2),
      );
    });
  }
