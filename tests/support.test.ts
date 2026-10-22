import { describe, expect, it } from 'vitest';
import { ART_IDS, ART_WEAPONS, makeWeapon } from '../src/domain/content';
import { command, emptyGame, startRun, tick } from '../src/domain/game';
import { hasWeapon } from '../src/domain/inventory';
import type { ArtId, BoundFighter, InputFrame } from '../src/domain/model';
import { ART_SUPPORTS, supportEffects, supportStats } from '../src/domain/support';
import { techniqueStats } from '../src/domain/techniques';
import { isGameSave } from '../src/platform/save-validation';
import { messages } from '../src/platform/messages';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(
  support?: ArtId,
  level = 2,
  active: ArtId = support === 'samja' ? 'huashan' : 'samja',
) {
  const state = emptyGame();
  startRun(state, '보조 검증', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  r.regionRoute = ['청하현', '설산', '독무곡', '천검산'];
  f.level = f.spent = r.spent = 16;
  f.arts = [{ id: active, level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
  if (support) f.arts.push({ id: support, level, gauge: 0, combo: 0, defenseCd: 0 });
  f.items = [makeWeapon(ART_WEAPONS[active], 'active-weapon', 'weapon')];
  f.bindings = { [active]: 'active-weapon' };
  r.enemies = [
    {
      ...r.enemies[0],
      x: f.x + 75,
      y: f.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      timer: 100,
      state: 'recover',
    },
  ];
  r.offers = [];
  return { state, r, f, e: r.enemies[0] };
}
function frames(r: ReturnType<typeof fixture>['r'], count: number, input = idle) {
  for (let i = 0; i < count; i++) tick(r, input, 1 / 60);
}
function strike(r: ReturnType<typeof fixture>['r']) {
  r.fighter.cooldown = 0;
  tick(r, { ...idle, attack: true }, 1 / 60);
  frames(r, 8);
}
function incoming(r: ReturnType<typeof fixture>['r'], amount = 10) {
  const f = r.fighter;
  r.projectiles.push({
    x: f.x,
    y: f.y,
    vx: 0,
    vy: 0,
    life: 1,
    friendly: false,
    damage: amount,
    radius: 12,
    hits: [],
  });
  tick(r, idle, 1 / 60);
}

describe('2성·4성은 배운 무공 전체를 보조한다', () => {
  for (const id of ART_IDS)
    it(`${id}: 1성 미해금, 2성 한 효과, 4성 두 효과 · 다섯 언어`, () => {
      expect(supportEffects(id, 1)).toEqual([]);
      expect(supportEffects(id, 2).map((e) => e.level)).toEqual([2]);
      expect(supportEffects(id, 3).map((e) => e.level)).toEqual([2]);
      expect(supportEffects(id, 4).map((e) => e.level)).toEqual([2, 4]);
      expect(supportEffects(id, 5)).toEqual(supportEffects(id, 4));
      for (const key of ART_SUPPORTS[id]) expect(messages[key], key).toHaveLength(4);
    });

  it('화산의 공격 간격·이동 속도가 무기를 연결하지 않은 다른 무공에 적용된다', () => {
    const base = fixture(),
      assisted = fixture('huashan', 4);
    expect(hasWeapon(assisted.f, 'huashan')).toBe(false);
    for (const { r } of [base, assisted]) tick(r, { ...idle, attack: true }, 1 / 60);
    expect(assisted.f.cooldown).toBeCloseTo(base.f.cooldown * 0.92);
    for (const { f } of [base, assisted]) f.actionTime = 0;
    const before = assisted.f.x,
      beforeBase = base.f.x;
    frames(base.r, 5, { ...idle, dx: 1 });
    frames(assisted.r, 5, { ...idle, dx: 1 });
    expect((assisted.f.x - before) / (base.f.x - beforeBase)).toBeCloseTo(1.08);
  });

  it('무당의 방어 재사용·충전 보조가 실제 방어와 적중에 반영된다', () => {
    const { r, f } = fixture('wudang', 4);
    tick(r, { ...idle, defense: true }, 1 / 60);
    expect(f.arts[0].defenseCd).toBeCloseTo(2.52);
    f.cooldown = 0;
    strike(r);
    expect(f.arts[0].gauge).toBeCloseTo(9 * 1.15);
    expect(f.arts[1].gauge).toBe(0);
  });

  it('천마의 저체력 공격은 조건부이며 처치 회복은 현재 무공과 관계없다', () => {
    const base = fixture(),
      assisted = fixture('tianmo', 4);
    base.f.hp = assisted.f.hp = 59;
    strike(base.r);
    strike(assisted.r);
    expect(10000 - assisted.e.hp).toBeCloseTo((10000 - base.e.hp) * 1.12);
    const full = fixture('tianmo', 2);
    strike(full.r);
    const normal = fixture();
    strike(normal.r);
    expect(full.e.hp).toBe(normal.e.hp);
    assisted.e.hp = 1;
    const hp = assisted.f.hp;
    strike(assisted.r);
    expect(assisted.f.hp).toBe(hp + 2);
  });

  it('삼재 2성 공격·4성 피해 경감은 모두 다른 무공으로 유지된다', () => {
    const base = fixture(undefined, 2, 'huashan'),
      assisted = fixture('samja', 4);
    strike(base.r);
    strike(assisted.r);
    expect(10000 - assisted.e.hp).toBeCloseTo((10000 - base.e.hp) * 1.08);
    assisted.f.invulnerable = 0;
    const hp = assisted.f.hp;
    incoming(assisted.r);
    expect(hp - assisted.f.hp).toBeCloseTo(9.2);
  });

  it('당문 보조는 근접 기본 공격에도 독을 붙이고 지속 피해가 재중첩·충전하지 않는다', () => {
    const { r, f, e } = fixture('tang', 2);
    strike(r);
    expect(e.poisonStacks).toBe(1);
    const gauge = f.arts[0].gauge,
      hp = e.hp;
    frames(r, 35);
    expect(e.hp).toBeLessThan(hp);
    expect(e.poisonStacks).toBe(1);
    expect(f.arts[0].gauge).toBe(gauge);
    expect(f.arts[1].gauge).toBe(0);
    for (let n = 0; n < 5; n++) strike(r);
    expect(e.poisonStacks).toBe(3);
  });

  it('당문 4성은 다섯 중첩까지 허용하고 마지막 타격으로 죽어도 주변에 전독한다', () => {
    const { r, e, f } = fixture('tang', 4);
    for (let n = 0; n < 6; n++) strike(r);
    expect(e.poisonStacks).toBe(5);
    const nearby = { ...e, id: e.id + 1, x: f.x + 190, hp: 10000, poisonStacks: 0, poisonTime: 0 };
    r.enemies.push(nearby);
    e.hp = 1;
    strike(r);
    expect(nearby.poisonStacks).toBe(3);
    expect(nearby.poisonLevel).toBe(4);
  });

  it('무공을 바꿔 약한 독을 추가해도 기존 강한 독을 낮추지 않고 만료 후에는 새 독으로 시작한다', () => {
    const { r, e } = fixture('tang', 4);
    Object.assign(e, { poisonStacks: 2, poisonTime: 2, poisonDamage: 12, poisonLevel: 4 });
    strike(r);
    expect(e.poisonDamage).toBe(12);
    expect(e.poisonStacks).toBe(3);
    e.poisonTime = 0;
    e.poisonStacks = 5;
    e.poisonTick = 0;
    const hp = e.hp;
    strike(r);
    expect(e.poisonStacks).toBe(1);
    expect(e.poisonDamage).toBeLessThan(12);
    expect(hp - e.hp).toBeLessThan(30);
  });

  it('삼재의 관통 기본 검기도 보조 독을 부여하지만 궁극 검기에는 독을 붙이지 않는다', () => {
    const { r, f, e } = fixture('tang', 2);
    f.arts[0].level = 10;
    strike(r);
    expect(e.poisonStacks).toBe(1);
    e.poisonStacks = 0;
    e.poisonTime = 0;
    f.arts[0].gauge = 100;
    f.cooldown = 0;
    tick(r, { ...idle, ultimate: true }, 1 / 60);
    frames(r, 8);
    expect(e.poisonStacks).toBe(0);
  });

  it('2성 선택 즉시 보조를 해금하고 서로 다른 보조를 곱으로 합친다', () => {
    const { state, r, f } = fixture('huashan', 1);
    f.level = 17;
    r.offers = [{ art: 'huashan', type: 'upgrade' }];
    expect(command(state, { type: 'choose', offer: r.offers[0] })).toBe(true);
    expect(techniqueStats('samja', 1, f).attackInterval).toBeCloseTo(0.43 * 0.92);
    f.arts.push({ id: 'shaolin', level: 2, gauge: 0, combo: 0, defenseCd: 0 });
    f.arts[0].level = 4;
    incoming(r);
    expect(f.hp).toBeCloseTo(120 - 10 * 0.92 * 0.9);
  });

  it('소림의 경감·경직 방지는 실제 공격 중 피격에 적용되며 무적은 아니다', () => {
    const { r, f } = fixture('shaolin', 4);
    tick(r, { ...idle, attack: true }, 1 / 60);
    incoming(r);
    expect(f.hp).toBeCloseTo(111);
    expect(f.action).toBe('attack');
    const base = fixture();
    tick(base.r, { ...idle, attack: true }, 1 / 60);
    incoming(base.r);
    expect(base.f.action).toBe('hurt');
  });

  it('개방은 다른 무공의 실제 공격 범위·공격 중 이동을 넓힌다', () => {
    const base = fixture(),
      assisted = fixture('gaebang', 4);
    base.e.x = base.f.x + 140;
    assisted.e.x = assisted.f.x + 140;
    strike(base.r);
    strike(assisted.r);
    expect(base.e.hp).toBe(10000);
    expect(assisted.e.hp).toBeLessThan(10000);
    for (const { f } of [base, assisted]) {
      f.action = 'attack';
      f.actionTime = 1;
    }
    const b = base.f.x,
      a = assisted.f.x;
    frames(base.r, 5, { ...idle, dx: 1 });
    frames(assisted.r, 5, { ...idle, dx: 1 });
    expect((assisted.f.x - a) / (base.f.x - b)).toBeCloseTo(0.8 / 0.65);
  });

  it('제갈은 적중·처치 시 현재 무공만 충전하고 100/200 상한을 지킨다', () => {
    const { r, f, e } = fixture('jegal', 4);
    strike(r);
    expect(f.arts[0].gauge).toBeCloseTo(9.9);
    e.hp = 1;
    strike(r);
    expect(f.arts[0].gauge).toBeCloseTo(27.8);
    expect(f.arts[1].gauge).toBe(0);
    const other = fixture('jegal', 4, 'gaebang');
    other.f.arts[0].gauge = 195;
    other.e.hp = 1;
    strike(other.r);
    expect(other.f.arts[0].gauge).toBe(200);
  });

  it('본인에게도 한 번만 적용하고 전환·왕복 저장으로 효과가 누적되지 않는다', () => {
    const { state, f } = fixture('huashan', 4);
    f.bindings!.huashan = 'active-weapon';
    const before = supportStats(f);
    expect(techniqueStats('huashan', 4, f).attackInterval).toBeCloseTo(0.4 * 0.92);
    for (let n = 0; n < 8; n++) expect(command(state, { type: 'switch', delta: 1 })).toBe(true);
    expect(supportStats(f)).toEqual(before);
    const loaded = JSON.parse(JSON.stringify(state));
    expect(isGameSave(loaded)).toBe(true);
    expect(supportStats(loaded.run.fighter)).toEqual(before);
    delete f.bindings!.huashan;
    expect(supportStats(f)).toEqual(before);
    f.active = 1;
    const sequence = f.attackSeq;
    tick(state.run!, { ...idle, attack: true }, 1 / 60);
    expect(f.attackSeq).toBe(sequence);
  });
});
