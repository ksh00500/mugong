import { expect, it } from 'vitest';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import {
  canCommitAttack,
  observeTarget,
  predictedTarget,
  tacticalMovement,
} from '../src/domain/enemy-tactics';
import {
  observeSquad,
  squadAssignment,
  squadRole,
  clearFiringLane,
} from '../src/domain/enemy-coordination';
import { FIELD } from '../src/domain/content';
import { ROLE_PROFILES, ENEMY_ROLES, type EnemyRole } from '../src/domain/region-enemies';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import type { Enemy } from '../src/domain/model';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(roles: EnemyRole[] = ['raider', 'raider', 'guard', 'bowman']) {
  const s = emptyGame();
  startRun(s, '협공 검사', 123);
  const r = s.run!,
    original = r.enemies[0];
  r.offers = [];
  r.zones = [];
  Object.assign(r.fighter, { x: 1000, y: 530, invulnerable: 100 });
  r.enemies = roles.map((role, n) => ({
    ...original,
    id: 100 + n,
    kind: ROLE_PROFILES[role].kind,
    role,
    bossId: undefined,
    x: 800 - n * 55,
    y: 530 + n * 50,
    state: 'approach',
    timer: 0,
  }));
  return { s, r, e: r.enemies[0], f: r.fighter };
}
it('front pressure, a flank, an interception and a firing angle use distinct goals', () => {
  const { r, f } = fixture();
  observeSquad(r, { x: 180, y: 0 });
  const [front, flank, spear, bow] = r.enemies.map((e) => squadAssignment(r, e)!);
  expect(front).toMatchObject({ role: 'pressure', goal: undefined });
  expect(flank.goal!.y).not.toBe(f.y);
  expect(spear.goal!.x).toBeGreaterThan(f.x + 60);
  expect(spear.goal!.y).not.toBe(f.y);
  expect(Math.hypot(bow.goal!.x - f.x, bow.goal!.y - f.y)).toBeGreaterThan(250);
  const old = new Map(r.enemies.map((e) => [e.id, squadAssignment(r, e)]));
  r.enemies.reverse();
  observeSquad(r, { x: 180, y: 0 });
  for (const e of r.enemies) expect(squadAssignment(r, e)).toEqual(old.get(e.id));
});
it('retains a front for 1.5 seconds instead of swapping it with every closer flank', () => {
  const { r } = fixture();
  observeSquad(r, { x: 0, y: 0 });
  const leader = r.enemies[0],
    flank = r.enemies[1];
  flank.x = r.fighter.x - 50;
  r.elapsed = 0.5;
  observeSquad(r, { x: 0, y: 0 });
  expect(squadAssignment(r, leader)!.goal).toBeUndefined();
  r.elapsed = 1.6;
  observeSquad(r, { x: 0, y: 0 });
  expect(squadAssignment(r, flank)!.goal).toBeUndefined();
});
it('additional interceptors reserve a separate layer rather than the same point', () => {
  const { r } = fixture(['raider', 'guard', 'guard', 'guard', 'bowman']);
  for (const velocity of [
    { x: 0, y: 0 },
    { x: 180, y: 0 },
  ]) {
    observeSquad(r, velocity);
    const a = squadAssignment(r, r.enemies[1])!.goal!,
      b = squadAssignment(r, r.enemies[3])!.goal!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(74.99);
  }
});
it('a lone enemy, a pair, bosses, confused or staggered members do not form a squad', () => {
  const { r } = fixture();
  r.enemies[0].bossId = '0-1';
  r.enemies[1].confused = 2;
  observeSquad(r, { x: 100, y: 0 });
  expect(r.enemies.map((e) => squadAssignment(r, e))).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
  expect(squadRole(r.enemies[0])).toBeUndefined();
  expect(squadRole(r.enemies[1])).toBeUndefined();
  r.enemies[2].staggerTime = 2;
  expect(squadRole(r.enemies[2])).toBeUndefined();
});
for (const role of ENEMY_ROLES)
  it(`${role}: bounded finite movement at every corner without a speed bonus`, () => {
    const { r, f } = fixture(['raider', 'guard', role]),
      e = r.enemies[2];
    for (const [x, y] of [
      [FIELD.left, FIELD.top],
      [FIELD.right, FIELD.top],
      [FIELD.left, FIELD.bottom],
      [FIELD.right, FIELD.bottom],
    ]) {
      f.x = x;
      f.y = y;
      r.enemies.forEach((e, n) => {
        e.x = x + (x === FIELD.left ? 100 : -100);
        e.y = y + (y === FIELD.top ? 100 + n * 15 : -100 - n * 15);
      });
      observeSquad(r, { x: 200, y: 140 });
      const goal = squadAssignment(r, e)?.goal;
      if (goal) {
        expect(goal.x).toBeGreaterThanOrEqual(FIELD.left + 45);
        expect(goal.x).toBeLessThanOrEqual(FIELD.right - 45);
        expect(goal.y).toBeGreaterThanOrEqual(FIELD.top + 45);
        expect(goal.y).toBeLessThanOrEqual(FIELD.bottom - 45);
      }
      const p = enemyAttack(e),
        v = tacticalMovement(r, e, f, p);
      expect(Number.isFinite(v.x + v.y)).toBe(true);
      expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(ROLE_PROFILES[role].speed + 0.001);
    }
  });
it('a volley covers observed movement during melee pressure and freezes its final warning', () => {
  const { r, f } = fixture(),
    bow = r.enemies[3];
  r.enemies[0].x = f.x - 100;
  r.enemies[0].state = 'windup';
  r.enemies[0].timer = 0.3;
  observeTarget(r, 0.1);
  for (let n = 0; n < 10; n++) {
    f.y += 12;
    observeTarget(r, 0.1);
  }
  expect(predictedTarget(r, bow, f, true).y).toBeGreaterThan(f.y + 35);
  bow.state = 'windup';
  bow.timer = 0.2;
  bow.aim = 0;
  bow.targetX = f.x;
  bow.targetY = f.y;
  const target = { x: bow.targetX, y: bow.targetY };
  for (let n = 0; n < 6; n++) tick(r, { ...idle, dy: -1 }, 1 / 60);
  expect({ x: bow.targetX, y: bow.targetY }).toEqual(target);
  expect(bow.aim).toBe(0);
});
it('a blocked archer does not shoot through an ally or block the next melee waiter', () => {
  const { r, f } = fixture(['bowman', 'raider', 'raider', 'guard']);
  const [bow, ally, waiter] = r.enemies;
  Object.assign(bow, { x: f.x - 400, y: f.y });
  Object.assign(ally, { x: f.x - 180, y: f.y, state: 'recover', timer: 0.5 });
  Object.assign(waiter, { x: f.x - 70, y: f.y + 70 });
  observeSquad(r, { x: 0, y: 0 });
  expect(clearFiringLane(r, bow)).toBe(false);
  expect(canCommitAttack(r, bow)).toBe(false);
  expect(canCommitAttack(r, waiter)).toBe(true);
  ally.y += 100;
  expect(clearFiringLane(r, bow)).toBe(true);
  expect(canCommitAttack(r, bow)).toBe(true);
});
it('admission spacing survives reload without a new save field', () => {
  const { s, r } = fixture();
  r.enemies[0].state = 'windup';
  r.enemies[0].timer = enemyAttack(r.enemies[0]).windup - 0.1;
  expect(isGameSave(s)).toBe(true);
  const loaded = decodeCurrentSave(s)!;
  expect(loaded).not.toBeNull();
  const clone = loaded.run!;
  expect(canCommitAttack(clone, clone.enemies[1])).toBe(false);
  clone.enemies[0].timer -= 0.13;
  expect(canCommitAttack(clone, clone.enemies[1])).toBe(true);
});
it('distant committed shooters still consume attack slots', () => {
  const { r } = fixture(['raider', 'bowman', 'bowman', 'bowman']);
  r.enemies.slice(1).forEach((e, n) => {
    e.x = FIELD.left;
    e.y = FIELD.top + n * 100;
    e.state = 'windup';
    e.timer = 0.25;
  });
  expect(canCommitAttack(r, r.enemies[0])).toBe(false);
  r.enemies[1].state = 'recover';
  expect(canCommitAttack(r, r.enemies[0])).toBe(true);
});
it('two same-role commitments leave a slot for a different role without starving the FIFO', () => {
  const { r } = fixture(['raider', 'raider', 'raider', 'guard']);
  const [a, b, c, spear] = r.enemies;
  for (const e of [a, b]) {
    e.state = 'windup';
    e.timer = 0.25;
  }
  observeSquad(r, { x: 0, y: 0 });
  expect(canCommitAttack(r, c)).toBe(false);
  expect(canCommitAttack(r, spear)).toBe(true);
  a.state = 'recover';
  expect(canCommitAttack(r, c)).toBe(true);
});
it('actual mixed combat staggers starts and preserves attack warnings and at most three commitments', () => {
  const { r, f } = fixture(['raider', 'guard', 'bowman', 'raider', 'guard', 'bowman']);
  r.enemies.forEach((e, n) => {
    e.hp = e.maxHp = 10000;
    e.x = 1000 + Math.cos(n * 1.05) * 180;
    e.y = 530 + Math.sin(n * 1.05) * 180;
  });
  const starts: { time: number; id: number }[] = [];
  for (let frame = 0; frame < 900; frame++) {
    f.hp = 120;
    r.zoneClock = 0;
    const previous = new Map(r.enemies.map((e) => [e.id, e.state]));
    tick(r, idle, 1 / 60);
    const active = r.enemies.filter((e) => e.state === 'windup' || e.state === 'strike');
    expect(active.length).toBeLessThanOrEqual(3);
    for (const e of r.enemies)
      if (e.state === 'windup' && previous.get(e.id) !== 'windup') {
        starts.push({ time: r.elapsed, id: e.id });
        expect(e.timer).toBeCloseTo(enemyAttack(e).windup);
      }
  }
  expect(new Set(starts.map((x) => x.id)).size).toBe(6);
  for (let i = 1; i < starts.length; i++)
    expect(starts[i].time - starts[i - 1].time).toBeGreaterThanOrEqual(0.22 - 1e-6);
});
