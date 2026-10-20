import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave, command, tick } from '../src/domain/game';
import { makeLootItem } from '../src/domain/items';
import { maximumHp, ART_WEAPONS } from '../src/domain/content';
import { healingOffer } from '../src/domain/preparation';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';
import type { ArtId, BoundFighter } from '../src/domain/model';

const idle = { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
function fixture(wave = 1) {
  const state = emptyGame();
  startRun(state, '밸런스 회귀 검사', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  r.wave = wave;
  spawnWave(r);
  r.offers = [];
  r.gold = 100;
  return { state, r, f };
}

for (const [wave, price] of [
  [4, 12],
  [9, 16],
  [14, 20],
  [19, 24],
])
  it(`${wave}웨이브 치료는 표시 가격만 차감하고 부족한 금액·최대 HP에서는 결제하지 않는다`, () => {
    const { state, r, f } = fixture(wave);
    f.hp = maximumHp(f) - 50;
    expect(healingOffer(f, r.gold, wave)).toMatchObject({ price, amount: 45, available: true });
    expect(command(state, { type: 'heal' })).toBe(true);
    expect(r.gold).toBe(100 - price);
    expect(f.hp).toBe(maximumHp(f) - 5);
    r.gold = price - 1;
    const before = structuredClone(state);
    expect(command(state, { type: 'heal' })).toBe(false);
    expect(state).toEqual(before);
    r.gold = price;
    expect(command(state, { type: 'heal' })).toBe(true);
    expect(f.hp).toBe(maximumHp(f));
    expect(r.gold).toBe(0);
    expect(isGameSave(state)).toBe(true);
  });

it('진행 중 보스 HP·장비 원본 수치는 재접속 시 재조정하지 않고 다음 보스부터 새 수치를 쓴다', () => {
  const { state, r, f } = fixture(5);
  Object.assign(r.enemies[0], { hp: 485, maxHp: 1000 });
  const items = structuredClone(f.items);
  expect(isGameSave(state)).toBe(true);
  const decoded = decodeCurrentSave(state)!;
  expect(decoded).not.toBeNull();
  expect(decoded.run!.enemies[0]).toMatchObject({ hp: 485, maxHp: 1000 });
  expect(decoded.run!.fighter.items.map((i) => i.power)).toEqual(items.map((i) => i.power));
  decoded.run!.wave = 10;
  spawnWave(decoded.run!);
  expect(decoded.run!.enemies[0]).toMatchObject({ hp: 1900, maxHp: 1900 });
  expect(r.enemies[0].hp).toBe(485);
});

it('이전 저장의 상점 가격과 재고를 유지하고 새 정비 구간에서만 단계별 가격을 만든다', () => {
  const { state, r } = fixture(19);
  r.supplies![0].price = 8;
  r.supplies![0].stock = 2;
  const decoded = decodeCurrentSave(state)!;
  expect(decoded).not.toBeNull();
  expect(command(decoded, { type: 'buySupply', templateId: r.supplies![0].templateId })).toBe(true);
  expect(decoded.run!.gold).toBe(92);
  expect(decoded.run!.supplies![0]).toMatchObject({ price: 8, stock: 1 });
  expect(r.supplies![0].stock).toBe(2);
  spawnWave(decoded.run!);
  expect(decoded.run!.supplies![0].price).toBe(16);
});

it('강한 갑옷도 실제 투사체의 35%를 남기고 방어·소림 궁극은 그 뒤에 경감한다', () => {
  function damage(guard = false, fortify = false) {
    const { r, f } = fixture();
    r.enemies.forEach((e) => {
      e.state = 'recover';
      e.timer = 100;
    });
    f.arts = [{ id: 'shaolin', level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
    f.innate = 'focus';
    f.invulnerable = 0;
    f.guard = guard ? 1 : 0;
    f.fortify = fortify ? 1 : 0;
    const robe = makeLootItem('gear-robe-2', 'test-armour', 'equipped');
    robe.power = 1000;
    f.items = [robe];
    r.projectiles = [
      {
        x: f.x,
        y: f.y - 34,
        vx: 0,
        vy: 0,
        life: 1,
        friendly: false,
        damage: 20,
        radius: 2,
        hits: [],
      },
    ];
    const hp = f.hp;
    tick(r, idle, 1 / 60);
    return hp - f.hp;
  }
  expect(damage()).toBeCloseTo(7);
  expect(damage(true)).toBeCloseTo(2.1);
  expect(damage(false, true)).toBeCloseTo(4.55);
});

it('실제 공격 중 원거리 이동에는 대가가 있고 개방 보조는 근접·원거리 모두 개선한다', () => {
  function distance(art: ArtId, assist = false) {
    const { r, f } = fixture();
    r.enemies.forEach((e) => {
      e.state = 'recover';
      e.timer = 100;
    });
    f.arts = [{ id: art, level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
    if (assist) f.arts.push({ id: 'gaebang', level: 4, gauge: 0, combo: 0, defenseCd: 0 });
    const weapon = makeLootItem(`weapon-${ART_WEAPONS[art]}-0`, 'test-weapon', 'weapon');
    f.items = [weapon];
    f.bindings = { [art]: weapon.id };
    f.active = 0;
    f.action = 'attack';
    f.actionTime = 1;
    f.cooldown = 2;
    const x = f.x;
    tick(r, { ...idle, dx: 1 }, 1 / 60);
    return f.x - x;
  }
  const melee = distance('huashan'),
    ranged = distance('tang');
  expect(ranged / melee).toBeCloseTo(0.8);
  expect(distance('jegal')).toBeCloseTo(ranged);
  expect(distance('tang', true) / ranged).toBeCloseTo(0.8 / 0.65);
  expect(distance('huashan', true) / melee).toBeCloseTo(0.8 / 0.65);
});
