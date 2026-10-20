import { describe, it, expect } from 'vitest';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { enemyAttack } from '../src/domain/combat';
import { combatBody, combatOrigin, projectileHitsBody } from '../src/domain/combat-body';
import { bossAttackTell } from '../src/game/boss-tells';
import { bossMotionClock } from '../src/game/boss-motion';
import { bossCombatPhase, enemySize } from '../src/domain/boss-resilience';
import type { Enemy } from '../src/domain/model';
const enemy = (bossId = '0-1', move = 'slash') =>
  ({
    id: 1,
    bossId,
    kind: 'chief',
    state: 'windup',
    timer: 0.3,
    pattern: 0,
    hp: 900,
    maxHp: 900,
    x: 600,
    y: 500,
    aim: 0.6,
    facing: 0.6,
    move,
  }) as Enemy;

describe('boss size and readable combat states', () => {
  it('keeps ordinary and player bodies while making named/legacy bosses 20% larger', () => {
    expect(enemySize({ kind: 'sword' })).toBe(1);
    expect(enemySize({})).toBe(1);
    for (const kind of ['chief', 'captain']) expect(enemySize({ kind })).toBe(1.2);
    const e = enemy();
    const original = structuredClone(e);
    const body = combatBody(e);
    expect(body.top.y).toBeCloseTo(425.6);
    expect(body.radius).toBeCloseTo(26.4);
    expect(projectileHitsBody({ x: 500, y: 420 }, { x: 700, y: 420 }, e, 2)).toBe(true);
    expect(projectileHitsBody({ x: 500, y: 385 }, { x: 700, y: 385 }, e, 2)).toBe(false);
    expect(combatOrigin(e).y).toBeCloseTo(466);
    expect(e).toEqual(original);
  });
  it('reports actual rage/guard/pursuit and never invents an HP-triggered buff', () => {
    const e = enemy();
    e.hp = 1;
    expect(bossCombatPhase(e)).toBe('combat');
    e.pressure = { farTime: 0, warning: 0.2, burst: 0, cooldown: 1, lastDistance: 300 };
    expect(bossCombatPhase(e)).toBe('pursuit');
    e.guardTime = 1;
    expect(bossCombatPhase(e)).toBe('guard');
    e.rageTime = 0.2;
    expect(bossCombatPhase(e)).toBe('enraged');
  });
  it('establishes a loaded silhouette early without moving contact times', () => {
    const timing = { duration: 0.5, contacts: [0.2] };
    expect(bossMotionClock('slash', 'windup', 0.1, timing)?.phase).toBe('prepare');
    expect(bossMotionClock('slash', 'windup', 0.25, timing)?.phase).toBe('load');
    expect(bossMotionClock('slash', 'strike', 0.4, timing)?.phase).toBe('contact');
  });
});
describe('warnings use all actual boss kits, clocks and saved targets', () => {
  it('does not turn a harmless pressure step into a damaging dash warning', () => {
    const e = enemy();
    e.pressure = { farTime: 0, warning: 0, burst: 1, cooldown: 3, lastDistance: 200, advance: 90 };
    const tell = bossAttackTell(e)!;
    expect(tell.kind).toBe('sweep');
    expect(tell.shape).toBe('sector');
    expect(tell.landing).toBeUndefined();
    expect(tell.x).toBeCloseTo(enemyAttack(e).origin.x);
  });
  it('covers 40 bosses and all 185 actions without mutating simulation state', () => {
    let count = 0;
    for (const [id, kit] of Object.entries(BOSS_KITS))
      for (const [move, spec] of Object.entries(kit.moves)) {
        const e = enemy(id, move);
        e.timer = spec!.windup * 0.2;
        e.targetX = 920;
        e.targetY = 650;
        const before = JSON.stringify(e),
          t = bossAttackTell(e)!;
        expect(t, `${id}/${move}`).toBeDefined();
        expect(Number.isFinite(t.progress)).toBe(true);
        expect(t.progress).toBeGreaterThanOrEqual(0);
        expect(t.progress).toBeLessThanOrEqual(1);
        expect(JSON.stringify(e)).toBe(before);
        if (spec!.shot) expect(t.angles).toEqual(enemyAttack(e).shots.map((s) => s.angle));
        if (spec!.zone) {
          expect(t.shape).toBe('glyph');
          expect([t.x, t.y]).toEqual([920, 650]);
        }
        if (spec!.shape === 'none' && !spec!.shot && !spec!.zone) expect(t.shape).toBe('glyph');
        count++;
      }
    expect(count).toBe(185);
  });
  it('continues charging past windup until the real first contact', () => {
    const e = enemy();
    const p = enemyAttack(e),
      duration = p.melee!.duration,
      contact = p.melee!.contacts[0];
    e.timer = 0;
    const atWindup = bossAttackTell(e)!;
    expect(atWindup.progress).toBeLessThan(1);
    e.state = 'strike';
    e.strike = {
      duration,
      fromX: e.x,
      fromY: e.y,
      toX: e.x,
      toY: e.y,
      damage: 1,
      hit: false,
      contactsDone: 0,
    };
    e.timer = duration - contact + 0.001;
    expect(bossAttackTell(e)!.progress).toBeGreaterThan(atWindup.progress);
    e.strike.contactsDone = 1;
    e.timer = duration - contact - 0.001;
    expect(bossAttackTell(e)).toBeUndefined();
  });
  it('does not reset combo warnings or show the next tell over follow-through', () => {
    const e = enemy('0-2', 'combo'),
      p = enemyAttack(e),
      spec = p.melee!;
    e.state = 'strike';
    e.strike = {
      duration: spec.duration,
      fromX: e.x,
      fromY: e.y,
      toX: e.x,
      toY: e.y,
      damage: 1,
      hit: false,
      contactsDone: 1,
    };
    e.timer = spec.duration - spec.contacts[0] - 0.1;
    expect(bossAttackTell(e)).toBeUndefined();
    e.timer = spec.duration - spec.contacts[1] + 0.02;
    expect(bossAttackTell(e)?.contact).toBe(1);
    e.state = 'recover';
    expect(bossAttackTell(e)).toBeUndefined();
  });
  it('separates dash corridor and endpoint and never previews a dead/ordinary enemy', () => {
    const e = enemy('0-1', 'dash'),
      p = enemyAttack(e),
      t = bossAttackTell(e)!;
    expect(t.kind).toBe('dash');
    expect(t.width).toBe(30);
    expect(t.landing?.range).toBe(p.range);
    expect(t.range).toBeCloseTo(Math.hypot(p.origin.x - e.x, p.origin.y - e.y));
    e.hp = 0;
    expect(bossAttackTell(e)).toBeUndefined();
    e.hp = 1;
    delete e.bossId;
    e.kind = 'sword';
    expect(bossAttackTell(e)).toBeUndefined();
  });
});
