import { expect, it } from 'vitest';
import { BOSSES, REGIONS, bossById } from '../src/domain/campaign';
import {
  bossDamageFactor,
  bossSignature,
  damageObject,
  recoveryFactor,
  signatureCast,
  stepEncounters,
} from '../src/domain/boss-encounters';
import { bossReward } from '../src/domain/boss-loot';
import { emptyGame, startRun, spawnWave, tick, command } from '../src/domain/game';
import { makeItem, xpThreshold } from '../src/domain/content';
import { isGameSave } from '../src/platform/save-validation';
import { messages } from '../src/platform/messages';
import type { InputFrame } from '../src/domain/model';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(id = '0-2') {
  const state = emptyGame();
  startRun(state, '', 124);
  const r = state.run!,
    boss = bossById(id)!;
  const route = REGIONS.filter((region) => region.name !== boss.region)
    .slice(0, 3)
    .map((region) => region.name);
  route.splice(boss.phase - 1, 0, boss.region);
  r.regionRoute = route;
  r.wave = boss.phase * 5;
  spawnWave(r);
  const e = r.enemies[0],
    f = r.fighter;
  Object.assign(e, { x: 800, y: 350, hp: 250, maxHp: 1000, xp: 0, timer: 100 });
  f.level = f.spent = r.spent = 16;
  f.xp = xpThreshold(16);
  r.offers = [];
  return { state, r, e, f };
}
function step(r: ReturnType<typeof fixture>['r'], count: number, damage = (_: number) => {}) {
  for (let n = 0; n < count; n++) stepEncounters(r, 1 / 60, damage);
}

for (let region = 0; region < 10; region++)
  for (let phase = 1; phase <= 4; phase++) {
    const id = `${region}-${phase}`;
    it(`${id} ${bossById(id)!.name}: 원문 전리품·번역·특수 상태가 저장된다`, () => {
      const { state, r, e } = fixture(id);
      const reward = bossReward(id, 'named-drop')!;
      expect(BOSSES.find((boss) => boss.name === bossById(id)!.name)!.loot).toContain(reward.name);
      expect(messages[reward.name]).toHaveLength(4);
      expect(reward.originBoss).toBe(id);
      r.fighter.items.push(reward);
      expect(bossSignature(e)).toBeTruthy();
      signatureCast(r, e);
      expect(isGameSave(state)).toBe(true);
      const clone = structuredClone(state);
      tick(r, idle, 1 / 60);
      tick(clone.run!, idle, 1 / 60);
      expect(state).toEqual(clone);
      expect(isGameSave(state)).toBe(true);
    });
  }

it('깃발을 파괴하면 방어 강화가 끝나며 다음 웨이브로 오브젝트가 넘어가지 않는다', () => {
  const { r, e } = fixture();
  signatureCast(r, e);
  step(r, 80);
  e.guardTime = 0;
  const flag = r.encounterObjects!.find((o) => o.kind === 'flag')!;
  expect(bossDamageFactor(r, e)).toBe(0.45);
  damageObject(r, flag, 999);
  expect(bossDamageFactor(r, e)).toBe(1);
  r.wave++;
  spawnWave(r);
  expect(r.encounterObjects).toEqual([]);
});

it('유지한 빙잠녀 연결은 예고 중 당기지 않고 거리 또는 회피로 끊는다', () => {
  const { r, e, f } = fixture('3-2');
  f.x = e.x + 250;
  f.y = e.y;
  signatureCast(r, e);
  const x = f.x;
  step(r, 30);
  expect(f.x).toBe(x);
  step(r, 60);
  expect(f.x).toBeLessThan(x);
  f.invulnerable = 0.2;
  step(r, 1);
  expect(r.encounterObjects).toHaveLength(0);
  f.invulnerable = 0;
  signatureCast(r, e);
  f.x = e.x + 500;
  step(r, 80);
  expect(r.encounterObjects).toHaveLength(0);
});

it('정화초를 공격해 파괴해야 주변 독지대와 회복 감소를 없애며 체력을 만들지 않는다', () => {
  const { r, e, f } = fixture('1-4');
  signatureCast(r, e);
  const herb = r.encounterObjects!.find((o) => o.kind === 'herb')!;
  f.hp = 70;
  f.healSuppression = 5;
  f.slowTime = 3;
  f.x = herb.x;
  f.y = herb.y;
  r.zones = [
    { id: 5, x: herb.x, y: herb.y, radius: 100, warning: 0, pulse: 1, life: 5, kind: 'poison' },
  ];
  step(r, 80);
  expect(f.healSuppression).toBe(5);
  damageObject(r, herb, 999);
  step(r, 1);
  expect(f.hp).toBe(70);
  expect(f.healSuppression).toBe(0);
  expect(f.slowTime).toBe(0);
  expect(r.zones[0].life).toBe(0);
  expect(r.encounterObjects?.some((o) => o.kind === 'mine')).toBe(false);
});

it('壁과 기관은 실제 공격으로 파괴할 수 있고, 벽의 충돌은 예고 이후에만 생긴다', () => {
  const { r, e, f } = fixture('6-2');
  signatureCast(r, e);
  const wall = r.encounterObjects![0];
  f.x = wall.x;
  f.y = wall.y;
  step(r, 30);
  expect(f.x).toBe(wall.x);
  step(r, 60);
  expect(Math.hypot(f.x - wall.x, f.y - wall.y)).toBeGreaterThan(wall.radius);
  f.x = wall.x - 105;
  f.y = wall.y;
  f.cooldown = 0;
  wall.hp = 1;
  tick(r, { ...idle, attack: true }, 1 / 60);
  for (let n = 0; n < 8; n++) tick(r, idle, 1 / 60);
  expect(wall.hp).toBe(0);
});

it('기관은 준비 시간 뒤에 고정한 방향으로 쏘고, 파괴하면 재사격과 수리가 멈춘다', () => {
  const { r, e, f } = fixture('6-3');
  signatureCast(r, e);
  step(r, 125);
  expect(r.projectiles).toHaveLength(0);
  step(r, 25);
  const aim = r.encounterObjects!.find((o) => o.kind === 'turret')!.aim;
  f.y += 200;
  step(r, 50);
  expect(r.projectiles).toHaveLength(2);
  expect(r.projectiles[0].vx).toBeCloseTo(Math.cos(aim) * 350);
  for (const object of r.encounterObjects!) damageObject(r, object, 999);
  r.projectiles = [];
  step(r, 220);
  expect(r.projectiles).toHaveLength(0);
});

it('회수 투사체는 예고 이후 발사되고 저장한 시점에 방향을 한 번만 바꾼다', () => {
  const { state, r, e } = fixture('7-2');
  signatureCast(r, e);
  step(r, 40);
  expect(r.projectiles).toHaveLength(0);
  step(r, 40);
  expect(r.projectiles).toHaveLength(3);
  const p = r.projectiles[0];
  p.x = e.x + 200;
  p.y = e.y;
  p.life = 1.3;
  tick(r, idle, 1 / 60);
  expect(p.returned).toBe(true);
  expect(p.vx).toBeLessThan(0);
  expect(isGameSave(state)).toBe(true);
});

it('회복 감소는 최근 손실 회복량에 적용되고 새 웨이브에서 해제된다', () => {
  const { r, f } = fixture('8-3');
  f.healSuppression = 3;
  expect(recoveryFactor(f)).toBe(0.5);
  f.healSuppression = 0;
  expect(recoveryFactor(f)).toBe(1);
  f.healSuppression = f.slowTime = 5;
  r.wave++;
  spawnWave(r);
  expect(f.healSuppression).toBe(0);
  expect(f.slowTime).toBe(0);
});

it('서로 다른 보스 재료는 중첩하지 않고 같은 출처·능력의 재료만 합친다', () => {
  const { state, r, f } = fixture();
  r.phase = 'loot';
  const a = bossReward('1-1', 'sac')!,
    b = bossReward('1-4', 'pearl')!,
    c = bossReward('1-1', 'sac2')!;
  f.items.push(a, b, c);
  [a, b, c].forEach((item, n) => Object.assign(item, { place: 'general', x: 7 + n, y: 7 }));
  for (const item of [a, b, c])
    expect(command(state, { type: 'moveItem', id: item.id, place: 'ground' })).toBe(true);
  expect(f.items.find((i) => i.id === a.id)?.count).toBe(2);
  expect(f.items.find((i) => i.id === b.id)?.count).toBe(1);
  expect(f.items.some((i) => i.id === c.id)).toBe(false);
  expect(isGameSave(state)).toBe(true);
});

it('보스 처치 뒤 원문 고유 전리품을 추가하고 비급 경험치 예산은 늘리지 않는다', () => {
  const { r, e } = fixture('9-4');
  e.hp = 0;
  tick(r, idle, 1 / 60);
  expect(r.phase).toBe('loot');
  expect(r.fighter.items.find((i) => i.originBoss === '9-4')?.name).toBe('팔괘선');
  expect(r.fighter.items.filter((i) => i.place === 'ground' && i.kind === 'manual')).toHaveLength(
    1,
  );
});

it('적 투사체는 적이 한 명이어도 무인에게 적중하고 아군 혼취 투사체는 무인에게 피해를 주지 않는다', () => {
  const { r, f } = fixture();
  r.projectiles = [
    { x: f.x, y: f.y, vx: 0, vy: 0, life: 2, friendly: false, damage: 10, radius: 10, hits: [] },
  ];
  tick(r, idle, 1 / 60);
  expect(f.hp).toBe(110);
  f.invulnerable = 0;
  const hp = f.hp;
  r.projectiles = [
    {
      x: f.x,
      y: f.y,
      vx: 0,
      vy: 0,
      life: 2,
      friendly: false,
      hostileToEnemies: true,
      damage: 10,
      radius: 10,
      hits: [],
    },
  ];
  tick(r, idle, 1 / 60);
  expect(f.hp).toBe(hp);
});

it('혼취된 일반 적은 다른 적을 공격하고 처치가 성장 선택을 열면 나머지 피해가 멈춘다', () => {
  const { r, e, f } = fixture();
  Object.assign(e, {
    bossId: undefined,
    kind: 'sword',
    x: 650,
    y: 500,
    state: 'windup',
    timer: 0,
    aim: 0,
    confused: 3,
  });
  r.enemies.push({
    ...e,
    id: e.id + 1,
    x: 700,
    hp: 1,
    xp: 3,
    timer: 10,
    state: 'approach',
    confused: 0,
  });
  f.level = f.spent = r.spent = 0;
  f.xp = xpThreshold(1) - 1;
  const hp = f.hp;
  tick(r, idle, 1 / 60);
  for (let n = 0; n < 6; n++) tick(r, idle, 1 / 60);
  expect(r.enemies[1].hp).toBe(0);
  expect(f.hp).toBe(hp);
  expect(r.offers.length).toBeGreaterThan(0);
});

it('매화난무는 세 적 사이를 실제로 이동하며 저장 후 같은 순서로 이어진다', () => {
  const { state, r, f, e } = fixture();
  e.bossId = undefined;
  f.arts = [{ id: 'huashan', level: 5, gauge: 100, combo: 0, defenseCd: 0 }];
  const sword = makeItem('sword', 'bound', 'weapon');
  f.items = [sword];
  Object.assign(f, { bindings: { huashan: sword.id } });
  r.enemies = [0, 1, 2].map((n) => ({
    ...e,
    id: 50 + n,
    x: f.x + 100 + n * 50,
    y: f.y,
    hp: 1000,
    maxHp: 1000,
  }));
  tick(r, { ...idle, ultimate: true }, 1 / 60);
  const x = f.x;
  const clone = structuredClone(state);
  expect(isGameSave(clone)).toBe(true);
  for (let n = 0; n < 30; n++) {
    tick(r, idle, 1 / 60);
    tick(clone.run!, idle, 1 / 60);
  }
  expect(f.x).not.toBe(x);
  expect(r.enemies.every((enemy) => enemy.hp < 1000)).toBe(true);
  expect(state).toEqual(clone);
  expect(isGameSave(state)).toBe(true);
});
