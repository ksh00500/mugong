import { it, expect } from 'vitest';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { bossOpening, bossRecovery } from '../src/domain/boss-recovery';
import { enemyAttack } from '../src/domain/combat';
import { repositionFactor, tacticalBossMove } from '../src/domain/enemy-tactics';
import { tick } from '../src/domain/game';
import { isGameSave } from '../src/platform/save-validation';
import { balanceFixture } from './support/boss-balance-probe';
import type { BossMove } from '../src/domain/campaign';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };

it('모든185행동의 큰 기술은 광폭 중에도 정지된 반격 시간을 보장한다', () => {
  let checked = 0,
    heavy = 0;
  for (const [id, kit] of Object.entries(BOSS_KITS))
    for (const [move, spec] of Object.entries(kit.moves)) {
      const { e } = balanceFixture(id);
      e.move = move as BossMove;
      e.state = 'recover';
      e.rageTime = 3;
      const policy = bossRecovery(spec!, e.move, true);
      e.timer = enemyAttack(e).recovery;
      expect(e.timer).toBe(policy.duration);
      checked++;
      if (!policy.heavy) continue;
      heavy++;
      expect(e.timer).toBeGreaterThanOrEqual(0.85);
      for (const remaining of [e.timer, e.timer * 0.5, 0.01]) {
        e.timer = remaining;
        expect(bossOpening(e)).toBeDefined();
        expect(repositionFactor(e, enemyAttack(e))).toBe(0);
      }
      e.timer = 0;
      expect(bossOpening(e)).toBeUndefined();
    }
  expect(checked).toBe(185);
  expect(heavy).toBeGreaterThan(70);
});

it('회복 중 추격·가드 반격이 큰 기술의 정지와 저장 시계를 취소하지 않는다', () => {
  const { s, r, e, f } = balanceFixture('4-4');
  Object.assign(e, {
    state: 'recover',
    move: 'slam',
    timer: 1.05,
    guardTime: 1,
    armourTime: 1,
    facing: 0,
  });
  f.x = e.x + 90;
  f.y = e.y;
  e.pressure = { farTime: 0, warning: 0, burst: 1.8, cooldown: 4, lastDistance: 90 };
  r.attacks = [
    {
      timer: 0.001,
      angle: Math.PI,
      damage: 100,
      range: 145,
      arc: 1.1,
      thrust: false,
      heal: false,
      art: 'huashan',
      seq: 1,
    },
  ];
  const x = e.x,
    y = e.y;
  tick(r, idle, 1 / 60);
  expect(e.hp).toBeLessThan(e.maxHp);
  expect(e.state).toBe('recover');
  expect(e.timer).toBeCloseTo(1.05 - 1 / 60);
  expect({ x: e.x, y: e.y }).toEqual({ x, y });
  expect(e.pressure.burst).toBe(0);
  expect(isGameSave(s)).toBe(true);
  const copy = JSON.parse(JSON.stringify(s));
  tick(copy.run, idle, 1 / 60);
  expect(copy.run.enemies[0].timer).toBeCloseTo(e.timer - 1 / 60);
  expect(s.run!.enemies[0].timer).toBe(e.timer);
});

it('근접 기본 접촉만 반격20%를 얻고 원거리 투사체·궁극 피해는 늘리지 않는다', () => {
  function damage(recover: boolean, projectile = false, basic = true) {
    const { r, e, f } = balanceFixture('4-1');
    Object.assign(e, {
      state: recover ? 'recover' : 'windup',
      move: 'slam',
      timer: 1,
      x: 800,
      y: 530,
    });
    f.x = 710;
    f.y = 530;
    if (projectile)
      r.projectiles.push({
        x: 795,
        y: 496,
        vx: 300,
        vy: 0,
        life: 1,
        friendly: true,
        damage: 100,
        radius: 10,
        hits: [],
        art: 'samja',
        seq: 1,
      });
    else
      r.attacks = [
        {
          timer: 0.001,
          angle: 0,
          damage: 100,
          range: 145,
          arc: 1.1,
          thrust: false,
          heal: false,
          art: 'huashan',
          seq: basic ? 1 : undefined,
        },
      ];
    const hp = e.hp;
    tick(r, idle, 1 / 60);
    return hp - e.hp;
  }
  expect(damage(true)).toBeCloseTo(damage(false) * 1.2);
  expect(damage(true, true)).toBeCloseTo(damage(false, true));
  expect(damage(true, false, false)).toBeCloseTo(damage(false, false, false));
});

it('추격 중 기존 돌진으로 간격을 좁히고 평시에는 원래 기술 순환을 유지한다', () => {
  const { e } = balanceFixture('0-2');
  e.pattern = 2; // stance next, but a real dash reaches this target.
  expect(tacticalBossMove(e, 300)).toBe('stance');
  e.pressure = { farTime: 0, warning: 0, burst: 1.8, cooldown: 4, lastDistance: 300 };
  expect(tacticalBossMove(e, 300)).toBe('dash');
  e.pressure.burst = 0;
  expect(tacticalBossMove(e, 300)).toBe('stance');
});
