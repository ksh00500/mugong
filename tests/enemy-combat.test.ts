import { expect, it } from 'vitest';
import { emptyGame, startRun, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import { ENEMY_ROLES, ROLE_PROFILES, type EnemyRole } from '../src/domain/region-enemies';
import { isGameSave } from '../src/platform/save-validation';
import { movementFactor, stepEnvironment } from '../src/domain/environment';
import { cavalryRigPoint, sampleRig } from '../src/game/directional-motion';
import { fanOffset } from '../src/domain/enemy-geometry';
import { BOSS_ATTACKS } from '../src/domain/boss-attacks';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(role: EnemyRole) {
  const state = emptyGame();
  startRun(state, '적 공격 검사', 123);
  const r = state.run!,
    e = r.enemies[0],
    f = r.fighter;
  r.regionRoute = ['청하현', '독무곡', '천검산', '설산'];
  r.offers = [];
  r.zones = [];
  r.enemies = [e];
  Object.assign(e, {
    role,
    kind: ROLE_PROFILES[role].kind,
    bossId: undefined,
    x: 600,
    y: 500,
    state: 'approach',
    timer: 0,
    hp: 10000,
    maxHp: 10000,
    xp: 0,
    facing: 0,
    aim: 0,
  });
  f.x = 600 + (ROLE_PROFILES[role].distance || (ROLE_PROFILES[role].dash ? 180 : 65));
  f.y = 500;
  return { state, r, e, f };
}
function frames(r: ReturnType<typeof fixture>['r'], count: number) {
  for (let n = 0; n < count; n++) tick(r, idle, 1 / 60);
}
for (const role of ENEMY_ROLES)
  it(`${role}: 거리 유지·준비·공격·회복을 거쳐 멈춘 플레이어를 실제로 맞힌다`, () => {
    const { state, r, e, f } = fixture(role);
    let strike = false,
      recovery = false;
    for (let n = 0; n < 240; n++) {
      tick(r, idle, 1 / 60);
      strike ||= e.state === 'strike';
      recovery ||= e.state === 'recover';
      expect(Number.isFinite(e.x + e.y)).toBe(true);
      expect(isGameSave(state)).toBe(true);
    }
    expect(strike).toBe(true);
    expect(recovery).toBe(true);
    expect(f.hp).toBeLessThan(120);
  });
for (const role of ENEMY_ROLES)
  it(`${role}: 8방향 조준에서도 타격을 누락하지 않는다`, () => {
    for (let direction = 0; direction < 8; direction++) {
      const { r, e, f } = fixture(role);
      e.x = 960;
      e.y = 535;
      const reach = Math.min(
        260,
        ROLE_PROFILES[role].distance || (ROLE_PROFILES[role].dash ? 180 : 65),
      );
      f.x = e.x + Math.cos((direction * Math.PI) / 4) * reach;
      f.y = e.y + Math.sin((direction * Math.PI) / 4) * reach;
      frames(r, 220);
      expect(f.hp, `${role} direction ${direction}`).toBeLessThan(120);
    }
  });
it('짝수 발사 초식도 정조준 탄을 포함하고 다음 발사에서는 가장자리를 반대로 배치한다', () => {
  for (const count of [2, 4, 6]) {
    const left = Array.from({ length: count }, (_, n) => fanOffset(n, count, 0.2, 0));
    const right = Array.from({ length: count }, (_, n) => fanOffset(n, count, 0.2, 1));
    expect(left).toContain(0);
    expect(right).toContain(0);
    expect(new Set(left).size).toBe(count);
    expect(right).toEqual(left.map((n) => -n));
  }
});
for (let region = 0; region < 10; region++)
  for (let phase = 1; phase <= 4; phase++) {
    if (!BOSS_ATTACKS[region][phase - 1].sequence.includes('fan')) continue;
    it(`${region}-${phase}: 보스 조준 연사도 중앙 발사선을 유지한다`, () => {
      const { e } = fixture('raider');
      e.role = undefined;
      e.bossId = `${region}-${phase}`;
      e.aim = 0;
      const style = BOSS_ATTACKS[region][phase - 1];
      const pattern = style.sequence.indexOf('fan');
      e.pattern = pattern;
      expect(enemyAttack(e).shots.some((shot) => shot.angle === 0)).toBe(true);
    });
  }
for (const role of ['rider', 'assassin', 'icehunter'] as const)
  it(`${role}: 돌진은 프레임마다 움직이고 지나갈 때 한 번만 타격하며 중간 저장을 재개한다`, () => {
    const { state, r, e, f } = fixture(role);
    f.x = 800;
    Object.assign(e, { state: 'windup', timer: 0, targetX: 800, targetY: 500 });
    tick(r, idle, 1 / 60);
    expect(e.x).toBe(600);
    expect(f.hp).toBe(120);
    frames(r, 4);
    const copy = structuredClone(state);
    expect(e.x).toBeGreaterThan(600);
    expect(e.x).toBeLessThan(752);
    expect(f.hp).toBe(120);
    expect(isGameSave(copy)).toBe(true);
    const hp = [];
    let landing: number | undefined;
    for (let n = 0; n < 40; n++) {
      const x = e.x;
      tick(r, idle, 1 / 60);
      tick(copy.run!, idle, 1 / 60);
      expect(Math.abs(e.x - x)).toBeLessThan(35);
      hp.push(f.hp);
      if (e.state === 'recover' && landing === undefined) landing = e.x;
    }
    expect(state).toEqual(copy);
    expect(new Set(hp)).toHaveLength(2);
    expect(landing).toBe(role === 'rider' ? 860 : role === 'assassin' ? 820 : 800);
    expect(f.hp).toBeCloseTo(114.12);
  });
for (const role of ['bombardier', 'iceweaver', 'trapper', 'hexer', 'engineer'] as const)
  it(`${role}: 준비 중 플레이어를 조준하고 마지막 0.4초부터 착탄까지 목표를 고정한다`, () => {
    const { r, e, f } = fixture(role);
    tick(r, idle, 1 / 60);
    f.x = 1000;
    f.y = 650;
    frames(r, 12);
    expect(e.targetX).toBe(1000);
    expect(e.targetY).toBe(650);
    e.timer = 0.35;
    f.x = 1350;
    f.y = 350;
    frames(r, 25);
    expect(r.projectiles[0].landing).toMatchObject({ x: 1000, y: 650 });
  });
it('얼음 폭탄은 착탄 예고 후 폭발 피해·지속 피해·둔화를 주고 예고에서 벗어나면 폭발을 피한다', () => {
  const { r, e, f } = fixture('iceweaver');
  Object.assign(e, { state: 'windup', timer: 0, targetX: f.x, targetY: f.y });
  tick(r, idle, 1 / 60);
  e.timer = 100;
  frames(r, 40);
  expect(f.hp).toBe(120);
  expect(r.zones?.[0].impactDamage).toBeCloseTo(5.88);
  const dodge = structuredClone(r);
  dodge.fighter.x = 1500;
  frames(r, 15);
  frames(dodge, 15);
  expect(f.hp).toBeCloseTo(114.12);
  expect(dodge.fighter.hp).toBe(120);
  expect(movementFactor(r)).toBe(0.7);
  frames(r, 55);
  expect(f.hp).toBeLessThan(113);
  dodge.fighter.x = f.x;
  frames(dodge, 3);
  expect(dodge.fighter.hp).toBe(120); // Missed explosion cannot trigger later on entry.
});
it('설산 온기 영역은 피해가 없고 얼음 폭탄 영역은 지형 감속과 함께 적용된다', () => {
  const { r, f } = fixture('iceweaver');
  r.regionRoute![0] = '설산';
  r.regionRoute![3] = '폐사';
  r.zones = [{ id: 0, x: f.x, y: f.y, radius: 100, warning: 0, life: 100, pulse: 0, kind: 'cold' }];
  const damage: number[] = [];
  stepEnvironment(
    r,
    1,
    () => 0.5,
    (n) => damage.push(n),
  );
  expect(damage).toEqual([]);
  expect(movementFactor(r)).toBe(1);
  r.zones[0].id = 1;
  expect(movementFactor(r)).toBeCloseTo(0.56);
});
it('서역 회수환은 조준한 곳까지 날아가고 회수 중 움직인 발사자를 따라가서 사라진다', () => {
  const { r, e, f } = fixture('ringblade');
  Object.assign(e, { state: 'windup', timer: 0, aim: 0 });
  f.y = 800;
  tick(r, idle, 1 / 60);
  e.timer = 100;
  const p = r.projectiles[1];
  frames(r, 25);
  expect(p.returned).not.toBe(true);
  expect(p.x).toBeGreaterThan(750);
  frames(r, 75);
  expect(p.returned).toBe(true);
  e.x = 900;
  e.y = 650;
  tick(r, idle, 1 / 60);
  expect(Math.atan2(p.vy, p.vx)).toBeCloseTo(
    Math.atan2(e.y - (p.y - p.vy / 60), e.x - (p.x - p.vx / 60)),
  );
  frames(r, 100);
  expect(r.projectiles).not.toContain(p);
});
for (const role of ['guard', 'gatekeeper'] as const)
  it(`${role}: 넓어진 창끝의 경계 안에서는 맞고 바깥에서는 피한다`, () => {
    const { r, e, f } = fixture(role);
    Object.assign(e, { state: 'windup', timer: 0, aim: 0 });
    const profile = enemyAttack(e),
      radius = profile.range + 19;
    f.x = e.x + Math.cos(profile.arc - 0.01) * radius;
    f.y = e.y + Math.sin(profile.arc - 0.01) * radius;
    const outside = structuredClone(r);
    outside.fighter.x = e.x + Math.cos(profile.arc + 0.01) * radius;
    outside.fighter.y = e.y + Math.sin(profile.arc + 0.01) * radius;
    frames(r, 10);
    frames(outside, 10);
    expect(f.hp).toBeLessThan(120);
    expect(outside.fighter.hp).toBe(120);
  });
it('고속 적 탄은 한 프레임 사이에 플레이어를 지나가도 누락 없이 맞힌다', () => {
  const { r, e, f } = fixture('bowman');
  e.timer = 100;
  r.projectiles = [
    {
      x: f.x - 80,
      y: f.y,
      vx: 6000,
      vy: 0,
      life: 2,
      friendly: false,
      damage: 11,
      radius: 12,
      hits: [],
      owner: e.id,
    },
  ];
  tick(r, idle, 1 / 30);
  expect(f.hp).toBe(109);
});
it('기마 리그의 앞뒤 발굽은 서로 움직이고 움직임 줄이기에서도 판정 위치를 유지한다', () => {
  const pose = sampleRig('walk', 0, 0.25, 0);
  expect(cavalryRigPoint(0.25, 0.95, pose, 0).x).toBeLessThan(0.25);
  expect(cavalryRigPoint(0.75, 0.95, pose, 0).x).toBeGreaterThan(0.75);
  for (let d = 0; d < 8; d++) {
    expect(cavalryRigPoint(0.25, 0.95, sampleRig('walk', 0, 0.25, 0, true), d)).toEqual({
      x: 0.25,
      y: 0.95,
    });
    for (let n = 0; n < 60; n++) {
      const p = cavalryRigPoint(0.75, 0.95, sampleRig('walk', 0, n / 60, n), d);
      expect(Number.isFinite(p.x + p.y)).toBe(true);
    }
  }
});
