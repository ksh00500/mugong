import { expect, it } from 'vitest';
import { emptyGame, startRun, tick, spawnWave } from '../src/domain/game';
import { signatureCast, stepEncounters, damageObject } from '../src/domain/boss-encounters';
import { reflectBamboo, stepBossBehavior } from '../src/domain/boss-mechanics';
import { applyFieldContact, stepFieldStatuses } from '../src/domain/field-effects';
import { isGameSave } from '../src/platform/save-validation';
import { enemyAttack } from '../src/domain/combat';
import { REGIONS } from '../src/domain/campaign';
import type { Projectile } from '../src/domain/model';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(id: string) {
  const state = emptyGame();
  startRun(state, '검증', 123);
  const r = state.run!,
    e = r.enemies[0],
    f = r.fighter;
  r.regionRoute = [
    REGIONS[Number(id.split('-')[0])].name,
    ...REGIONS.filter((_, n) => n !== Number(id.split('-')[0]))
      .slice(0, 3)
      .map((x) => x.name),
  ];
  r.offers = [];
  r.zones = [];
  r.encounterObjects = [];
  Object.assign(e, {
    bossId: id,
    x: 900,
    y: 450,
    hp: 500,
    maxHp: 1000,
    timer: 100,
    state: 'approach',
    skillClock: 0,
    xp: 0,
  });
  r.enemies = [e];
  Object.assign(f, { x: 1000, y: 500, hp: 60, invulnerable: 0, cooldown: 10 });
  const damage = (amount: number) => {
    if (f.invulnerable <= 0) f.hp = Math.max(0, f.hp - amount);
  };
  const step = (seconds: number) => {
    for (let n = 0; n < Math.round(seconds * 60); n++) stepEncounters(r, 1 / 60, damage);
  };
  return { state, r, e, f, damage, step };
}
it('체력 비율 교환은 원자적으로 두 HP를 바꾸고 완료 번호를 한 번만 기록한다', () => {
  const { state, r, e, f, step } = fixture('8-4');
  e.hp = 200;
  signatureCast(r, e);
  step(3.1);
  expect(f.hp).toBe(24);
  expect(e.hp).toBe(500);
  expect(r.exchangeSeq).toBe(1);
  step(1);
  expect(r.exchangeSeq).toBe(1);
  expect(isGameSave(state)).toBe(true);
});
for (const mode of ['distance', 'evade', 'destroy'] as const)
  it(`체력 교환 차단: ${mode}`, () => {
    const { r, e, f, step } = fixture('8-4');
    signatureCast(r, e);
    if (mode === 'distance') f.x = 1600;
    else if (mode === 'evade') f.invulnerable = 1;
    else damageObject(r, r.encounterObjects![0], 999);
    step(3.1);
    expect(f.hp).toBe(60);
    expect(e.hp).toBe(500);
    expect(r.exchangeSeq ?? 0).toBe(0);
  });
it('대나무 반사는 속력을 유지하고 친선탄을 탈취하지 않으며 반복 반사를 제한한다', () => {
  const { r, e } = fixture('5-4');
  signatureCast(r, e);
  const o = r.encounterObjects![0];
  o.warning = 0;
  const p: Projectile = {
    x: o.x + 5,
    y: o.y,
    vx: 300,
    vy: 0,
    life: 3,
    damage: 10,
    radius: 10,
    hits: [],
    friendly: false,
  };
  reflectBamboo(r, p, { x: o.x - 50, y: o.y }, 1 / 60);
  expect(p.vx).toBeCloseTo(-300);
  expect(p.bounces).toBe(1);
  reflectBamboo(r, p, { x: o.x - 50, y: o.y }, 1 / 60);
  expect(p.bounces).toBe(1);
  p.friendly = true;
  p.vx = 300;
  reflectBamboo(r, p, { x: o.x - 50, y: o.y }, 1);
  expect(p.vx).toBe(300);
  p.friendly = false;
  p.bounces = 3;
  reflectBamboo(r, p, { x: o.x - 50, y: o.y }, 1);
  expect(p.vx).toBe(300);
});
it('송월의 실제 시전은 대나무 형성 후 발사하므로 전투 tick에서 반사가 발생한다', () => {
  const { r, e, f } = fixture('5-4');
  f.hp = 120;
  f.x = 1300;
  f.y = 500;
  signatureCast(r, e);
  for (let n = 0; n < 180; n++) tick(r, idle, 1 / 60);
  expect(r.projectiles.some((p) => (p.bounces ?? 0) > 0)).toBe(true);
});
it('잘못된 회전문은 한 번 폭발하고 사라져 추가 폭발을 만들지 않는다', () => {
  const { r, e, f, step } = fixture('9-3');
  signatureCast(r, e);
  const o = r.encounterObjects!.find((o) => o.stage === 0)!;
  step(1.3);
  f.x = o.x;
  f.y = o.y;
  const hp = f.hp;
  step(0.02);
  expect(f.hp).toBe(hp - 16);
  expect(o.life).toBe(0);
  step(0.1);
  expect(f.hp).toBe(hp - 16);
});
it('잡기는 근접에서만 성립하고 던진 뒤 풀리며 회피하면 실패 빈틈이 생긴다', () => {
  const { r, e, f, step } = fixture('4-2');
  f.x = e.x + 40;
  f.y = e.y;
  signatureCast(r, e);
  step(0.85);
  expect(f.capturedTime).toBeGreaterThan(0);
  step(0.7);
  expect(f.capturedTime).toBe(0);
  expect(f.hp).toBe(36);
  f.x = e.x + 40;
  f.y = e.y;
  f.invulnerable = 1;
  signatureCast(r, e);
  step(0.85);
  expect(f.hp).toBe(36);
  expect(e.state).toBe('recover');
});
it('생장 선택·사망 시 잡기와 교환은 취소되고 중단된 교환이 재개되지 않는다', () => {
  const { r, e, f } = fixture('8-4');
  signatureCast(r, e);
  f.capturedTime = 1;
  r.offers = [{ art: 'samja', type: 'learn' }];
  tick(r, idle, 1 / 30);
  expect(r.encounterObjects).toHaveLength(0);
  expect(f.capturedTime).toBe(0);
  expect(r.exchangeSeq ?? 0).toBe(0);
});
it('수리 드론은 손상 기관으로 이동해 주기로만 회복시키며 파괴하면 수리가 끊긴다', () => {
  const { r, e, step } = fixture('9-2');
  signatureCast(r, e);
  const turret = r.encounterObjects!.find((o) => o.kind === 'turret')!;
  turret.hp = 10;
  const bossHP = e.hp;
  step(1.5);
  expect(turret.hp).toBe(10);
  step(2);
  expect(turret.hp).toBeGreaterThan(10);
  expect(e.hp).toBe(bossHP);
  const drone = r.encounterObjects!.find((o) => o.mechanic === 'drone')!;
  damageObject(r, drone, 999);
  const hp = turret.hp;
  step(1);
  expect(turret.hp).toBe(hp);
});
for (const id of ['9-3', '6-4', '6-3'])
  it(`회전 물체는 실제 위치가 이동한다: ${id}`, () => {
    const { r, e, step } = fixture(id);
    signatureCast(r, e);
    const o = r.encounterObjects![0];
    const x = o.x,
      y = o.y;
    step(2);
    expect(Math.hypot(o.x - x, o.y - y)).toBeGreaterThan(30);
  });
it('개문수의 문은 실제로 개폐하고 팔문장군에게는 안전문 하나가 남는다', () => {
  const a = fixture('9-1');
  signatureCast(a.r, a.e);
  a.step(1.3);
  expect(a.r.encounterObjects!.every((o) => o.stage === 1)).toBe(true);
  a.step(2);
  expect(a.r.encounterObjects!.every((o) => o.stage === 2)).toBe(true);
  a.step(0.6);
  expect(a.r.encounterObjects!.every((o) => o.stage === 0)).toBe(true);
  const b = fixture('9-3');
  signatureCast(b.r, b.e);
  expect(b.r.encounterObjects).toHaveLength(8);
  expect(b.r.encounterObjects!.filter((o) => o.stage === 1)).toHaveLength(1);
});
it('대나무는 낙하 순간 피해를 한 번 주고 쓰러진 상태로 남는다', () => {
  const { r, e, f, step } = fixture('5-3');
  signatureCast(r, e);
  const o = r.encounterObjects![0];
  step(3);
  f.x = o.x;
  f.y = o.y;
  step(0.3);
  expect(o.stage).toBe(1);
  expect(f.hp).toBe(42);
  step(0.3);
  expect(f.hp).toBe(42);
});
it('모래벽은 실물 장애물이고 오아시스는 회복을 만들지 않는다', () => {
  const { r, e, f, step } = fixture('7-4');
  signatureCast(r, e);
  const oasis = r.encounterObjects!.find((o) => o.mechanic === 'oasis')!;
  f.x = oasis.x;
  f.y = oasis.y;
  step(3);
  expect(f.hp).toBe(60);
  expect(r.encounterObjects!.filter((o) => o.mechanic === 'sandwall')).toHaveLength(2);
});
it('정화초 접촉은 효과가 없고 파괴 후에는 주변 독만 지워 먼 독지대는 유지한다', () => {
  const { r, e, f, step } = fixture('1-4');
  signatureCast(r, e);
  const herb = r.encounterObjects!.find((o) => o.kind === 'herb')!;
  f.x = herb.x;
  f.y = herb.y;
  f.poisonTime = 3;
  r.zones = [{ id: 1, x: 300, y: 300, radius: 20, warning: 0, life: 10, pulse: 1, kind: 'poison' }];
  step(1.3);
  expect(f.poisonTime).toBe(3);
  damageObject(r, herb, 999);
  step(0.1);
  expect(f.poisonTime).toBe(0);
  expect(r.zones[0].life).toBe(10);
});
it('종은 타격할 때만 강화·슈퍼아머를 만들며 종을 파괴하면 예방할 수 있다', () => {
  const a = fixture('4-3');
  signatureCast(a.r, a.e);
  a.step(0.5);
  expect(a.e.armourTime ?? 0).toBe(0);
  a.step(0.6);
  expect(a.e.armourTime).toBeGreaterThan(0);
  expect(a.e.rageTime).toBeGreaterThan(0);
  const b = fixture('4-3');
  signatureCast(b.r, b.e);
  damageObject(b.r, b.r.encounterObjects![0], 999);
  b.step(2);
  expect(b.e.armourTime ?? 0).toBe(0);
});
it('냉기 세 번은 동결, 무적은 누적을 차단, 온기는 해빙시키며 출혈은 독과 독립이다', () => {
  const { r, f, damage } = fixture('3-4');
  for (let n = 0; n < 3; n++) applyFieldContact(r, 'cold', damage);
  expect(f.freezeTime).toBe(0.65);
  expect(f.coldStacks).toBe(0);
  f.invulnerable = 1;
  applyFieldContact(r, 'cold', damage);
  expect(f.coldStacks).toBe(0);
  f.invulnerable = 0;
  r.zones = [{ id: 0, x: f.x, y: f.y, radius: 100, kind: 'cold', life: 100, warning: 0, pulse: 1 }];
  stepFieldStatuses(r, 0.01, damage);
  expect(f.freezeTime).toBe(0);
  f.bleedTime = 2;
  const hp = f.hp;
  stepFieldStatuses(r, 0.8, damage);
  expect(f.hp).toBe(hp - 3);
  expect(f.poisonTime ?? 0).toBe(0);
});
it('무명은 공격 시작에 반응하되 반응 쿨타임과 준비 시간이 있다', () => {
  const { r, e, f } = fixture('2-3');
  f.action = 'attack';
  f.attackSeq = 3;
  stepBossBehavior(r, e, 0.01);
  expect(e.move).toBe('dash');
  expect(e.timer).toBe(0.65);
  expect(e.reactionTime).toBe(2.5);
  e.state = 'approach';
  f.attackSeq = 4;
  stepBossBehavior(r, e, 0.01);
  expect(e.observedAttack).toBe(3);
});
it('백운의 절반 체력 검기는 실제 판정 반경과 그림이 함께 두 배로 넓어진다', () => {
  for (const [hp, radius, scale] of [
    [900, 12, 1],
    [400, 25, 2],
  ]) {
    const { r, e } = fixture('2-4');
    Object.assign(e, { hp, state: 'windup', timer: 0, move: 'fan', aim: 0 });
    tick(r, idle, 1 / 30);
    expect(r.projectiles).toHaveLength(0);
    for (let n = 0; n < 6; n++) tick(r, idle, 1 / 30);
    expect(r.projectiles.length).toBeGreaterThan(0);
    expect(r.projectiles[0].radius).toBe(radius);
    expect(r.projectiles[0].visualScale).toBe(scale);
  }
});
it('보스는 임시 슈퍼아머가 없어도 피해만 받고 경직되지 않는다', () => {
  for (const armour of [0, 2]) {
    const { r, e, f } = fixture('4-2');
    e.armourTime = armour;
    r.attacks = [
      {
        timer: 0,
        angle: Math.atan2(e.y - f.y, e.x - f.x),
        damage: 10,
        range: 200,
        arc: 2,
        thrust: false,
        heal: false,
      },
    ];
    tick(r, idle, 1 / 30);
    expect(e.hp).toBe(490);
    expect(e.staggerTime ?? 0).toBe(0);
  }
});
it('무진은 준비 자세 후 근접 연환봉으로 반격하며 장풍을 발사하지 않는다', () => {
  const { r, e, f } = fixture('4-4');
  e.guardTime = 2;
  e.facing = Math.atan2(f.y - e.y, f.x - e.x);
  r.attacks = [
    {
      timer: 0,
      angle: Math.atan2(e.y - f.y, e.x - f.x),
      damage: 10,
      range: 200,
      arc: 2,
      thrust: false,
      heal: false,
    },
  ];
  tick(r, idle, 1 / 30);
  expect(r.projectiles).toHaveLength(0);
  expect(e.state).toBe('windup');
  expect(e.move).toBe('combo');
  expect(f.hp).toBe(60);
  for (let n = 0; n < 60; n++) tick(r, idle, 1 / 60);
  expect(f.hp).toBeLessThan(60);
  expect(r.projectiles).toHaveLength(0);
});
it('적우의 베기가 실제 적중하면 독과 별개로 출혈을 남긴다', () => {
  const { r, e, f } = fixture('8-1');
  e.state = 'strike';
  e.move = 'slash';
  e.timer = 0.16;
  e.aim = Math.atan2(f.y - e.y, f.x - e.x);
  e.strike = { fromX: e.x, fromY: e.y, toX: e.x, toY: e.y, duration: 0.28, damage: 10, hit: false };
  tick(r, idle, 1 / 30);
  expect(f.hp).toBeLessThan(60);
  expect(f.bleedTime).toBe(3.2);
  expect(f.poisonTime ?? 0).toBe(0);
});
it('은폐 보스는 옆으로 잠복 이동하고 위치를 읽을 발자국을 남긴다', () => {
  for (const id of ['3-3', '5-1']) {
    const { r, e } = fixture(id);
    e.veilTime = 0.2;
    r.elapsed = 1.01;
    const x = e.x,
      y = e.y;
    stepBossBehavior(r, e, 0.1);
    expect(Math.hypot(e.x - x, e.y - y)).toBeGreaterThan(0);
    expect(r.effects.length).toBeGreaterThan(0);
  }
});
it('기관 지원 개체는 방어 깃발로 오인되지 않는다', () => {
  const { r, e, step } = fixture('9-2');
  signatureCast(r, e);
  step(0.6);
  const drone = r.encounterObjects!.find((o) => o.mechanic === 'drone')!;
  drone.x = e.x;
  drone.y = e.y;
  r.attacks = [
    {
      timer: 0,
      angle: Math.atan2(e.y - r.fighter.y, e.x - r.fighter.x),
      damage: 10,
      range: 200,
      arc: 2,
      thrust: false,
      heal: false,
    },
  ];
  tick(r, idle, 1 / 30);
  expect(e.hp).toBe(490);
});
it('노개는 좌우 비틀기와 후퇴를 따로 움직이며 연살의 저체력은 공격 회복을 줄인다', () => {
  const a = fixture('5-2');
  a.e.skillClock = 0.2;
  const x = a.e.x,
    y = a.e.y;
  stepBossBehavior(a.r, a.e, 0.1);
  expect(a.e.x !== x || a.e.y !== y).toBe(true);
  a.e.state = 'recover';
  a.e.move = 'thrust';
  a.e.timer = 0.35;
  const before = Math.hypot(a.e.x - a.f.x, a.e.y - a.f.y);
  stepBossBehavior(a.r, a.e, 0.1);
  expect(Math.hypot(a.e.x - a.f.x, a.e.y - a.f.y)).toBeGreaterThan(before);
  a.e.move = 'slam';
  const after = { x: a.e.x, y: a.e.y };
  stepBossBehavior(a.r, a.e, 0.1);
  expect({ x: a.e.x, y: a.e.y }).toEqual(after);
  const b = fixture('8-2'),
    normal = enemyAttack(b.e).recovery;
  b.e.hp = 100;
  b.step(0.1);
  expect(enemyAttack(b.e).recovery).toBeLessThan(normal);
});
it('건곤 안전지대는 다른 역할·방향으로 연속 이동한다', () => {
  const a = fixture('9-4');
  signatureCast(a.r, a.e);
  const o = a.r.encounterObjects![0];
  const x = o.x,
    y = o.y;
  a.step(2);
  expect(Math.hypot(o.x - x, o.y - y)).toBeGreaterThan(30);
  a.e.pattern = 1;
  signatureCast(a.r, a.e);
  expect(a.r.encounterObjects!.at(-1)!.stage).toBe(1);
});
for (const mode of [0, 1, 2])
  it(`연화의 독 계열은 독침·독분·독무로 구별된다: ${mode}`, () => {
    const { r, e } = fixture('1-3');
    e.pattern = mode;
    signatureCast(r, e);
    if (mode === 0)
      expect(r.projectiles.every((p) => p.status === 'poison' && p.visual === 'jade-needle')).toBe(
        true,
      );
    else expect(r.encounterObjects![0].mechanic).toBe(mode === 1 ? 'poison-powder' : 'poison-mist');
  });
for (const id of [
  '5-4',
  '8-4',
  '9-3',
  '9-1',
  '6-4',
  '9-2',
  '5-3',
  '7-4',
  '7-3',
  '4-2',
  '1-3',
  '6-1',
  '6-3',
  '4-3',
  '9-4',
])
  it(`중간 저장은 결정적으로 재개되며 소유자 처치로 모두 정리된다: ${id}`, () => {
    const { state, r, e, step } = fixture(id);
    signatureCast(r, e);
    step(1.4);
    expect(isGameSave(state)).toBe(true);
    const clone = structuredClone(state);
    tick(r, idle, 1 / 60);
    tick(clone.run!, idle, 1 / 60);
    expect(state).toEqual(clone);
    e.hp = 0;
    step(0.02);
    expect(r.encounterObjects).toHaveLength(0);
    expect(r.fighter.capturedTime ?? 0).toBe(0);
    spawnWave(r);
    expect(r.fighter.bleedTime).toBe(0);
    expect(r.fighter.freezeTime).toBe(0);
  });
