import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { BOSS_KITS, BOSS_MELEE } from '../../src/domain/boss-melee';
import { observeScene, seedRegion } from './support/region';
const proof = 'docs/verification/boss-followup-v3-v5';
for (const id of Object.keys(BOSS_KITS).filter((id) => !BOSS_MELEE[id])) {
  test(`${id}: 모든 패턴 팔방·준비/접촉/회복·실제 발동·저장 재개`, async ({ page }) => {
    await mkdir(proof, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await seedRegion(page, Number(id.split('-')[0]));
    await observeScene(page);
    const result = await page.evaluate(async (id) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { BOSS_KITS } = await load('/src/domain/boss-melee.ts');
      const { enemyAttack } = await load('/src/domain/combat.ts');
      const { tick } = await load('/src/domain/game.ts');
      const { isGameSave } = await load('/src/platform/save-validation.ts');
      const { hostileMotion } = await load('/src/game/hostile-motion.ts');
      store.rendererReady = false;
      const r = store.state.run,
        f = r.fighter,
        e = r.enemies[3];
      r.enemies = [e];
      r.offers = [];
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
        hp: 90000,
        maxHp: 100000,
        skillClock: 0,
        xp: 0,
        speed: 0,
        hitSeq: -1,
        guardTime: 0,
        staggerTime: 0,
      });
      Object.assign(f, {
        x: 1040,
        y: 450,
        hp: 120,
        invulnerable: 0,
        cooldown: 100,
        action: 'idle',
        actionTime: 0,
      });
      const baseline = structuredClone(r),
        rows: any[] = [],
        contacts: any[] = [];
      const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
      for (const move of BOSS_KITS[id].sequence) {
        e.move = move;
        const spec = enemyAttack(e).melee;
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
            (window as any).regionScene.draw(r);
            const actor = (window as any).regionScene.actors.get(String(e.id));
            rows.push({
              move,
              name: spec.name,
              phase,
              d,
              texture: actor.texture.key,
              frame: actor.frame.name,
              width: actor.displayWidth,
              height: actor.displayHeight,
              pose: actor.getData('drawingPose'),
              motion: hostileMotion(e),
            });
          }
        }
        const trial = structuredClone(baseline),
          enemy = trial.enemies[0],
          fighter = trial.fighter;
        const distance = spec.shot || spec.zone ? 400 : (spec.dash ?? 0) + spec.range * 0.7;
        Object.assign(fighter, {
          x: 900 + distance,
          y: 450,
          hp: 120,
          invulnerable: 0,
          cooldown: 100,
        });
        Object.assign(enemy, {
          move,
          state: 'windup',
          timer: 0.001,
          strike: undefined,
          aim: 0,
          facing: 0,
          targetX: fighter.x,
          targetY: fighter.y,
        });
        for (let n = 0; n < Math.ceil((spec.contacts[0] + 0.04) * 120); n++)
          tick(trial, idle, 1 / 120);
        const restored = structuredClone(trial);
        tick(trial, idle, 1 / 120);
        tick(restored, idle, 1 / 120);
        contacts.push({
          move,
          name: spec.name,
          physical: spec.shape !== 'none',
          hp: fighter.hp,
          shots: trial.projectiles.map((p: any) => ({
            visual: p.visual,
            landing: p.landing,
            status: p.status,
          })),
          expectedShots: spec.shot?.count,
          expectedVisual: spec.shot?.visual,
          expectedZone: spec.zone?.kind,
          objects: trial.encounterObjects.map((o: any) => ({ kind: o.kind, mechanic: o.mechanic })),
          save: isGameSave({ ...store.state, run: trial }),
          resume: JSON.stringify(trial) === JSON.stringify(restored),
        });
      }
      // Capture a representative attack using the same live drawing path.
      Object.assign(r, structuredClone(baseline));
      const finalEnemy = r.enemies[0],
        finalSpec = BOSS_KITS[id].moves[BOSS_KITS[id].sequence[0]];
      Object.assign(finalEnemy, {
        move: BOSS_KITS[id].sequence[0],
        state: 'windup',
        timer: finalSpec.windup * 0.15,
        aim: Math.PI / 2,
        facing: Math.PI / 2,
        strike: undefined,
      });
      (window as any).regionScene.draw(r);
      store.notify();
      return { rows, contacts };
    }, id);
    expect(result.rows).toHaveLength(BOSS_KITS[id].sequence.length * 24);
    for (const row of result.rows) {
      expect(row.texture).not.toBe('enemy');
      expect(Number.isFinite(row.width + row.height)).toBe(true);
      expect(row.width).toBeGreaterThan(10);
      expect(row.height).toBeGreaterThan(10);
      const spec = BOSS_KITS[id].moves[row.move as keyof (typeof BOSS_KITS)[string]['moves']]!;
      if (spec.motion) expect(row.motion).toBe(spec.motion);
    }
    for (const contact of result.contacts) {
      if (contact.physical) expect(contact.hp).toBeLessThan(120);
      if (contact.expectedShots) {
        expect(contact.shots).toHaveLength(contact.expectedShots);
        expect(contact.shots.every((p: any) => p.visual === contact.expectedVisual)).toBe(true);
      }
      if (contact.expectedZone) expect(contact.shots[0].landing.kind).toBe(contact.expectedZone);
      expect(contact.save).toBe(true);
      expect(contact.resume).toBe(true);
    }
    expect(errors).toEqual([]);
    await writeFile(`${proof}/${id}.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${proof}/${id}-windup.png` });
    await page.evaluate(async (id) => {
      const load = (window as any).regionModule;
      const { gameStore: store } = await load('/src/platform/store.ts');
      const { BOSS_KITS } = await load('/src/domain/boss-melee.ts');
      const { tick } = await load('/src/domain/game.ts');
      const r = store.state.run,
        e = r.enemies[0],
        f = r.fighter;
      const move =
        BOSS_KITS[id].sequence.find(
          (m: string) => BOSS_KITS[id].moves[m].mechanic === 'signature',
        ) ??
        BOSS_KITS[id].sequence.find((m: string) => BOSS_KITS[id].moves[m].shot) ??
        BOSS_KITS[id].sequence[0];
      const spec = BOSS_KITS[id].moves[move];
      const distance = spec.shot || spec.zone ? 400 : (spec.dash ?? 0) + spec.range * 0.7;
      Object.assign(f, { x: e.x + distance, y: e.y, hp: 120, invulnerable: 0, cooldown: 100 });
      Object.assign(e, {
        move,
        state: 'windup',
        timer: 0.001,
        aim: 0,
        facing: 0,
        strike: undefined,
        targetX: f.x,
        targetY: f.y,
      });
      const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
      for (let n = 0; n < Math.ceil((spec.contacts[0] + 0.04) * 120); n++) tick(r, idle, 1 / 120);
      (window as any).regionScene.draw(r);
      store.notify();
    }, id);
    await page.screenshot({ path: `${proof}/${id}-contact.png` });
  });
}
