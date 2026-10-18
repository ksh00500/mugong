import { expect, it } from 'vitest';
import { emptyGame, spawnWave, startRun, tick } from '../src/domain/game';
import { BOSS_ATTACKS } from '../src/domain/boss-attacks';
import { REGIONS } from '../src/domain/campaign';
import { REGION_ROSTERS, ROLE_PROFILES, retreatVector } from '../src/domain/region-enemies';
import { dashHits, enemyAttack } from '../src/domain/combat';
import { bossDamageFactor } from '../src/domain/boss-encounters';
import { isGameSave } from '../src/platform/save-validation';
import { xpThreshold } from '../src/domain/content';
const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(region: number, wave = 1) {
  const state = emptyGame();
  startRun(state, '지역 패턴', 123);
  const r = state.run!;
  const route = REGIONS.filter((_, i) => i !== region)
    .slice(0, 3)
    .map((r) => r.name);
  route.splice(Math.floor((wave - 1) / 5), 0, REGIONS[region].name);
  r.regionRoute = route;
  r.wave = wave;
  spawnWave(r);
  r.fighter.level = r.fighter.spent = r.spent = 16;
  r.fighter.xp = xpThreshold(16);
  r.offers = [];
  return { state, r, e: r.enemies[0], f: r.fighter };
}
for (let region = 0; region < 10; region++)
  it(`${REGIONS[region].name}: 역할 구성·XP 총량·저장 재개가 유지된다`, () => {
    const { state, r } = fixture(region, 3);
    expect(r.enemies.map((e) => e.role)).toEqual(
      REGION_ROSTERS[REGIONS[region].name].slice(0, r.enemies.length),
    );
    expect(r.enemies.reduce((n, e) => n + e.xp, 0)).toBe(r.xpBudget[2]);
    expect(isGameSave(state)).toBe(true);
    const copy = structuredClone(state);
    for (let i = 0; i < 180; i++) {
      tick(r, idle, 1 / 60);
      tick(copy.run!, idle, 1 / 60);
    }
    expect(state).toEqual(copy);
    expect(isGameSave(state)).toBe(true);
  });
it('당가는 원거리 비중이 5/6이고 서역은 기마·암살·회수환이 함께 등장한다', () => {
  const tang = REGION_ROSTERS['독무곡'];
  expect(tang.filter((role) => ROLE_PROFILES[role].distance > 0)).toHaveLength(5);
  expect(REGION_ROSTERS['서역사막']).toEqual([
    'rider',
    'assassin',
    'ringblade',
    'rider',
    'ringblade',
  ]);
});
it('독병은 고정한 목표로 날아간 뒤 예고·독 지대·만료가 이어진다', () => {
  const { state, r, e, f } = fixture(1);
  r.enemies = [e];
  Object.assign(e, {
    role: 'bombardier',
    kind: 'archer',
    x: 600,
    y: 500,
    state: 'windup',
    timer: 0,
    aim: 0,
    targetX: 900,
    targetY: 500,
  });
  f.x = 900;
  f.y = 500;
  tick(r, idle, 1 / 60);
  expect(r.projectiles[0]).toMatchObject({
    visual: 'poison-bomb',
    landing: { x: 900, y: 500, radius: 100, kind: 'poison' },
  });
  expect(f.hp).toBe(120);
  expect(isGameSave(state)).toBe(true);
  e.state = 'recover';
  e.timer = 100;
  for (let i = 0; i < 37; i++) tick(r, idle, 1 / 60);
  expect(r.zones).toEqual([]);
  for (let i = 0; i < 4; i++) tick(r, idle, 1 / 60);
  expect(r.zones?.[0]).toMatchObject({ x: 900, y: 500, kind: 'poison' });
  expect(f.hp).toBe(120);
  for (let i = 0; i < 20; i++) tick(r, idle, 1 / 60);
  expect(f.hp).toBeLessThan(120);
  f.x = 1400;
  for (let i = 0; i < 260; i++) tick(r, idle, 1 / 60);
  expect(r.zones).toEqual([]);
});
it('원거리 적은 근접 시 후퇴하고 암살자는 측면으로 접근한다', () => {
  const { e } = fixture(1);
  Object.assign(e, { role: 'needle', x: 800, y: 500 });
  expect(retreatVector(e, { x: 850, y: 500 })!.x).toBeLessThan(0);
  e.role = 'assassin';
  const v = retreatVector(e, { x: 1100, y: 500 })!;
  expect(v.x).toBeGreaterThan(0);
  expect(Math.abs(v.y)).toBeGreaterThan(0);
});
it('혼취된 투척자의 폭탄은 다른 적에게 피해를 주고 무인에게 독 지대를 남기지 않는다', () => {
  const { state, r, e, f } = fixture(1);
  const target = {
    ...e,
    id: e.id + 1,
    role: undefined,
    kind: 'sword' as const,
    x: 900,
    y: 500,
    hp: 100,
    maxHp: 100,
    state: 'recover' as const,
    timer: 100,
  };
  r.enemies = [e, target];
  Object.assign(e, {
    role: 'bombardier',
    kind: 'archer',
    confused: 10,
    x: 600,
    y: 500,
    state: 'windup',
    timer: 0,
    aim: 0,
    targetX: 900,
    targetY: 500,
  });
  f.x = 900;
  f.y = 500;
  tick(r, idle, 1 / 60);
  expect(r.projectiles[0].hostileToEnemies).toBe(true);
  expect(isGameSave(state)).toBe(true);
  e.state = 'recover';
  e.timer = 100;
  for (let i = 0; i < 45; i++) tick(r, idle, 1 / 60);
  expect(target.hp).toBeLessThan(100);
  expect(r.zones).toEqual([]);
  expect(f.hp).toBe(120);
});
it('기마 돌진 경로 안만 피해를 받고 잠근 방향은 뒤따라 바뀌지 않는다', () => {
  const { r, e, f } = fixture(7);
  r.enemies = [e];
  Object.assign(e, {
    role: 'rider',
    kind: 'spear',
    x: 600,
    y: 500,
    state: 'windup',
    timer: 0,
    aim: 0,
  });
  f.x = 780;
  f.y = 500;
  const copy = structuredClone(r);
  copy.fighter.y = 550;
  tick(r, idle, 1 / 60);
  tick(copy, idle, 1 / 60);
  expect(e.x).toBe(600);
  expect(f.hp).toBe(120);
  for (let n = 0; n < 35; n++) {
    tick(r, idle, 1 / 60);
    tick(copy, idle, 1 / 60);
  }
  expect(f.hp).toBeLessThan(120);
  expect(copy.fighter.hp).toBe(120);
  expect(e.x).toBe(970);
  expect(e.y).toBe(500);
  expect(dashHits({ x: 600, y: 500 }, { x: 970, y: 500 }, { x: 780, y: 550 })).toBe(false);
});
it('호위의 정면 방어는 측후방 공략으로 우회한다', () => {
  const { r, e, f } = fixture(0);
  Object.assign(e, { role: 'guard', guardTime: 1, x: 600, y: 500, facing: 0 });
  f.x = 700;
  f.y = 500;
  expect(bossDamageFactor(r, e)).toBe(0.45);
  f.x = 500;
  expect(bossDamageFactor(r, e)).toBe(1);
});
for (let region = 0; region < 10; region++)
  for (let phase = 1; phase <= 4; phase++)
    it(`${region}-${phase}: 개인 공격 전 순서·투사체·위험 지대가 저장 가능하다`, () => {
      const { state, r, e, f } = fixture(region, phase * 5);
      const style = BOSS_ATTACKS[region][phase - 1];
      r.zones = [];
      r.encounterObjects = [];
      e.x = 600;
      e.y = 400;
      f.x = 1500;
      f.y = 750;
      for (let pattern = 0; pattern < style.sequence.length; pattern++) {
        e.pattern = pattern;
        e.move = undefined;
        e.state = 'approach';
        const profile = enemyAttack(e);
        expect(profile.move).toBe(style.sequence[pattern]);
        Object.assign(e, {
          state: 'windup',
          timer: 0,
          aim: 0,
          targetX: 1500,
          targetY: 750,
          move: profile.move,
        });
        r.projectiles = [];
        r.zones = [];
        tick(r, idle, 1 / 60);
        if (profile.melee?.shot || profile.melee?.zone) {
          expect(r.projectiles).toHaveLength(0);
          for (let n = 0; n < Math.ceil(profile.melee.contacts[0] * 60) + 1; n++)
            tick(r, idle, 1 / 60);
        }
        if (profile.ranged) {
          expect(r.projectiles).toHaveLength(profile.melee?.zone ? 1 : profile.shots.length);
          if (!profile.melee?.zone)
            expect(r.projectiles.map((p) => p.delay ?? 0)).toEqual(
              profile.shots.map((s) => Math.max(0, s.delay - 1 / 60)),
            );
        }
        if (profile.melee?.zone) expect(r.projectiles[0].landing).toMatchObject(profile.melee.zone);
        if (profile.move === 'hazard' && profile.zone)
          expect(r.projectiles[0].landing).toMatchObject({
            radius: profile.radius,
            kind: profile.zone,
          });
        expect(isGameSave(state)).toBe(true);
      }
    });
it('40보스는 서로 다른 초식·범위·간격 조합을 갖는다', () => {
  expect(new Set(BOSS_ATTACKS.flat().map((s) => JSON.stringify(s))).size).toBe(40);
});
