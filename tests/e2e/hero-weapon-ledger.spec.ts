import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
import { PLAYER_VISUAL_SCALE } from '../../src/game/player-visual';

const directory = process.env.MUGONG_WEAPON_LEDGER_PROOF ?? 'docs/verification/hero-weapon-v4';
for (const renderer of ['Canvas', 'WebGL'])
  for (const batch of [0, 1])
    test(`authored weapon exposures ${renderer} batch ${batch}`, async ({ page }) => {
      test.setTimeout(180000);
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
      await page.setViewportSize({ width: 1280, height: 1160 });
      const actualRenderer = await page.evaluate(async () => {
        const module = (window as any).regionModule;
        const { ContinuousActor } = await module('/src/game/continuous-actor.ts');
        const { heroWeaponPose, HERO_ATTACK_EXPOSURES } = await module(
          '/src/game/hero-weapon-poses.ts',
        );
        const { makeLootItem } = await module('/src/domain/items.ts');
        const { ART_WEAPONS } = await module('/src/domain/content.ts');
        const { gameStore } = await module('/src/platform/store.ts');
        const scene = (window as any).regionScene,
          f = gameStore.state.run.fighter;
        gameStore.paused = true;
        scene.scene.pause();
        for (const child of scene.children.list) child.setVisible(false);
        scene.game.scale.resize(1280, 1160);
        scene.cameras.main.setZoom(1).centerOn(640, 580).setBackgroundColor('#ece2ce');
        const canvas = scene.game.canvas;
        canvas.dataset.weaponLedger = 'true';
        document.body.append(canvas);
        const css = document.createElement('style');
        css.textContent =
          'canvas[data-weapon-ledger]{position:fixed!important;inset:0!important;width:1280px!important;height:1160px!important;max-width:none!important;max-height:none!important;z-index:100000!important;margin:0!important}';
        document.head.append(css);
        const title = scene.add
          .text(15, 8, '', { fontSize: '19px', color: '#132b20' })
          .setDepth(2000);
        for (let frame = 0; frame < 8; frame++)
          scene.add
            .text(
              frame * 160 + 10,
              38,
              `${frame}: ${Math.round(HERO_ATTACK_EXPOSURES[frame] * 1000)}ms`,
              { fontSize: '15px', color: '#132b20' },
            )
            .setDepth(2000);
        const pool = Array.from({ length: 72 }, () => ({
          actor: new ContinuousActor(scene, 'hero-isolated'),
          weapon: scene.add.image(0, 0, 'hero'),
          smear: scene.add.graphics(),
        }));
        (window as any).weaponLedgerAudit = [];
        (window as any).showWeaponLedger = (appearance: number, style: string) => {
          title.setText(
            `Identity ${appearance} / ${style} / E SE S SW W NW N NE + idle / exact recorded poses`,
          );
          const item = makeLootItem(`weapon-${style}-0`, style, 'weapon');
          const id = Object.keys(ART_WEAPONS).find((k) => ART_WEAPONS[k] === style)!;
          f.items = [item];
          f.arts = [{ id, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
          f.bindings = { [id]: item.id };
          f.active = 0;
          f.appearance = appearance;
          for (let row = 0; row < 9; row++)
            for (let frame = 0; frame < 8; frame++) {
              const dir = row === 8 ? frame : row,
                elapsed = HERO_ATTACK_EXPOSURES[frame];
              const copy = pool[row * 8 + frame];
              scene.motionClock.reset();
              scene.poseTransition.reset();
              scene.feedback.reset();
              scene.animationTime += 1;
              f.action = row === 8 ? 'idle' : 'attack';
              f.actionTime = row === 8 ? 0 : 0.28 - elapsed;
              f.x = 640;
              f.y = 500;
              f.facing = (dir * Math.PI) / 4;
              scene.drawHero(f, false);
              const source = scene.continuousActors.get('hero').mesh,
                body = scene.actors.get('hero'),
                weapon = scene.heldWeapon.image;
              const expected = heroWeaponPose(
                appearance,
                style,
                dir,
                row === 8 ? 'direction' : 'attack',
                frame,
              );
              const axis = style === 'fan' ? -Math.PI / 2 : Math.PI / 2;
              const angleError = Math.atan2(
                Math.sin(weapon.rotation + axis - body.rotation - expected.angle),
                Math.cos(weapon.rotation + axis - body.rotation - expected.angle),
              );
              const layerError = weapon.depth - body.depth - expected.layer * 0.1;
              (window as any).weaponLedgerAudit.push({
                appearance,
                style,
                dir,
                frame,
                idle: row === 8,
                angleError,
                layerError,
                length: weapon.getData('bladeLengthScale'),
                pose: weapon.getData('authoredPose'),
                smear: weapon.getData('smearSegments'),
                source: body.texture.key,
                height: body.displayHeight,
                opacity: weapon.alpha,
                spread: expected.spread,
              });
              const x = frame * 160 + 78,
                y = row * 120 + 165;
              copy.actor.mesh.setTexture(source.texture.key);
              copy.actor.mesh.vertices.splice(0, source.vertices.length, ...source.vertices);
              copy.actor.mesh
                .setPosition(x + source.x - f.x, y + source.y - f.y)
                .setRotation(source.rotation)
                .setDepth(y)
                .setVisible(true);
              copy.weapon
                .setTexture(weapon.texture.key, weapon.frame.name)
                .setOrigin(weapon.originX, weapon.originY)
                .setScale(weapon.scaleX, weapon.scaleY)
                .setPosition(x + weapon.x - f.x, y + weapon.y - f.y)
                .setRotation(weapon.rotation)
                .setAlpha(weapon.alpha)
                .setDepth(y + weapon.depth - body.depth)
                .setVisible(weapon.visible);
              copy.smear.clear().setDepth(copy.weapon.depth - 0.02);
              for (const ribbon of weapon.getData('bladeRibbons') ?? []) {
                copy.smear.fillStyle(style === 'dao' ? 0xffe6b2 : 0xf5f6ee, ribbon.alpha);
                copy.smear.fillPoints(
                  ribbon.points.map((p: any) => ({ x: p.x + x - f.x, y: p.y + y - f.y })),
                  true,
                );
              }
            }
          scene.continuousActors.get('hero').hide();
          scene.heldWeapon.image.setVisible(false);
          scene.heldWeapon.smear.setVisible(false);
        };
        return scene.game.renderer.type;
      });
      expect(actualRenderer).toBe(renderer === 'Canvas' ? 1 : 2);
      await mkdir(`${directory}/${renderer.toLowerCase()}`, { recursive: true });
      for (let appearance = batch * 5; appearance < batch * 5 + 5; appearance++)
        for (const style of ['sword', 'dao', 'staff', 'fan', 'dart', 'gauntlet']) {
          await page.evaluate(
            ({ appearance, style }) => (window as any).showWeaponLedger(appearance, style),
            { appearance, style },
          );
          await page.waitForTimeout(50);
          await page.locator('canvas[data-weapon-ledger]').screenshot({
            path: `${directory}/${renderer.toLowerCase()}/${appearance}-${style}.png`,
          });
        }
      const audit: any[] = await page.evaluate(() => (window as any).weaponLedgerAudit);
      await writeFile(
        `${directory}/${renderer.toLowerCase()}-${batch}.json`,
        JSON.stringify({ audit, errors }, null, 2),
      );
      expect(audit).toHaveLength(2160);
      for (const p of audit) {
        expect(Math.abs(p.angleError)).toBeLessThan(1e-7);
        expect(Math.abs(p.layerError)).toBeLessThan(1e-7);
        expect(p.length).toBe(1);
        expect(p.pose).toBeTruthy();
        if (p.appearance === 6 && (p.idle || p.frame === 7))
          expect(p.height).toBeCloseTo(110 * PLAYER_VISUAL_SCALE, 4);
        if (p.style === 'dart' && !p.idle && [4, 5].includes(p.frame)) expect(p.opacity).toBe(0);
        if (p.style === 'fan' && !p.idle && p.frame <= 1) expect(p.spread).toBe(0.55);
        if (p.idle || ![2, 3].includes(p.frame) || !['sword', 'dao'].includes(p.style))
          expect(p.smear).toBe(0);
      }
      expect(errors).toEqual([]);
      await writeFile(
        `${directory}/${renderer.toLowerCase()}-${batch}.json`,
        JSON.stringify({ audit, errors }, null, 2),
      );
    });
