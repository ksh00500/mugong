import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';

const directory = process.env.MUGONG_WEAPON_PROOF ?? 'docs/verification/weapon-attachment';
for (const batch of [0, 1])
  test(`weapon source review batch ${batch}`, async ({ page }) => {
    test.setTimeout(120000);
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
    await page.evaluate(async (batch) => {
      const scene = (window as any).regionScene;
      scene.scene.pause();
      const root = document.createElement('div');
      root.id = 'weapon-audit';
      root.style.cssText = 'position:fixed;inset:0;z-index:100000;background:#ece2ce;overflow:auto';
      const canvas = document.createElement('canvas');
      canvas.width = 2800;
      canvas.height = 1200;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ece2ce';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let slot = 0; slot < 5; slot++)
        for (let col = 0; col < 14; col++) {
          const key = col < 8 ? 'hero-roster-directions' : 'hero-roster-actions';
          const n = col < 8 ? col : col - 8;
          const source = scene.motionFrames.get(key).get(`${slot}-${n}`);
          const texture = scene.textures.get(source.texture),
            frame = texture.get(`${slot}-${n}`);
          const x = col * 200,
            y = slot * 240;
          const scale = Math.min(180 / frame.cutWidth, 205 / frame.cutHeight);
          const width = frame.cutWidth * scale,
            height = frame.cutHeight * scale;
          const left = x + (200 - width) / 2,
            top = y + 30 + (205 - height) / 2;
          ctx.drawImage(
            texture.source[0].image,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            left,
            top,
            width,
            height,
          );
          ctx.fillStyle = '#132b20';
          ctx.font = '12px sans-serif';
          ctx.fillText(`${batch * 5 + slot} ${col < 8 ? 'D' : 'A'}${n}`, x + 4, y + 15);
          const { heroGrip } = await (window as any).regionModule('/src/game/hero-grips.ts');
          const hand = heroGrip(batch * 5 + slot, n, col < 8 ? undefined : n);
          ctx.strokeStyle = '#e01038';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(left + hand[0] * width, top + hand[1] * height, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
      root.append(canvas);
      document.body.append(root);
    }, batch);
    await page.setViewportSize({ width: 2800, height: 1200 });
    await mkdir(directory, { recursive: true });
    await page
      .locator('#weapon-audit canvas')
      .screenshot({ path: `${directory}/sources-${batch}.png` });
    if (batch === 0) {
      await page.evaluate(async () => {
        const { SINGLE_WEAPON_FRAMES, WEAPON_GRIPS } = await (window as any).regionModule(
          '/src/game/weapon-grips.ts',
        );
        const scene = (window as any).regionScene,
          canvas = document.querySelector('#weapon-audit canvas') as HTMLCanvasElement;
        const keys = scene.textures
          .getTextureKeys()
          .filter((k: string) => k.startsWith('held-weapon-') || k.startsWith('held-boss-'));
        canvas.width = 1400;
        canvas.height = Math.ceil(keys.length / 10) * 220;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#ece2ce';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        keys.forEach((key: string, i: number) => {
          const id = key.replace('held-', ''),
            single = SINGLE_WEAPON_FRAMES[id];
          const texture = scene.textures.get(single?.texture ?? key),
            frame = texture.get(single?.frame ?? 'held');
          const scale = Math.min(120 / frame.cutWidth, 175 / frame.cutHeight),
            x = (i % 10) * 140,
            y = Math.floor(i / 10) * 220;
          ctx.drawImage(
            texture.source[0].image,
            frame.cutX,
            frame.cutY,
            frame.cutWidth,
            frame.cutHeight,
            x + 10,
            y + 25,
            frame.cutWidth * scale,
            frame.cutHeight * scale,
          );
          ctx.fillStyle = '#132b20';
          ctx.font = '11px sans-serif';
          ctx.fillText(key.replace('held-', ''), x + 3, y + 15);
          const grip = single?.grip ?? WEAPON_GRIPS[id];
          ctx.strokeStyle = '#e01038';
          ctx.beginPath();
          ctx.arc(
            x + 10 + grip[0] * frame.cutWidth * scale,
            y + 25 + grip[1] * frame.cutHeight * scale,
            3,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        });
      });
      await page.locator('#weapon-audit canvas').screenshot({ path: `${directory}/weapons.png` });
    }
  });

for (const renderer of ['Canvas', 'WebGL'] as const)
  for (const batch of [0, 1])
    test(`${renderer}: all heroes, 28 weapon artworks, eight directions and every motion frame (${batch})`, async ({
      page,
    }) => {
      test.setTimeout(300000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      if (renderer === 'WebGL')
        await page.addInitScript(() => {
          for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
            const original = proto.getExtension;
            proto.getExtension = function (name: string) {
              return name === 'WEBGL_debug_renderer_info' ? null : original.call(this, name);
            };
          }
        });
      else
        await page.addInitScript(() => {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (
            this: HTMLCanvasElement,
            name: string,
            options?: any,
          ) {
            return name.includes('webgl') ? null : (original as any).call(this, name, options);
          } as typeof original;
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
      await expect(page.locator('.game-canvas')).toHaveAttribute(
        'data-renderer',
        renderer === 'Canvas' ? 'Canvas' : 'WebGL / AUTO',
      );
      const audit = await page.evaluate(
        async ({ batch }) => {
          const module = (window as any).regionModule;
          const { gameStore } = await module('/src/platform/store.ts');
          const { ITEM_CATALOGUE, makeLootItem } = await module('/src/domain/items.ts');
          const { bossReward } = await module('/src/domain/boss-loot.ts');
          const { ART_WEAPONS } = await module('/src/domain/content.ts');
          const { heroGrip } = await module('/src/game/hero-grips.ts');
          const { heroSlashGrip } = await module('/src/game/hero-slash.ts');
          const scene = (window as any).regionScene,
            f = gameStore.state.run.fighter;
          gameStore.paused = true;
          scene.scene.pause();
          const items = [
            ...ITEM_CATALOGUE.filter((d: any) => d.kind === 'sword').map((d: any) =>
              makeLootItem(d.id, d.id, 'weapon'),
            ),
            ...Array.from({ length: 40 }, (_, i) =>
              bossReward(`${Math.floor(i / 4)}-${(i % 4) + 1}`, `boss-${i}`),
            )
              .filter((i: any) => i.kind === 'sword')
              .map((i: any) => ({ ...i, place: 'weapon' })),
          ];
          const frames = [
            { action: 'idle', times: [0, 0.2, 0.4] },
            { action: 'walk', times: Array.from({ length: 48 }, (_, i) => i / 60) },
            { action: 'attack', times: [...Array.from({ length: 17 }, (_, i) => i / 60), 0.28] },
            { action: 'ultimate', times: Array.from({ length: 37 }, (_, i) => i / 60) },
            { action: 'defense', times: Array.from({ length: 19 }, (_, i) => i / 60) },
            { action: 'hurt', times: [...Array.from({ length: 8 }, (_, i) => i / 60), 0.1299] },
            { action: 'death', times: Array.from({ length: 24 }, (_, i) => i / 60) },
          ];
          const failures: any[] = [],
            rows: any[] = [];
          let count = 0,
            maximumError = 0;
          // Independent oracle: locate the authored source wrist inside the actual UV
          // triangle and interpolate its rendered vertices. Do not call localPoint.
          const renderedWrist = (body: any, mesh: any, hand: readonly number[]) => {
            const frame = body.frame,
              vertices = mesh.vertices;
            const u = frame.u0 + hand[0] * (frame.u1 - frame.u0),
              v = frame.v0 + hand[1] * (frame.v1 - frame.v0);
            for (let i = 0; i < mesh.indices.length; i += 4) {
              const a = mesh.indices[i] * 4,
                b = mesh.indices[i + 1] * 4,
                c = mesh.indices[i + 2] * 4;
              const ax = vertices[a + 2],
                ay = vertices[a + 3],
                bx = vertices[b + 2],
                by = vertices[b + 3],
                cx = vertices[c + 2],
                cy = vertices[c + 3];
              const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
              const wa = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / det;
              const wb = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / det,
                wc = 1 - wa - wb;
              if (Math.min(wa, wb, wc) < -1e-6) continue;
              const x = vertices[a] * wa + vertices[b] * wb + vertices[c] * wc;
              const y = vertices[a + 1] * wa + vertices[b + 1] * wb + vertices[c + 1] * wc;
              return {
                x: mesh.x + x * Math.cos(mesh.rotation) - y * Math.sin(mesh.rotation),
                y: mesh.y + x * Math.sin(mesh.rotation) + y * Math.cos(mesh.rotation),
              };
            }
            throw new Error('Wrist lies outside the rendered UV mesh');
          };
          for (let appearance = batch * 5; appearance < batch * 5 + 5; appearance++) {
            f.appearance = appearance;
            for (const item of items) {
              f.items = [item];
              const id = Object.keys(ART_WEAPONS).find((k) => ART_WEAPONS[k] === item.weaponStyle)!;
              f.arts = [{ id, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
              f.bindings = { [id]: item.id };
              f.active = 0;
              for (let dir = 0; dir < 8; dir++)
                for (const reduced of [false, true])
                  for (const sequence of frames) {
                    scene.reducedMotion = reduced;
                    scene.feedback.reset();
                    scene.motionClock.reset();
                    scene.poseTransition.reset();
                    const start = scene.animationTime + 1;
                    scene.heroDeathAt = -1;
                    const sources = new Set();
                    let error = 0;
                    const times = reduced
                      ? sequence.action === 'attack'
                        ? [0, 0.12, 0.28]
                        : [sequence.times[0], sequence.times.at(-1)!]
                      : sequence.times;
                    for (const time of times) {
                      scene.animationTime = start + time;
                      f.x = 960 + (sequence.action === 'walk' ? time * 70 : 0);
                      f.y = 520;
                      f.facing = (dir * Math.PI) / 4;
                      f.action = ['hurt', 'death'].includes(sequence.action)
                        ? 'idle'
                        : sequence.action;
                      f.actionTime =
                        Math.max(
                          0,
                          ({ attack: 0.28, ultimate: 0.6, defense: 0.3 } as any)[sequence.action] -
                            time,
                        ) || 0;
                      if (sequence.action === 'hurt')
                        scene.feedback.impacts.set('hero', {
                          born: start,
                          angle: (dir * Math.PI) / 4,
                        });
                      scene.drawHero(f, sequence.action === 'death');
                      count++;
                      const body = scene.actors.get('hero'),
                        mesh = scene.continuousActors.get('hero').mesh,
                        weapon = scene.heldWeapon.image;
                      sources.add(`${body.texture.key}/${body.frame.name}`);
                      if (sequence.action === 'death') {
                        if (weapon.visible)
                          failures.push({
                            appearance,
                            item: item.templateId,
                            dir,
                            action: 'death',
                            time,
                            reason: 'visible corpse weapon',
                          });
                        continue;
                      }
                      const slash = body.getData('heldSlash');
                      const hand =
                        body.getData('heldWeaponPose')?.hand ??
                        (slash
                          ? heroSlashGrip(...slash)
                          : heroGrip(
                              appearance,
                              body.getData('heldView'),
                              body.getData('heldPose'),
                            ));
                      const expected = renderedWrist(body, mesh, hand),
                        distance = Math.hypot(weapon.x - expected.x, weapon.y - expected.y);
                      error = Math.max(error, distance);
                      maximumError = Math.max(maximumError, distance);
                      if (
                        !weapon.visible ||
                        !Number.isFinite(distance + weapon.rotation) ||
                        distance > 0.01 ||
                        weapon.getData('artId') !== item.templateId
                      )
                        if (failures.length < 30)
                          failures.push({
                            appearance,
                            item: item.templateId,
                            dir,
                            action: sequence.action,
                            time,
                            distance,
                            visible: weapon.visible,
                          });
                    }
                    rows.push({
                      appearance,
                      item: item.templateId,
                      dir,
                      reduced,
                      action: sequence.action,
                      frames: times.length,
                      error,
                      sources: [...sources],
                    });
                  }
            }
          }
          scene.reducedMotion = false;
          scene.feedback.reset();
          return {
            count,
            maximumError,
            failures,
            rows,
            items: items.map((i: any) => i.templateId),
            sampling: '60 Hz animation timeline; idle at 0, .2, .4; reduced motion endpoints',
          };
        },
        { batch },
      );
      expect(audit.items).toHaveLength(28);
      expect(audit.failures).toEqual([]);
      expect(audit.maximumError).toBeLessThan(0.01);
      expect(errors).toEqual([]);
      await mkdir(directory, { recursive: true });
      await writeFile(
        `${directory}/${renderer.toLowerCase()}-${batch}.json`,
        JSON.stringify({ ...audit, errors }, null, 2),
      );

      // Actual Phaser renders: one sheet per identity, six styles × eight directions
      // × windup/contact/recovery. Clone the real mesh and held sprite, not a mock.
      if (renderer === 'WebGL' && process.env.MUGONG_WEAPON_SHEETS !== '0')
        for (let appearance = batch * 5; appearance < batch * 5 + 5; appearance++) {
          await page.evaluate(async (appearance) => {
            const module = (window as any).regionModule;
            const { gameStore } = await module('/src/platform/store.ts');
            const { makeLootItem, WEAPON_STYLES } = await module('/src/domain/items.ts');
            const { ART_WEAPONS } = await module('/src/domain/content.ts');
            const scene = (window as any).regionScene,
              f = gameStore.state.run.fighter;
            for (const child of scene.children.list) child.setVisible(false);
            scene.game.scale.resize(1920, 2800);
            scene.cameras.main.setZoom(1).centerOn(960, 1400).setBackgroundColor('#d9cfba');
            const canvas = scene.game.canvas;
            canvas.dataset.weaponSheet = 'true';
            document.body.append(canvas);
            if (!document.getElementById('weapon-sheet-style')) {
              const style = document.createElement('style');
              style.id = 'weapon-sheet-style';
              style.textContent =
                'canvas[data-weapon-sheet] {position:fixed !important;left:0 !important;top:0 !important;width:1920px !important;height:2800px !important;max-width:none !important;max-height:none !important;z-index:100000 !important;margin:0 !important}';
              document.head.append(style);
            }
            f.appearance = appearance;
            for (let styleIndex = 0; styleIndex < 6; styleIndex++)
              for (let phase = 0; phase < 3; phase++)
                for (let dir = 0; dir < 8; dir++) {
                  const style = WEAPON_STYLES[styleIndex],
                    item = makeLootItem(`weapon-${style}-0`, style, 'weapon');
                  const id = Object.keys(ART_WEAPONS).find((k) => ART_WEAPONS[k] === style)!;
                  f.items = [item];
                  f.arts = [{ id, level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
                  f.bindings = { [id]: item.id };
                  f.active = 0;
                  scene.motionClock.reset();
                  scene.poseTransition.reset();
                  scene.animationTime += 1;
                  scene.feedback.reset();
                  f.action = 'attack';
                  f.actionTime = [0.23, 0.19, 0.09][phase];
                  f.facing = (dir * Math.PI) / 4;
                  f.x = 960;
                  f.y = 520;
                  scene.drawHero(f, false);
                  const body = scene.actors.get('hero'),
                    source = scene.continuousActors.get('hero').mesh,
                    weapon = scene.heldWeapon.image;
                  const x = dir * 240 + 120,
                    y = (styleIndex * 3 + phase) * 155 + 140;
                  const mesh = scene.add
                    .mesh2d(
                      x,
                      y,
                      source.texture.key,
                      source.vertices.slice(),
                      source.indices.slice(),
                    )
                    .setOrigin(0, 0)
                    .setRenderAsTriangles(true)
                    .setRotation(source.rotation)
                    .setDepth(y);
                  const sprite = scene.add
                    .image(
                      x + weapon.x - source.x,
                      y + weapon.y - source.y,
                      weapon.texture.key,
                      weapon.frame.name,
                    )
                    .setOrigin(weapon.originX, weapon.originY)
                    .setScale(weapon.scaleX, weapon.scaleY)
                    .setRotation(weapon.rotation)
                    .setDepth(y + weapon.depth - source.depth);
                  scene.add
                    .text(
                      dir * 240 + 8,
                      (styleIndex * 3 + phase) * 155 + 4,
                      `${style} ${['ready', 'contact', 'recover'][phase]} D${dir}`,
                      { fontSize: '13px', color: '#132b20' },
                    )
                    .setDepth(3000);
                  mesh.setVisible(true);
                  sprite.setVisible(weapon.visible);
                }
            scene.continuousActors.get('hero').hide();
            scene.heldWeapon.image.setVisible(false);
          }, appearance);
          await page.setViewportSize({ width: 1920, height: 2800 });
          await page.waitForTimeout(120);
          await page
            .locator('canvas[data-weapon-sheet]')
            .screenshot({ path: `${directory}/hero-${appearance}-attacks.png` });
        }
    });
