import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { observeScene, seedRegion } from './support/region';
const secondGroup = ['0-1', '0-2', '0-3', '0-4', '7-3'];
for (const id of ['4-1', '4-2', '4-3', '4-4', '5-2', ...secondGroup])
  test(`${id}: 전용 근접 패턴 로딩·팔방 렌더·접촉·저장 재개`, async ({ page }) => {
    const proof = `docs/verification/boss-melee-v${secondGroup.includes(id) ? 2 : 1}`;
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, Number(id.split('-')[0]));
    await observeScene(page);
    const result = await page.evaluate(async (id) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { BOSS_MELEE } = await load('/src/domain/boss-melee.ts');
      const { enemyAttack } = await load('/src/domain/combat.ts');
      const { tick } = await load('/src/domain/game.ts');
      const { isGameSave } = await load('/src/platform/save-validation.ts');
      const r = store.state.run,
        f = r.fighter,
        e = r.enemies[3],
        scene = (window as any).regionScene;
      store.rendererReady = false;
      r.enemies = [e];
      r.zones = [];
      r.encounterObjects = [];
      r.effects = [];
      r.projectiles = [];
      Object.assign(e, {
        bossId: id,
        kind: 'chief',
        role: undefined,
        x: 900,
        y: 450,
        hp: 100000,
        maxHp: 100000,
        skillClock: 0,
        xp: 0,
        hitSeq: -1,
      });
      Object.assign(f, { x: 1040, y: 450, hp: 120, invulnerable: 0, cooldown: 100 });
      const rows: any[] = [];
      for (const move of BOSS_MELEE[id].sequence) {
        e.move = move;
        const profile = enemyAttack(e),
          spec = profile.melee;
        for (let d = 0; d < 8; d++) {
          e.aim = e.facing = (d * Math.PI) / 4;
          for (const phase of ['windup', 'strike', 'recover']) {
            e.state = phase;
            e.strike = {
              fromX: e.x,
              fromY: e.y,
              toX: e.x,
              toY: e.y,
              duration: spec.duration,
              damage: 10,
              hit: false,
              contactsDone: 0,
            };
            e.timer =
              phase === 'windup'
                ? spec.windup * 0.15
                : phase === 'strike'
                  ? spec.duration - spec.contacts[0]
                  : spec.recovery;
            scene.draw(r);
            const actor = scene.actors.get(String(e.id));
            rows.push({
              move,
              phase,
              d,
              texture: actor.texture.key,
              frame: actor.frame.name,
              width: actor.displayWidth,
              height: actor.displayHeight,
              pose: actor.getData('drawingPose'),
            });
          }
        }
      }
      // Exercise actual release and mid-strike serialization, not only static drawing.
      e.move = 'slam';
      e.state = 'windup';
      e.timer = 0.001;
      e.aim = e.facing = 0;
      e.strike = undefined;
      e.targetX = f.x;
      e.targetY = f.y;
      e.speed = 0;
      const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
      for (let n = 0; n < 40; n++) tick(r, idle, 1 / 120);
      const resumed = structuredClone(r);
      tick(r, idle, 1 / 120);
      tick(resumed, idle, 1 / 120);
      scene.draw(r);
      store.notify();
      return {
        rows,
        hp: f.hp,
        slow: f.slowTime,
        shots: r.projectiles.length,
        save: isGameSave(store.state),
        resume: JSON.stringify(r) === JSON.stringify(resumed),
      };
    }, id);
    expect(result.rows).toHaveLength(
      id === '0-2' ? 144 : ['5-2', '0-1', '0-4'].includes(id) ? 120 : 96,
    );
    for (const row of result.rows) {
      expect(row.texture).not.toBe('enemy');
      expect(Number.isFinite(row.width) && Number.isFinite(row.height)).toBe(true);
      expect(row.width).toBeGreaterThan(10);
      expect(row.height).toBeGreaterThan(10);
    }
    expect(result.hp).toBeLessThan(120);
    expect(result.slow).toBeGreaterThan(0);
    expect(result.shots).toBe(0);
    expect(result.save).toBe(true);
    expect(result.resume).toBe(true);
    expect(errors).toEqual([]);
    await writeFile(`${proof}/${id}-render.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${proof}/${id}-slam.png` });
    for (const phase of ['windup', 'strike']) {
      await page.evaluate(
        async ({ phase, id }) => {
          const load = (window as any).regionModule;
          const { gameStore: store } = await load('/src/platform/store.ts');
          const { enemyAttack } = await load('/src/domain/combat.ts');
          const r = store.state.run,
            e = r.enemies[0],
            f = r.fighter;
          e.move =
            id === '5-2'
              ? 'sweep'
              : id === '4-2'
                ? 'grab'
                : id === '0-1'
                  ? 'slash'
                  : ['0-2', '0-3'].includes(id)
                    ? 'thrust'
                    : 'combo';
          e.state = phase;
          e.aim = e.facing = Math.PI / 2;
          const spec = enemyAttack(e).melee;
          e.strike = {
            fromX: e.x,
            fromY: e.y,
            toX: e.x,
            toY: e.y,
            duration: spec.duration,
            damage: 10,
            hit: false,
            contactsDone: 0,
          };
          e.timer = phase === 'windup' ? spec.windup * 0.15 : spec.duration - spec.contacts[0];
          f.x = 1050;
          f.y = 600;
          f.action = 'idle';
          f.actionTime = 0;
          f.invulnerable = 0;
          r.effects = [];
          r.encounterObjects = [];
          (window as any).regionScene.draw(r);
          store.notify();
        },
        { phase, id },
      );
      await page.screenshot({ path: `${proof}/${id}-${phase}.png` });
    }
  });

for (const id of ['0-1', '0-2', '0-3'])
  test(`${id}: 호령·깃발·쇄겸의 실제 접촉과 화면 효과`, async ({ page }) => {
    const proof = 'docs/verification/boss-melee-v2';
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedRegion(page, 0);
    await observeScene(page);
    const result = await page.evaluate(async (id) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { tick } = await load('/src/domain/game.ts');
      const { isGameSave } = await load('/src/platform/save-validation.ts');
      const { bossDamageFactor, damageObject } = await load('/src/domain/boss-encounters.ts');
      store.rendererReady = false;
      const r = store.state.run,
        e = r.enemies[3],
        f = r.fighter;
      r.enemies = [e];
      r.zones = [];
      r.encounterObjects = [];
      r.effects = [];
      r.projectiles = [];
      Object.assign(e, {
        bossId: id,
        kind: 'chief',
        role: undefined,
        x: 900,
        y: 450,
        hp: 100000,
        maxHp: 100000,
        state: 'windup',
        timer: 0.001,
        move: id === '0-1' ? 'summon' : id === '0-2' ? 'stance' : 'thrust',
        aim: 0,
        facing: 0,
        strike: undefined,
        skillClock: 0,
        hitSeq: -1,
        xp: 0,
      });
      Object.assign(f, { x: 1200, y: 450, hp: 120, cooldown: 100, invulnerable: 0 });
      const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
      for (let n = 0; n < (id === '0-3' ? 22 : 31); n++) tick(r, idle, 1 / 120);
      const flag = r.encounterObjects.find((o: any) => o.kind === 'flag');
      const buff = bossDamageFactor(r, e);
      let destroyed = 1;
      if (flag) {
        const backup = structuredClone(r);
        damageObject(backup, backup.encounterObjects[0], 999);
        destroyed = bossDamageFactor(backup, backup.enemies[0]);
      }
      const clone = structuredClone(r);
      tick(clone, idle, 1 / 120);
      tick(r, idle, 1 / 120);
      (window as any).regionScene.draw(r);
      store.notify();
      return {
        hp: f.hp,
        x: f.x,
        enemies: r.enemies.length,
        objects: r.encounterObjects.length,
        effect: r.effects.map((x: any) => x.kind),
        buff,
        destroyed,
        shots: r.projectiles.length,
        save: isGameSave(store.state),
        resume: JSON.stringify(r) === JSON.stringify(clone),
      };
    }, id);
    expect(result.save).toBe(true);
    expect(result.resume).toBe(true);
    expect(result.shots).toBe(0);
    if (id === '0-1') {
      expect(result.enemies).toBe(3);
      expect(result.hp).toBe(120);
    } else if (id === '0-2') {
      expect(result.objects).toBe(1);
      expect(result.buff).toBe(0.45);
      expect(result.destroyed).toBe(1);
      expect(result.hp).toBe(120);
    } else {
      expect(result.objects).toBe(0);
      expect(result.effect).toContain('chain');
      expect(result.x).toBeCloseTo(1020, 1);
      expect(result.hp).toBeLessThan(120);
    }
    expect(errors).toEqual([]);
    await writeFile(`${proof}/${id}-mechanic.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${proof}/${id}-mechanic.png` });
  });
