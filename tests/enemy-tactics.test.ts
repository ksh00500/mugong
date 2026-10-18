import { expect, it } from 'vitest';
import { emptyGame, startRun, tick, spawnWave } from '../src/domain/game';
import { FIELD } from '../src/domain/content';
import { BOSS_ATTACKS } from '../src/domain/boss-attacks';
import { meleeKit } from '../src/domain/boss-melee';
import { enemyAttack } from '../src/domain/combat';
import {
  tacticalMovement,
  tacticalBossMove,
  observeTarget,
  predictedTarget,
  canCommitAttack,
  repositionFactor,
} from '../src/domain/enemy-tactics';
import { encounterHp, BALANCE } from '../src/domain/balance';

function fixture() {
  const s = emptyGame();
  startRun(s, '전술 검사', 123);
  const r = s.run!,
    e = r.enemies[0];
  r.offers = [];
  r.enemies = [e];
  r.zones = [];
  Object.assign(e, {
    role: 'bowman',
    kind: 'archer',
    bossId: undefined,
    x: 800,
    y: 500,
    timer: 0,
    state: 'approach',
  });
  Object.assign(r.fighter, { x: 1100, y: 500 });
  return { r, e };
}
it('궁수는 사격 거리에서 횡이동하고 가까우면 후퇴하며 벽에서는 빠져나온다', () => {
  const { r, e } = fixture();
  const profile = enemyAttack(e);
  expect(Math.abs(tacticalMovement(r, e, r.fighter, profile).y)).toBeGreaterThan(20);
  r.fighter.x = 850;
  expect(tacticalMovement(r, e, r.fighter, profile).x).toBeLessThan(0);
  e.x = FIELD.left;
  r.fighter.x = FIELD.left + 40;
  const edge = tacticalMovement(r, e, r.fighter, profile);
  expect(edge.x).toBeGreaterThanOrEqual(0);
  expect(Math.abs(edge.y)).toBeGreaterThan(20);
});
it('겹친 적은 서로 다른 방향으로 분산하며 속도 상한을 넘지 않는다', () => {
  const { r, e } = fixture();
  e.role = 'raider';
  r.fighter.x = e.x + 50;
  const other = { ...e, id: e.id + 1 };
  r.enemies.push(other);
  const a = tacticalMovement(r, e, r.fighter, enemyAttack(e));
  const b = tacticalMovement(r, other, r.fighter, enemyAttack(other));
  expect(a.x * b.x).toBeLessThan(0);
  expect(Math.hypot(a.x, a.y)).toBeLessThanOrEqual(114.001);
});
it('민첩한 적은 가까운 가시 투사체만 피하며 지나간 탄에는 반응하지 않는다', () => {
  const { r, e } = fixture();
  const base = tacticalMovement(r, e, r.fighter, enemyAttack(e));
  const shot = {
    x: e.x - 90,
    y: e.y,
    vx: 500,
    vy: 0,
    life: 2,
    friendly: true,
    damage: 1,
    radius: 8,
    hits: [] as number[],
  };
  r.projectiles.push(shot);
  const dodge = tacticalMovement(r, e, r.fighter, enemyAttack(e));
  expect(Math.abs(dodge.y)).toBeGreaterThan(Math.abs(base.y));
  expect(Math.hypot(dodge.x, dodge.y)).toBeLessThanOrEqual(88.001);
  shot.x = e.x + 90;
  expect(tacticalMovement(r, e, r.fighter, enemyAttack(e))).toEqual(base);
});
it('이동 예측은 보행을 앞서 조준하고 순간이동은 예측하지 않는다', () => {
  const { r, e } = fixture();
  observeTarget(r, 0.1);
  for (let n = 0; n < 10; n++) {
    r.fighter.y += 20;
    observeTarget(r, 0.1);
  }
  expect(predictedTarget(r, e, r.fighter, true).y).toBeGreaterThan(r.fighter.y + 30);
  r.fighter.x += 500;
  observeTarget(r, 0.1);
  expect(predictedTarget(r, e, r.fighter, true).x).toBe(r.fighter.x);
  observeTarget(r, 0);
  expect(Number.isFinite(predictedTarget(r, e, r.fighter, true).y)).toBe(true);
});
for (let region = 0; region < 10; region++)
  for (let phase = 1; phase <= 4; phase++)
    it(`${region}-${phase}: 보스가 멀리서 허공 근접 공격 대신 전용 사거리 패턴을 선택한다`, () => {
      const { e } = fixture();
      e.bossId = `${region}-${phase}`;
      e.role = undefined;
      const style = BOSS_ATTACKS[region][phase - 1];
      for (let pattern = 0; pattern < style.sequence.length; pattern++) {
        e.pattern = pattern;
        const selected = tacticalBossMove(e, 450)!;
        expect(style.sequence).toContain(selected);
        const kit = meleeKit(e);
        if (kit) {
          // Bespoke reach replaces the old generic style's numbers. With no
          // reachable move, simulation approaches before it can commit anything.
          if (
            kit.sequence.some((move) => {
              const spec = kit.moves[move]!;
              return spec.range + (spec.dash ?? 0) + 18 >= 450;
            })
          ) {
            const spec = kit.moves[selected]!;
            expect(spec.range + (spec.dash ?? 0) + 18).toBeGreaterThanOrEqual(450);
          }
          continue;
        }
        if (
          style.sequence.some(
            (m) =>
              ['fan', 'ring', 'hazard', 'summon'].includes(m) ||
              (m === 'dash' && style.dash + style.melee >= 450),
          )
        )
          expect(['slash', 'pulse', 'thrust']).not.toContain(selected);
      }
    });
it('공격 대기열은 적 세 명의 준비를 유지하고 회복한 자리가 생기면 다음 적을 허용한다', () => {
  const { r, e } = fixture();
  r.enemies.push(...[1, 2, 3].map((n) => ({ ...e, id: e.id + n, state: 'windup' as const })));
  expect(canCommitAttack(r, e)).toBe(false);
  r.enemies[1].state = 'recover';
  expect(canCommitAttack(r, e)).toBe(true);
});
it('30% 완화를 해제하되 보스 패턴 준비시간은 유지한다', () => {
  expect(BALANCE.bossHp).toEqual([900, 1500, 2200, 3000]);
  expect(BALANCE.enemyDamageFactor).toBeCloseTo(1.2);
  expect(encounterHp(0, false)).toBe(Math.round(32 * 1.65));
});
it('예측 조준은 마지막 준비 잠금 동안 고정되어 회피한 플레이어를 따라가지 않는다', () => {
  const { r, e } = fixture();
  e.state = 'windup';
  e.timer = 0.35;
  e.aim = 0;
  e.targetX = 1100;
  e.targetY = 500;
  for (let n = 0; n < 15; n++)
    tick(r, { dx: 0, dy: 1, aim: 0, attack: false, defense: false, ultimate: false }, 1 / 60);
  expect(e.aim).toBe(0);
  expect(e.targetY).toBe(500);
});

const idleInput = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
it('waiting melee enemies step instead of standing still in their preferred distance', () => {
  const { r, e } = fixture();
  e.role = 'duelist';
  e.kind = 'sword';
  r.fighter.x = e.x + 95;
  e.timer = 10;
  let travel = 0;
  for (let n = 0; n < 120; n++) {
    const before = { x: e.x, y: e.y };
    tick(r, idleInput, 1 / 60);
    travel += Math.hypot(e.x - before.x, e.y - before.y);
  }
  expect(travel).toBeGreaterThan(45);
  expect(e.state).toBe('approach');
});
it('early windup repositions; final anticipation and strike stay locked; late recovery steps', () => {
  const { r, e } = fixture();
  const p = enemyAttack(e);
  e.state = 'windup';
  e.timer = p.windup;
  const initial = { x: e.x, y: e.y };
  tick(r, idleInput, 1 / 60);
  expect(Math.hypot(e.x - initial.x, e.y - initial.y)).toBeGreaterThan(0.1);
  e.timer = 0.2;
  const locked = { x: e.x, y: e.y };
  for (let n = 0; n < 6; n++) tick(r, idleInput, 1 / 60);
  expect({ x: e.x, y: e.y }).toEqual(locked);
  e.state = 'strike';
  expect(repositionFactor(e, p)).toBe(0);
  e.state = 'recover';
  e.timer = p.recovery;
  expect(repositionFactor(e, p)).toBe(0);
  e.timer = p.recovery - 0.3;
  tick(r, idleInput, 1 / 60);
  expect(Math.hypot(e.x - locked.x, e.y - locked.y)).toBeGreaterThan(0.1);
});
it('the next waiting enemy gets a released slot before a repeat attacker; stale waiters do not block', () => {
  const { r, e } = fixture();
  const waiting = { ...e, id: e.id + 1 },
    third = { ...e, id: e.id + 2 };
  r.enemies = [e, waiting, third];
  expect(canCommitAttack(r, e)).toBe(true);
  e.state = 'windup';
  r.enemies.push({ ...e, id: e.id + 3 }, { ...e, id: e.id + 4 });
  expect(canCommitAttack(r, waiting)).toBe(false);
  expect(canCommitAttack(r, third)).toBe(false);
  r.enemies[3].state = 'recover';
  e.state = 'approach';
  expect(canCommitAttack(r, e)).toBe(false);
  expect(canCommitAttack(r, waiting)).toBe(true);
  third.x = 100;
  third.y = 100;
  expect(canCommitAttack(r, e)).toBe(true);
});
