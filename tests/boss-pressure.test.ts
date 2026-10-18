import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { BOSS_KITS, meleeMove } from '../src/domain/boss-melee';
import {
  bossCommitRange,
  BOSS_PRESSURE,
  commitBossPressure,
  pressureMovement,
  stepBossPressure,
} from '../src/domain/boss-pressure';
import { enemyAttack } from '../src/domain/combat';
import { observeTarget, observedVelocity, predictedTarget } from '../src/domain/enemy-tactics';
import { makeWeapon } from '../src/domain/content';
import { isGameSave } from '../src/platform/save-validation';
import type { BoundFighter } from '../src/domain/model';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(id = '4-1') {
  const s = emptyGame();
  startRun(s, '추격 검사', 123);
  const r = s.run!,
    f = r.fighter,
    e = r.enemies[0];
  r.regionRoute = ['청하현', '독무곡', '천검산', '설산'];
  r.offers = [];
  r.zones = [];
  r.encounterObjects = [];
  r.enemies = [e];
  Object.assign(e, {
    bossId: id,
    role: undefined,
    kind: 'chief',
    x: 650,
    y: 530,
    hp: 100000,
    maxHp: 100000,
    xp: 0,
    state: 'approach',
    timer: 0,
    skillClock: 0,
  });
  Object.assign(f, { x: 1200, y: 530, cooldown: 0 });
  return { s, r, e, f };
}

it('모든 40보스가 멀리서 계속 이동하는 상대에게 예고·유한 보법·재사용 대기를 갖는다', () => {
  for (const id of Object.keys(BOSS_KITS)) {
    const { r, e } = fixture(id);
    let starts = 0;
    for (let n = 0; n < 60; n++) starts += Number(stepBossPressure(r, e, 1 / 60, { x: 265, y: 0 }));
    expect(starts, id).toBe(1);
    expect(e.pressure!.warning).toBeGreaterThan(0);
    expect(pressureMovement(e, r.fighter, { x: 265, y: 0 })!.speed).toBe(55);
    for (let n = 0; n < 25; n++) stepBossPressure(r, e, 1 / 60, { x: 265, y: 0 });
    expect(pressureMovement(e, r.fighter, { x: 265, y: 0 })!.speed).toBeGreaterThan(340);
    expect(pressureMovement(e, r.fighter, { x: 265, y: 0 })!.target.x).toBeGreaterThan(r.fighter.x);
    for (let n = 0; n < 180; n++)
      starts += Number(stepBossPressure(r, e, 1 / 60, { x: 265, y: 0 }));
    expect(starts).toBe(1);
    expect(e.pressure!.burst).toBe(0);
  }
});
it('일반 적과 멈춘 상대는 새 보법을 발동하지 않는다', () => {
  const { r, e } = fixture();
  for (let n = 0; n < 120; n++) stepBossPressure(r, e, 1 / 60, { x: 0, y: 0 });
  expect(e.pressure!.burst).toBe(0);
  e.bossId = undefined;
  e.kind = 'sword';
  delete e.pressure;
  stepBossPressure(r, e, 1, { x: 265, y: 0 });
  expect(e.pressure).toBeUndefined();
});
it('타격과 회수 중 보법이 취소되며 실제 공격 시간·방향·피해는 유지된다', () => {
  for (const state of ['windup', 'strike', 'recover'] as const) {
    const { r, e } = fixture();
    e.pressure = { farTime: 0, warning: 0, burst: 1, cooldown: 3, lastDistance: 550 };
    e.state = state;
    e.timer = 0.1;
    e.aim = 0.8;
    stepBossPressure(r, e, 1 / 60, { x: 265, y: 0 });
    expect(e.pressure.burst).toBe(0);
    expect(pressureMovement(e, r.fighter, { x: 265, y: 0 })).toBeUndefined();
    expect(e.timer).toBe(0.1);
    expect(e.aim).toBe(0.8);
  }
});
it('전진 발걸음은 해당 근접 공격만 이동시키고 접촉 시점과 무기 판정은 유지한다', () => {
  const { r, e } = fixture();
  e.move = 'thrust';
  e.pressure = { farTime: 0, warning: 0, burst: 1, cooldown: 3, lastDistance: 550 };
  const original = enemyAttack(e);
  commitBossPressure(e, original);
  const moved = meleeMove(e, 'thrust')!;
  expect(moved.dash).toBeGreaterThan(0);
  expect(moved.range).toBe(original.range);
  expect(moved.width).toBe(original.melee!.width);
  expect(moved.contacts).toEqual(original.melee!.contacts);
  expect(bossCommitRange(e, enemyAttack(e), { x: 0, y: 0 }, r.fighter)).toBe(original.range + 20);
  expect(meleeMove(e, 'dash')!.dash).toBe(BOSS_KITS['4-1'].moves.dash!.dash);
  expect(meleeMove(e, 'slam')!.dash).toBeUndefined();
  Object.assign(e, {
    state: 'strike',
    timer: moved.duration,
    strike: {
      fromX: 650,
      fromY: 530,
      toX: 740,
      toY: 530,
      duration: moved.duration,
      damage: 20,
      hit: false,
      contactsDone: 0,
    },
    aim: 0,
  });
  r.fighter.x = 740;
  r.fighter.y = 530;
  tick(r, idle, 1 / 60);
  expect(r.fighter.hp).toBe(120);
  expect(e.strike!.contactsDone).toBe(0);
});
it('후퇴 중인 상대에게 빈 근접 공격 대신 간격을 좁히고 측면 회피는 가능하다', () => {
  const { r, e, f } = fixture();
  e.move = 'thrust';
  const p = enemyAttack(e);
  expect(bossCommitRange(e, p, { x: 265, y: 0 }, f)).toBeLessThan(p.range + 20);
  expect(bossCommitRange(e, p, { x: -265, y: 0 }, f)).toBe(p.range + 20);
  expect(bossCommitRange(e, p, { x: 0, y: 265 }, f)).toBe(p.range + 20);
  // Locked attacks cannot turn toward an evasive player.
  Object.assign(e, {
    x: 900,
    state: 'windup',
    aim: 0,
    facing: 0,
    timer: 0.15,
    targetX: 1000,
    targetY: 530,
  });
  f.x = 1000;
  f.y = 530;
  tick(r, { ...idle, dy: -1 }, 1 / 60);
  expect(e.aim).toBe(0);
  for (let n = 0; n < 40; n++) tick(r, { ...idle, dy: -1 }, 1 / 60);
  expect(f.hp).toBe(120);
});
it('340 보행 관측과 원거리 선행 조준은 동작하고 순간이동을 예측에 쓰지 않는다', () => {
  const { r, e, f } = fixture('1-2');
  e.move = 'fan';
  observeTarget(r, 1 / 60);
  for (let n = 0; n < 30; n++) {
    f.y += 340 / 60;
    observeTarget(r, 1 / 60);
  }
  expect(observedVelocity(r).y).toBeGreaterThan(320);
  expect(predictedTarget(r, e, f, true).y).toBeGreaterThan(f.y + 150);
  f.x -= 800;
  observeTarget(r, 1 / 60);
  expect(Math.abs(observedVelocity(r).x)).toBeLessThan(1);
});
it('추격 시계는 저장·복원되고 음수·무한·범위 밖 시계를 거부한다', () => {
  const { s, r, e } = fixture();
  for (let n = 0; n < 60; n++) stepBossPressure(r, e, 1 / 60, { x: 265, y: 0 });
  expect(isGameSave(s)).toBe(true);
  const copy = JSON.parse(JSON.stringify(s));
  const p = copy.run.enemies[0].pressure;
  tick(copy.run, idle, 1 / 60);
  expect(copy.run.enemies[0].pressure.cooldown).toBeLessThan(p.cooldown + 1 / 60);
  for (const bad of [-1, Infinity, 6]) {
    const copy = JSON.parse(JSON.stringify(s));
    copy.run.enemies[0].pressure.cooldown = bad;
    expect(isGameSave(copy)).toBe(false);
  }
  expect(e.pressure!.cooldown).toBeLessThanOrEqual(BOSS_PRESSURE.cooldown);
});

it('40보스의 실제 이동·사격 순환을 기록하고 보법 없는 비교군과 압박을 비교한다', () => {
  const rows: any[] = [];
  for (const id of Object.keys(BOSS_KITS)) {
    const runs = [];
    for (const pressure of [false, true]) {
      const { s, r, e, f } = fixture(id);
      const weapon = makeWeapon('dart', 'pressure-dart', 'weapon');
      weapon.x = 0;
      weapon.y = 0;
      f.items = [weapon];
      f.arts = [{ id: 'tang', level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
      (f as BoundFighter).bindings = { tang: weapon.id };
      const points = [
        [1500, 300],
        [1500, 780],
        [420, 780],
        [420, 300],
      ];
      f.x = 420;
      f.y = 300;
      let point = 0,
        damage = 0,
        warnings = 0,
        minDistance = 2000;
      const moves = new Set<string>();
      for (let n = 0; n < 60 * 40; n++) {
        const [x, y] = points[point];
        const dx = x - f.x,
          dy = y - f.y;
        if (Math.hypot(dx, dy) < 12) point = (point + 1) % points.length;
        if (!pressure)
          e.pressure = {
            farTime: 0,
            warning: 0,
            burst: 0,
            cooldown: 5,
            lastDistance: Math.hypot(e.x - f.x, e.y - f.y),
          };
        f.hp = 120;
        r.zoneClock = 0; // Exclude ambient reinforcements; boss summons remain active.
        tick(r, { ...idle, dx, dy, aim: Math.atan2(e.y - f.y, e.x - f.x), attack: true }, 1 / 60);
        damage += Math.max(0, 120 - f.hp);
        if (e.pressure?.warning === BOSS_PRESSURE.warning) warnings++;
        minDistance = Math.min(minDistance, Math.hypot(e.x - f.x, e.y - f.y));
        if (e.state === 'strike') moves.add(e.move!);
        expect(Number.isFinite(e.x + e.y)).toBe(true);
        expect(r.phase).toBe('combat');
      }
      expect(isGameSave(s)).toBe(true);
      expect(f.attackSeq).toBeGreaterThan(20);
      expect(e.hp).toBeLessThan(e.maxHp);
      runs.push({ pressure, damage, warnings, minDistance, moves: [...moves], shots: f.attackSeq });
    }
    rows.push({ id, runs });
  }
  mkdirSync('docs/verification/boss-pressure-v1', { recursive: true });
  writeFileSync(
    'docs/verification/boss-pressure-v1/simulation.json',
    JSON.stringify(rows, null, 2),
  );
  const enabled = rows.map((r) => r.runs[1]);
  expect(enabled.every((r) => r.warnings > 0 || r.moves.length > 1)).toBe(true);
  expect(enabled.reduce((n, r) => n + r.damage, 0)).toBeGreaterThan(
    rows.reduce((n, r) => n + r.runs[0].damage, 0),
  );
  expect(enabled.filter((r) => r.damage === 0).length).toBeLessThan(
    rows.filter((r) => r.runs[0].damage === 0).length,
  );
}, 30000);
