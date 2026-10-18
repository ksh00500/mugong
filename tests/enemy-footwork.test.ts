import { describe, expect, it, afterAll } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { ENEMY_ROLES, ROLE_PROFILES } from '../src/domain/region-enemies';
import type { Enemy } from '../src/domain/model';
const report: { id: string; attacks: number; maxStill: number; travel: number }[] = [];
const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
const cases = [
  ...ENEMY_ROLES.map((role) => ({ role, bossId: undefined })),
  ...Array.from({ length: 40 }, (_, n) => ({
    role: undefined,
    bossId: `${Math.floor(n / 4)}-${(n % 4) + 1}`,
  })),
];
describe('all hostile roles and bosses: active combat timing', () => {
  for (const actor of cases)
    it(actor.role ?? actor.bossId!, () => {
      const game = emptyGame();
      startRun(game, '전술 측정', 123);
      const r = game.run!;
      const e = r.enemies[0];
      Object.assign(e, actor, {
        kind: actor.role ? ROLE_PROFILES[actor.role].kind : 'chief',
        x: 800,
        y: 500,
        hp: 100000,
        maxHp: 100000,
        state: 'approach',
        timer: 0,
        bossId: actor.bossId,
      });
      r.enemies = [e];
      r.zones = [];
      r.offers = [];
      r.encounterObjects = [];
      Object.assign(r.fighter, {
        x: 800 + (actor.role ? ROLE_PROFILES[actor.role].distance || 75 : 250),
        y: 500,
        hp: 100000,
        invulnerable: 100,
      });
      let attacks = 0,
        still = 0,
        maxStill = 0,
        travel = 0;
      for (let frame = 0; frame < 720; frame++) {
        const before = { x: e.x, y: e.y, state: e.state };
        tick(r, idle, 1 / 60);
        const move = Math.hypot(e.x - before.x, e.y - before.y);
        travel += move;
        still = move < 0.05 ? still + 1 / 60 : 0;
        maxStill = Math.max(maxStill, still);
        if (before.state !== 'strike' && e.state === 'strike') attacks++;
      }
      report.push({
        id: actor.role ?? actor.bossId!,
        attacks,
        maxStill: +maxStill.toFixed(3),
        travel: +travel.toFixed(1),
      });
      expect(r.phase).toBe('combat');
      expect(attacks).toBeGreaterThanOrEqual(2);
      expect(maxStill).toBeLessThan(3);
      expect(travel).toBeGreaterThan(20);
    });
});
afterAll(async () => {
  const dir = 'docs/verification/enemy-footwork-v4';
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/simulation.json`, JSON.stringify(report, null, 2));
});
