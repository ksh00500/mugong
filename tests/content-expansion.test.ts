import { describe, expect, it } from 'vitest';
import {
  ARTS,
  ART_IDS,
  ART_WEAPONS,
  makeItem,
  makeWeapon,
  xpThreshold,
} from '../src/domain/content';
import { BOSSES, REGIONS, bossById, bossDefinition } from '../src/domain/campaign';
import { command, eligibleOffers, emptyGame, spawnWave, startRun, tick } from '../src/domain/game';
import { enemyAttack } from '../src/domain/combat';
import { compatibleWeapon, firstSpace, hasWeapon } from '../src/domain/inventory';
import { movementFactor } from '../src/domain/environment';
import type { ArtId, BoundFighter, InputFrame } from '../src/domain/model';
import { isGameSave } from '../src/platform/save-validation';
import { messages } from '../src/platform/messages';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(id: ArtId = 'samja', level = 5) {
  const state = emptyGame();
  startRun(state, '콘텐츠 검증', 123);
  const r = state.run!,
    f = r.fighter;
  r.regionRoute = ['청하현', '독무곡', '천검산', '설산'];
  const weapon = makeWeapon(ART_WEAPONS[id], 'test-weapon', 'weapon');
  f.items = [weapon];
  f.arts = [{ id, level, gauge: 0, combo: 0, defenseCd: 0 }];
  (f as BoundFighter).bindings = { [id]: weapon.id };
  f.level = 16;
  f.spent = r.spent = 16;
  r.offers = [];
  r.enemies = [
    {
      ...r.enemies[0],
      role: undefined,
      x: f.x + 75,
      y: f.y,
      hp: 10000,
      maxHp: 10000,
      xp: 0,
      timer: 100,
    },
  ];
  return { state, r, f, art: f.arts[0], e: r.enemies[0] };
}
function frames(r: ReturnType<typeof fixture>['r'], count: number, input = idle) {
  for (let n = 0; n < count; n++) tick(r, input, 1 / 60);
}
function strike(r: ReturnType<typeof fixture>['r']) {
  tick(r, { ...idle, attack: true }, 1 / 60);
  frames(r, 30);
}

it('원문 10지역·40보스·45경지 이름이 누락 없이 연결되고 모든 이름에 네 번역이 있다', () => {
  expect(REGIONS).toHaveLength(10);
  expect(BOSSES).toHaveLength(40);
  expect(ART_IDS).toHaveLength(8);
  expect(new Set(BOSSES.map((b) => b.name)).size).toBe(40);
  for (const region of REGIONS)
    expect(BOSSES.filter((b) => b.region === region.name).map((b) => b.phase)).toEqual([
      1, 2, 3, 4,
    ]);
  for (const art of ART_IDS) expect(ARTS[art].stages).toHaveLength(ARTS[art].max);
  for (const name of [
    ...REGIONS.map((r) => r.name),
    ...BOSSES.map((b) => b.name),
    ...ART_IDS.flatMap((id) => [ARTS[id].name, ...ARTS[id].stages]),
  ])
    expect(messages[name], name).toHaveLength(4);
  expect(bossById('0-1')?.name).toBe('흑풍채주 마대봉');
  for (const invalid of ['0-01', '0-1-extra', '-1-1', '10-1', '0-5'])
    expect(bossById(invalid)).toBeNull();
});

it('20웨이브의 네 구간은 중복 없는 경로이며, 여러 생성에서 40보스 모두 등장할 수 있다', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 200; seed++) {
    const state = emptyGame();
    startRun(state, '', seed);
    const r = state.run!;
    expect(new Set(r.regionRoute).size).toBe(4);
    for (const wave of [5, 10, 15, 20]) {
      r.wave = wave;
      spawnWave(r);
      const b = bossDefinition(r)!;
      seen.add(b.id);
      expect(r.enemies).toHaveLength(1);
      expect(r.enemies[0].bossId).toBe(b.id);
      expect(b.phase).toBe(wave / 5);
      for (let pattern = 0; pattern < 3; pattern++) {
        r.enemies[0].pattern = pattern;
        expect(b.moves).toContain(enemyAttack(r.enemies[0]).move);
      }
      expect(isGameSave(state)).toBe(true);
    }
  }
  expect(seen.size).toBe(40);
});

it('보스 호출 공격은 실제로 두 명만 추가하며 전리품 경험치 예산을 늘리지 않는다', () => {
  const { r, e } = fixture();
  Object.assign(e, { bossId: '0-1', kind: 'chief', move: 'summon', state: 'windup', timer: 0.001 });
  tick(r, idle, 1 / 60);
  expect(r.enemies).toHaveLength(1); // Reinforcements arrive at the prepared contact, not release.
  for (let n = 0; n < 13; n++) tick(r, idle, 1 / 60);
  expect(r.enemies).toHaveLength(3);
  expect(r.enemies.slice(1).map((add) => add.xp)).toEqual([0, 0]);
  expect(enemyAttack(e).move).toBe('summon');
  Object.assign(e, { move: undefined, state: 'approach', pattern: 3 });
  expect(enemyAttack(e).move).toBe('slam');
});

describe('8계열의 실제 전투 행동과 무기 연결', () => {
  for (const id of ART_IDS)
    it(`${id}: 호환 무기로 실제 피해·방어·저장 검증`, () => {
      const { state, r, f, e } = fixture(id);
      expect(hasWeapon(f, id)).toBe(true);
      for (const other of ART_IDS)
        expect(compatibleWeapon(f.items[0], other)).toBe(ART_WEAPONS[id] === ART_WEAPONS[other]);
      strike(r);
      expect(e.hp).toBeLessThan(e.maxHp);
      tick(r, { ...idle, defense: true }, 1 / 60);
      expect(f.arts[0].defenseCd).toBeGreaterThan(0);
      expect(isGameSave(state)).toBe(true);
    });
});

it('당문 B는 세 침을 던지지만 같은 적에게 독 두 중첩만 추가하고 독 피해는 충전하지 않는다', () => {
  const { r, art, e } = fixture('tang', 3);
  art.combo = 1;
  tick(r, { ...idle, attack: true }, 1 / 60);
  frames(r, 6);
  expect(e.poisonStacks).toBe(2);
  const charged = art.gauge,
    hp = e.hp;
  frames(r, 35);
  expect(e.hp).toBeLessThan(hp);
  expect(art.gauge).toBe(charged);
  art.level = 5;
  art.gauge = 100;
  e.poisonStacks = 5;
  e.poisonTime = 3;
  tick(r, { ...idle, ultimate: true }, 1 / 60);
  expect(e.poisonStacks).toBe(2);
});

for (const source of ['poison', 'formation'])
  it(`${source} 처치로 성장 선택이 열리면 다른 지속 피해와 시간이 멈춘다`, () => {
    const { r, f, e } = fixture(source === 'poison' ? 'tang' : 'jegal');
    f.level = f.spent = r.spent = 0;
    f.xp = xpThreshold(1) - 1;
    Object.assign(e, { hp: 1, xp: 2 });
    const other = {
      ...e,
      id: e.id + 1,
      hp: 100,
      xp: 0,
      poisonStacks: 1,
      poisonTime: 3,
      poisonTick: 0,
      poisonDamage: 10,
    };
    r.enemies.push(other);
    r.formations = [{ x: e.x, y: e.y, life: 4, pulse: 0, pulses: 2, damage: 20, kind: 'earth' }];
    if (source === 'poison')
      Object.assign(e, { poisonStacks: 1, poisonTime: 3, poisonTick: 0, poisonDamage: 10 });
    else other.poisonTick = 1;
    tick(r, idle, 1 / 60);
    expect(r.offers.length).toBeGreaterThan(0);
    expect(other.hp).toBe(100);
    const frozen = structuredClone(r);
    tick(r, idle, 1 / 30);
    expect(r).toEqual(frozen);
  });

it('천마는 오래된 상처를 회복하지 않고 최근 손실만 되찾으며 강화의 체력 소모로 죽지 않는다', () => {
  const { r, art, f } = fixture('tianmo');
  f.hp = 60;
  strike(r);
  expect(f.hp).toBe(60);
  art.rally = 20;
  art.rallyTime = 4;
  strike(r);
  expect(f.hp).toBeGreaterThan(60);
  expect(art.rally).toBeLessThan(20);
  art.gauge = 100;
  f.cooldown = 0;
  f.hp = 1;
  tick(r, { ...idle, ultimate: true }, 1 / 60);
  frames(r, 120);
  expect(f.hp).toBe(1);
  expect(art.buffTime).toBeGreaterThan(0);
});

it('개방은 취기 한 칸으로 강화 한 번을 예약하고 두 예약을 소비하면 혼취를 건다', () => {
  const { state, r, art, e } = fixture('gaebang');
  art.gauge = 200;
  tick(r, { ...idle, ultimate: true }, 1 / 60);
  frames(r, 12);
  expect(art.gauge).toBe(100);
  expect(art.queuedBoosts).toBe(1);
  tick(r, { ...idle, ultimate: true }, 1 / 60);
  frames(r, 12);
  expect(art.gauge).toBe(0);
  expect(art.queuedBoosts).toBe(2);
  strike(r);
  strike(r);
  expect(art.queuedBoosts).toBe(0);
  expect(e.confused).toBeGreaterThan(0);
  expect(isGameSave(state)).toBe(true);
});

it('제갈 건진은 두 점으로 제한되고 곤진과 연결하면 두 번 진동한다', () => {
  const { state, r, art, e } = fixture('jegal', 4);
  for (let n = 0; n < 3; n++) {
    art.combo = 0;
    strike(r);
  }
  expect(r.formations?.filter((node) => node.kind === 'heaven')).toHaveLength(2);
  art.combo = 1;
  strike(r);
  expect(r.formations?.some((node) => node.kind === 'earth')).toBe(true);
  expect(r.formations?.some((node) => node.damage > 0)).toBe(true);
  const hp = e.hp;
  frames(r, 90);
  expect(e.hp).toBeLessThan(hp);
  expect(isGameSave(state)).toBe(true);
});

it('삼재는 Lv.5 궁극, Lv.8 세 초식, Lv.9 세 적 관통 검기로 성장한다', () => {
  const { r, art, e, f } = fixture('samja', 8);
  const variants: string[] = [];
  for (let n = 0; n < 3; n++) {
    tick(r, { ...idle, attack: true }, 1 / 60);
    variants.push(r.attacks[0].variant!);
    frames(r, 30);
  }
  expect(variants).toEqual(['a', 'b', 'c']);
  art.level = 9;
  r.enemies = [0, 1, 2, 3].map((n) => ({ ...e, id: e.id + n, x: f.x + 100 + n * 80, hp: 10000 }));
  strike(r);
  frames(r, 25);
  expect(r.enemies.filter((target) => target.hp < 10000)).toHaveLength(3);
});

it('신규 입문은 필요한 수련 무장을 연결하며 네 무공 이후 신규 후보가 사라진다', () => {
  const { state, r, f } = fixture();
  f.arts = [];
  f.items = [makeItem('sword', 'starter', 'weapon')];
  for (const id of ['tang', 'shaolin', 'gaebang', 'jegal'] as ArtId[]) {
    const offer = { art: id, type: 'learn' as const };
    r.offers = [offer];
    f.level++;
    expect(command(state, { type: 'choose', offer })).toBe(true);
    expect(hasWeapon(f, id)).toBe(true);
  }
  expect(f.arts).toHaveLength(4);
  expect(eligibleOffers(f).every((offer) => offer.type === 'upgrade')).toBe(true);
  expect(isGameSave(state)).toBe(true);
  const bound = (f as BoundFighter).bindings?.tang;
  r.phase = 'loot';
  expect(command(state, { type: 'moveItem', id: bound!, place: 'general' })).toBe(true);
  expect(hasWeapon(f, 'tang')).toBe(false);
});

it('설산 화롯불·독지대 판정을 유지하고 혈마전에 제단을 생성하지 않는다', () => {
  const { state, r, f } = fixture();
  r.regionRoute = ['설산', '독무곡', '혈마전', '팔진고성'];
  spawnWave(r);
  expect(movementFactor(r)).toBe(1);
  f.x = 300;
  expect(movementFactor(r)).toBe(0.8);
  r.wave = 6;
  spawnWave(r);
  r.zoneClock = 7.99;
  tick(r, idle, 1 / 60);
  const zone = r.zones![0];
  expect(zone.kind).toBe('poison');
  expect(zone.warning).toBeGreaterThan(1);
  f.x = zone.x;
  f.y = zone.y;
  const hp = f.hp;
  frames(r, 60);
  expect(f.hp).toBe(hp);
  frames(r, 40);
  expect(f.hp).toBeLessThan(hp);
  r.wave = 11;
  spawnWave(r);
  expect(r.zones).toEqual([]);
  f.x = 1250;
  f.y = 520;
  const gold = r.gold;
  const health = r.enemies.map((enemy) => enemy.maxHp);
  tick(r, idle, 1 / 60);
  expect(r.gold).toBe(gold);
  expect(r.enemies.map((enemy) => enemy.maxHp)).toEqual(health);
  expect(isGameSave(state)).toBe(true);
});
