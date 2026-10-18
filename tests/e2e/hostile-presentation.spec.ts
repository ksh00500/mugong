import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { seedRegion, observeScene } from './support/region';
const proof = 'docs/verification/hostile-presentation-v2';
for (let region = 0; region < 10; region++)
  test(`지역 ${region}: 역할별 무기 그림·5방향·보스·장판 렌더링`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, region);
    await observeScene(page);
    const result = await page.evaluate(async (region) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { REGION_ROSTERS, ROLE_PROFILES } = await load('/src/domain/region-enemies.ts');
      const { REGIONS } = await load('/src/domain/campaign.ts');
      const { enemyRepairSlot, enemyArtSlot } = await load('/src/platform/region-art.ts');
      const { hazardProjectileVisual } = await load('/src/domain/projectile-visual.ts');
      const scene = (window as any).regionScene,
        r = store.state.run;
      store.rendererReady = false;
      const base = r.enemies[0];
      const roles = [...new Set<string>(REGION_ROSTERS[REGIONS[region].name])];
      r.enemies = roles.map((role, i) => ({
        ...base,
        role,
        bossId: undefined,
        kind: ROLE_PROFILES[role].kind,
        id: 600 + i,
        x: 420 + i * 430,
        y: 400,
        state: 'windup',
        aim: 0,
        facing: 0,
        timer: 0.3,
      }));
      for (let i = 1; i <= 4; i++)
        r.enemies.push({
          ...base,
          role: undefined,
          bossId: `${region}-${i}`,
          kind: 'chief',
          id: 610 + i,
          x: 390 + (i - 1) * 380,
          y: 740,
          state: 'windup',
          aim: 0,
          facing: 0,
          timer: 0.3,
        });
      const calls: string[] = [];
      for (const g of [scene.ground, scene.graphics])
        for (const name of ['strokeCircle', 'strokeEllipse', 'strokePath']) {
          const original = g[name];
          g[name] = function (...args: any[]) {
            calls.push(name);
            return original.apply(this, args);
          };
        }
      r.zones = [
        { id: 0, kind: 'cold', x: 900, y: 560, radius: 100, warning: 0, life: 50, pulse: 0 },
        { id: 1, kind: 'cold', x: 1120, y: 550, radius: 65, warning: 0, life: 50, pulse: 0 },
      ];
      r.encounterObjects = [];
      r.formations = [];
      r.effects = [];
      r.projectiles = roles
        .filter((role) => ROLE_PROFILES[role].zone)
        .map((role, i) => ({
          x: 850 + i * 130,
          y: 450,
          vx: 100,
          vy: 0,
          life: 0.4,
          friendly: false,
          damage: 10,
          radius: 14,
          hits: [],
          visual: hazardProjectileVisual(ROLE_PROFILES[role].zone),
          landing: { x: 960, y: 560, radius: 65, kind: ROLE_PROFILES[role].zone },
        }));
      scene.draw(r);
      store.notify();
      const actions: string[] = [];
      for (const state of ['windup', 'strike', 'recover']) {
        for (const enemy of r.enemies) {
          enemy.state = state;
          enemy.timer = 0.12;
        }
        scene.draw(r);
        for (const enemy of r.enemies) {
          const mesh = scene.continuousActors.get(String(enemy.id)).mesh;
          if (mesh.getData('action') !== state) actions.push(`${enemy.id}:${state}`);
        }
      }
      const reactions: any[] = [];
      for (const enemy of r.enemies) {
        const id = String(enemy.id);
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
          scene.animationTime - 0.08,
          false,
        );
        scene.drawEnemy(enemy);
        const mesh = scene.continuousActors.get(id).mesh;
        const hurt = Array.from(mesh.vertices);
        const reaction = mesh.getData('action');
        scene.drawEnemy(enemy, 0.15);
        reactions.push({
          role: enemy.role,
          bossId: enemy.bossId,
          hurt: reaction,
          death: mesh.getData('action'),
          style: mesh.getData('motionStyle'),
          changed: JSON.stringify(hurt) !== JSON.stringify(Array.from(mesh.vertices)),
        });
      }
      scene.feedback.reset();
      for (const enemy of r.enemies) {
        enemy.state = 'windup';
        enemy.timer = 0.3;
      }
      scene.draw(r);
      const actors = r.enemies.map((e: any) => {
        const repair = enemyRepairSlot(e),
          slot = enemyArtSlot(e, region);
        const key = repair === undefined ? `region-direction-${region}` : 'enemy-role-directions';
        const frames = scene.directionFrames.get(key);
        const actor = scene.actors.get(String(e.id));
        return {
          role: e.role,
          bossId: e.bossId,
          texture: actor.texture.key,
          frame: actor.frame.name,
          expected: scene.motionFrames
            .get(
              e.role === 'rider'
                ? 'cavalry-actions'
                : repair === undefined
                  ? `region-motion-${region}`
                  : 'enemy-role-actions',
            )
            .get(`${e.role === 'rider' ? 0 : (repair ?? slot)}-2`).texture,
          mounted: e.role === 'rider',
          views: [0, 1, 2, 3, 4].every((v) => {
            const f = frames.get(`${repair ?? slot}-${v}`);
            return f && f.width > 0 && f.height > 0;
          }),
        };
      });
      const projectiles = scene.paintedEffects.pool
        .filter((i: any) => i.visible)
        .map((i: any) => ({ texture: i.texture.key, frame: i.frame.name }));
      return {
        actors,
        actions,
        reactions,
        calls,
        projectiles,
        atlas: scene.textures.get('painted-zones').source[0].image.src,
      };
    }, region);
    expect(result.calls).toEqual([]);
    expect(result.actions).toEqual([]);
    for (const reaction of result.reactions) {
      expect(reaction.hurt).toBe('hurt');
      expect(reaction.death).toBe('death');
      expect(reaction.changed).toBe(true);
      expect(reaction.style).toBeTruthy();
    }
    expect(result.atlas).toContain('/art/zone-art-v2.png');
    for (const actor of result.actors) {
      expect(actor.views).toBe(true);
      expect(actor.texture).toBe(actor.expected);
    }
    if (region === 3)
      expect(result.projectiles).toContainEqual({
        texture: 'hostile-projectiles',
        frame: 'ice-bomb',
      });
    await page.screenshot({ path: `${proof}/region-${region}.png` });
    await writeFile(`${proof}/region-${region}.json`, JSON.stringify(result, null, 2));
    expect(errors).toEqual([]);
  });
