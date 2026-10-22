import { expect, it } from 'vitest';
import { emptyGame, spawnWave, startRun, tick } from '../src/domain/game';
import {
  encounterAttackRecovery,
  encounterHint,
  encounterMovementFactor,
  damageObject,
  signatureCast,
  stepEncounters,
} from '../src/domain/boss-encounters';
import { applyFieldContact, stepFieldStatuses } from '../src/domain/field-effects';
import { stepEnvironment } from '../src/domain/environment';
import { isGameSave } from '../src/platform/save-validation';
import { REGIONS } from '../src/domain/campaign';
import { messages } from '../src/platform/messages';

function fixture(region = 7, phase = 1) {
  const state = emptyGame();
  startRun(state, '', 123);
  const r = state.run!;
  r.regionRoute = REGIONS.filter((_, i) => i !== region)
    .slice(0, 3)
    .map((r) => r.name);
  r.regionRoute.splice(phase - 1, 0, REGIONS[region].name);
  r.wave = phase * 5;
  spawnWave(r);
  r.offers = [];
  const e = r.enemies[0],
    f = r.fighter;
  Object.assign(e, { x: 600, y: 300, timer: 1000, skillClock: 0 });
  const damage = (n: number) => {
    f.hp = Math.max(0, f.hp - n);
  };
  return { state, r, e, f, damage };
}
it.each([
  [7, 1, 0.55, 1],
  [5, 1, 1, 0.65],
  [3, 3, 0.7, 1],
  [5, 2, 1, 0.65],
])(
  '현재/이전 저장의 지역 %i 단계 %i 구역은 준비/발동/이탈을 구분한다',
  (region, phase, move, attack) => {
    const { r, e, f, damage } = fixture(region, phase);
    if (region === 7 || region === 3) e.y = 450;
    if (region === 5 && phase === 2) {
      // The boss no longer casts this; a field already present in an old save expires normally.
      r.encounterObjects = [
        {
          id: 1,
          owner: e.id,
          kind: 'mine',
          x: f.x,
          y: f.y,
          radius: 95,
          warning: 1.2,
          life: 7.2,
          hp: 0,
          maxHp: 0,
          pulse: 0,
          aim: 0,
        },
      ];
    } else signatureCast(r, e);
    const field = r.encounterObjects![0];
    if (region === 7 || region === 3) {
      expect(field.x).toBe(e.x);
      expect(field.y).toBe(e.y);
    }
    expect(encounterMovementFactor(r)).toBe(1);
    expect(encounterAttackRecovery(r)).toBe(1);
    f.x = field.x;
    f.y = field.y;
    stepEncounters(r, 1.21, damage);
    expect(encounterMovementFactor(r)).toBe(move);
    expect(encounterAttackRecovery(r)).toBe(attack);
    expect(messages[encounterHint(r)]).toHaveLength(4);
    if (region === 3) expect(f.hp).toBeLessThan(120);
    f.x = 1700;
    expect(encounterMovementFactor(r)).toBe(1);
    expect(encounterAttackRecovery(r)).toBe(1);
  },
);
it('독뢰는 12 피해 후 소멸하고 중독을 남기며 같은 설치물이 반복 폭발하지 않는다', () => {
  const { r, e, f, damage } = fixture(1, 2);
  signatureCast(r, e);
  stepEncounters(r, 1.21, damage);
  expect(f.hp).toBe(108);
  expect(f.poisonTime).toBe(2.4);
  const hp = f.hp;
  stepEncounters(r, 1, damage);
  expect(f.hp).toBe(hp);
});
it('이전 저장의 술은 직접 피해 없이 취기를 남기고 불길은 화상과 지속 피해를 준다', () => {
  const brew = fixture(4, 1);
  brew.r.encounterObjects = [
    {
      id: 1,
      owner: brew.e.id,
      kind: 'mine',
      x: brew.f.x,
      y: brew.f.y,
      radius: 95,
      warning: 1.2,
      life: 4.2,
      hp: 0,
      maxHp: 0,
      pulse: 0,
      aim: 0,
    },
  ];
  stepEncounters(brew.r, 1.21, brew.damage);
  expect(brew.f.hp).toBe(120);
  expect(brew.f.slowTime).toBe(2);
  const fire = fixture(6, 1);
  signatureCast(fire.r, fire.e);
  stepEncounters(fire.r, 1.21, fire.damage);
  expect(fire.f.hp).toBe(111);
  expect(fire.f.burnTime).toBe(1.6);
  fire.f.x = 1700;
  stepFieldStatuses(fire.r, 0.8, fire.damage);
  expect(fire.f.hp).toBe(107);
});
it('가시는 한 번 작동하고 위험 진법은 주기 피해와 감속을 준다', () => {
  const { r, f, damage } = fixture();
  for (const kind of ['trap', 'gate'] as const) {
    f.hp = 120;
    r.zones = [{ id: 1, x: f.x, y: f.y, kind, radius: 85, warning: 0, life: 5, pulse: 0 }];
    stepEnvironment(r, 0.01, () => 0.5, damage);
    expect(f.hp).toBe(kind === 'trap' ? 104 : 113);
    expect(r.zones).toHaveLength(kind === 'trap' ? 0 : 1);
  }
});
it('회피와 반격으로 막은 독 접촉은 중독을 남기지 않는다', () => {
  const { r, f, damage } = fixture();
  f.invulnerable = 1;
  applyFieldContact(r, 'poison', damage);
  expect(f.poisonTime ?? 0).toBe(0);
  f.invulnerable = 0;
  applyFieldContact(r, 'poison', () => {});
  expect(f.poisonTime ?? 0).toBe(0);
});
it('혈지대는 실제 잃은 체력만 흡혈하고 독 상태를 부여하지 않는다', () => {
  const { r, e, f, damage } = fixture(8);
  e.hp = 50;
  r.zones = [
    {
      id: 1,
      owner: e.id,
      x: f.x,
      y: f.y,
      kind: 'blood',
      radius: 85,
      warning: 0,
      life: 5,
      pulse: 0,
    },
  ];
  stepEnvironment(r, 0.01, () => 0.5, damage);
  expect(f.hp).toBe(114);
  expect(e.hp).toBeCloseTo(53.6);
  expect(f.poisonTime ?? 0).toBe(0);
});
it('정화초는 중독/화상도 제거하며 새 웨이브에는 상태 피해가 넘어가지 않는다', () => {
  const { r, e, f, damage } = fixture(1, 4);
  signatureCast(r, e);
  const herb = r.encounterObjects!.find((o) => o.kind === 'herb')!;
  Object.assign(f, { x: herb.x, y: herb.y, poisonTime: 2, burnTime: 1, fieldTick: 0.7 });
  damageObject(r, herb, 999);
  stepEncounters(r, 1.21, damage);
  expect([f.poisonTime, f.burnTime, f.fieldTick]).toEqual([0, 0, 0]);
  f.poisonTime = 2;
  spawnWave(r);
  expect(f.poisonTime).toBe(0);
});
it('상태 저장은 결정적으로 이어지고 선택/전투 종료 상태에서는 지속 피해가 멈춘다', () => {
  const { state, r, f } = fixture();
  f.poisonTime = 2.4;
  f.fieldTick = 0.5;
  const copy = structuredClone(state);
  const idle = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
  for (let n = 0; n < 30; n++) {
    tick(r, idle, 1 / 60);
    tick(copy.run!, idle, 1 / 60);
  }
  expect(state).toEqual(copy);
  expect(isGameSave(state)).toBe(true);
  r.phase = 'loot';
  const before = structuredClone(f);
  tick(r, idle, 1 / 30);
  expect(f).toEqual(before);
});
it('새 상태가 없는 과거 저장은 허용하고 비정상 타이머·혈지대 소유자는 거부한다', () => {
  const { state, r, f } = fixture();
  delete f.poisonTime;
  delete f.burnTime;
  delete f.fieldTick;
  expect(isGameSave(state)).toBe(true);
  f.poisonTime = Number.NaN;
  expect(isGameSave(state)).toBe(false);
  f.poisonTime = 1;
  r.zones = [
    { id: 1, owner: -1, x: f.x, y: f.y, kind: 'blood', radius: 85, warning: 0, life: 5, pulse: 0 },
  ];
  expect(isGameSave(state)).toBe(false);
});
it('발동한 먼지 안에 있는 보스만 은폐하며 죽은 소유자의 구역은 효과가 없다', () => {
  const { r, e, f, damage } = fixture();
  signatureCast(r, e);
  const object = r.encounterObjects![0];
  e.x = object.x + 400;
  stepEncounters(r, 1.21, damage);
  expect(e.veilTime ?? 0).toBe(0);
  e.x = object.x;
  e.y = object.y;
  stepEncounters(r, 0.01, damage);
  expect(e.veilTime).toBeGreaterThan(0);
  f.x = object.x;
  f.y = object.y;
  e.hp = 0;
  expect(encounterMovementFactor(r)).toBe(1);
  stepEncounters(r, 0.01, damage);
  expect(r.encounterObjects).toHaveLength(0);
});
