import { describe, expect, it } from 'vitest';
import { ART_WEAPONS, isPrep, makeItem, xpThreshold } from '../src/domain/content';
import { REGIONS, bossDefinition } from '../src/domain/campaign';
import { bossReward, canStack } from '../src/domain/boss-loot';
import { command, emptyGame, grantXp, random, spawnWave, startRun, tick } from '../src/domain/game';
import {
  ITEM_CATALOGUE,
  itemDefinition,
  itemValue,
  makeLootItem,
  REFINE_COST,
} from '../src/domain/items';
import { merchantSupplies, rollWaveLoot } from '../src/domain/loot';
import { compatibleWeapon } from '../src/domain/inventory';
import { isGameSave } from '../src/platform/save-validation';
import { messages } from '../src/platform/messages';
import type { ArtId, GameState, InputFrame } from '../src/domain/model';

const idle: InputFrame = { dx: 0, dy: 0, aim: 0, attack: false, ultimate: false, defense: false };
function fixture(seed = 123) {
  const state = emptyGame();
  startRun(state, '드랍 검증', seed);
  return state;
}
function choices(state: GameState) {
  while (state.run?.offers.length)
    expect(command(state, { type: 'choose', offer: state.run.offers[0] })).toBe(true);
}

it('52개 기본·지역 물품과 40개 보스 보상은 종류·칸·효과·번역을 제공한다', () => {
  expect(ITEM_CATALOGUE).toHaveLength(52);
  expect(new Set(ITEM_CATALOGUE.map((item) => item.id)).size).toBe(52);
  for (const definition of ITEM_CATALOGUE) {
    const item = makeLootItem(definition.id, definition.id, 'ground');
    expect(item.power).toBe(definition.power);
    expect(item.w * item.h).toBeGreaterThan(0);
    expect(itemValue(item)).toBeGreaterThan(0);
    expect(messages[item.name], item.name).toHaveLength(4);
  }
  for (let region = 0; region < 10; region++)
    for (let phase = 1; phase <= 4; phase++) {
      const item = bossReward(`${region}-${phase}`, 'boss')!;
      expect(item.originBoss).toBe(`${region}-${phase}`);
      expect(item.templateId).toBe(`boss-${region}-${phase}`);
      expect(messages[item.name], item.name).toHaveLength(4);
      if (item.kind !== 'ore') expect(item.power).toBeGreaterThan(0);
    }
  for (const [art, style] of Object.entries(ART_WEAPONS))
    for (let tier = 0; tier < 3; tier++) {
      expect(
        compatibleWeapon(makeLootItem(`weapon-${style}-${tier}`, 'weapon', 'weapon'), art as ArtId),
      ).toBe(true);
    }
});

describe('전 지역 드랍', () => {
  for (let region = 0; region < 10; region++)
    it(`${REGIONS[region].name}: 네 보스·일반 전투 드랍 보장`, () => {
      const r = fixture(region + 1).run!;
      r.regionRoute = Array(4).fill(REGIONS[region].name);
      for (let stage = 0; stage < 4; stage++) {
        r.wave = stage * 5 + 5;
        const items = rollWaveLoot(r, () => random(r));
        expect(items.filter((item) => item.kind === 'manual')).toHaveLength(1);
        expect(items.find((item) => item.kind === 'manual')!.power).toBe(20);
        expect(items.some((item) => item.kind === 'medicine')).toBe(true);
        expect(items.some((item) => item.templateId === `material-${region}`)).toBe(true);
        expect(items.some((item) => item.weaponStyle === 'sword')).toBe(true);
        expect(items.find((item) => item.originBoss)?.originBoss).toBe(bossDefinition(r)!.id);
        r.wave -= 2;
        const regular = rollWaveLoot(r, () => random(r));
        expect(regular).toHaveLength(3);
        expect(regular.some((item) => item.kind === 'manual')).toBe(false);
        expect(regular.some((item) => item.kind === 'medicine')).toBe(true);
        expect(regular.some((item) => item.kind === 'ore')).toBe(true);
      }
    });
});

it('저장된 난수에서 드랍이 같고, 종료 후 tick을 반복해도 재굴림하거나 추가하지 않는다', () => {
  const state = fixture(),
    r = state.run!;
  const clone = structuredClone(state);
  for (const current of [r, clone.run!]) {
    current.enemies.forEach((enemy) => {
      enemy.hp = 0;
    });
    tick(current, idle, 1 / 60);
  }
  expect(state).toEqual(clone);
  const ended = structuredClone(state);
  for (let n = 0; n < 30; n++) tick(r, idle, 1 / 60);
  expect(state).toEqual(ended);
  expect(isGameSave(state)).toBe(true);
});

it('200개 여정에서 드랍 장비 종류와 모든 특산품이 등장하며 비급 사용 후 Lv.13~16이다', () => {
  const styles = new Set(),
    regional = new Set(),
    templates = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const state = fixture(seed),
      r = state.run!;
    let manualXp = 0;
    for (let wave = 1; wave <= 20; wave++) {
      r.wave = wave;
      if (isPrep(wave)) continue;
      for (const item of rollWaveLoot(r, () => random(r))) {
        templates.add(item.templateId);
        if (item.kind === 'manual') manualXp += item.power;
        if (item.weaponStyle) styles.add(item.weaponStyle);
        if (item.templateId?.startsWith('regional-gear-')) regional.add(item.templateId);
      }
    }
    expect(manualXp).toBe(80);
    grantXp(r, r.xpBudget.reduce((sum, value) => sum + value, 0) + manualXp);
    expect(r.fighter.level).toBeGreaterThanOrEqual(13);
    expect(r.fighter.level).toBeLessThanOrEqual(16);
  }
  expect(styles.size).toBe(6);
  expect(regional.size).toBe(10);
  expect(ITEM_CATALOGUE.filter((item) => !templates.has(item.id)).map((item) => item.id)).toEqual(
    [],
  );
});

it('상인의 세 재고와 가격을 저장하고, 중복 구매/비급 판매/자금 부족을 거부한다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 14;
  spawnWave(r);
  r.gold = 100;
  const stock = r.supplies!;
  expect(stock).toHaveLength(3);
  expect(stock.map((entry) => itemDefinition(entry.templateId)?.kind)).not.toContain('manual');
  const entry = stock[1],
    gold = r.gold;
  expect(command(state, { type: 'buySupply', templateId: entry.templateId })).toBe(true);
  expect(r.gold).toBe(gold - entry.price);
  expect(entry.stock).toBe(0);
  expect(r.fighter.items.find((item) => item.templateId === entry.templateId)?.place).toBe('ground');
  const clone = structuredClone(state);
  expect(command(state, { type: 'buySupply', templateId: entry.templateId })).toBe(false);
  expect(command(state, { type: 'buySupply', templateId: 'manual-training' })).toBe(false);
  expect(state).toEqual(clone);
  r.gold = 0;
  const empty = structuredClone(state);
  expect(command(state, { type: 'buySupply', templateId: stock[0].templateId })).toBe(false);
  expect(state).toEqual(empty);
  expect(isGameSave(state)).toBe(true);
});

it('구매 경로가 달라도 회복약 재고와 가격을 공유하고 옛 저장도 같은 정비를 제공한다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 14;
  spawnWave(r);
  r.gold = 100;
  const entry = r.supplies![0],
    price = entry.price;
  expect(command(state, { type: 'buy', kind: 'medicine' })).toBe(true);
  expect(r.gold).toBe(100 - price);
  expect(entry.stock).toBe(2);
  expect(command(state, { type: 'buySupply', templateId: entry.templateId })).toBe(true);
  expect(r.merchantStock).toBe(1);
  expect(
    r.fighter.items.filter(
      (item) => item.place === 'ground' && item.templateId === entry.templateId,
    ),
  ).toHaveLength(1);
  expect(
    r.fighter.items.find((item) => item.place === 'ground' && item.templateId === entry.templateId)
      ?.count,
  ).toBe(2);
  r.supplies = undefined;
  // An old save already spent two supplies; reconstruct remaining quantities, never restock.
  const before = r.merchantStock;
  expect(command(state, { type: 'buy', kind: 'medicine' })).toBe(true);
  expect(r.merchantStock).toBe(before - 1);
});

it('보스 고유 재료는 강화에서 자동 소모하지 않으며 별도 판매 단가를 보장한다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 4;
  spawnWave(r);
  r.gold = 100;
  const material = bossReward('1-4', 'unique')!;
  material.place = 'ground';
  material.count = 10;
  r.fighter.items.push(material);
  const before = structuredClone(state);
  expect(command(state, { type: 'refine', id: r.fighter.items[0].id })).toBe(false);
  expect(state).toEqual(before);
  expect(itemValue(material)).toBe(24);
});

it('강화는 수납한 재료 두 개와 금전만 사용하며 두 번 뒤 거부하고 연결/물품 ID를 유지한다', () => {
  const state = fixture(),
    r = state.run!,
    f = r.fighter;
  r.wave = 4;
  spawnWave(r);
  r.gold = 100;
  const weapon = f.items[0],
    originalPower = weapon.power;
  const material = makeLootItem('material-0', 'material', 'ground');
  material.count = 5;
  f.items.push(material);
  const ground = makeLootItem('material-1', 'unclaimed', 'ground');
  ground.count = 20;
  f.items.push(ground);
  for (let n = 1; n <= 2; n++) {
    expect(command(state, { type: 'refine', id: weapon.id })).toBe(true);
    expect(weapon.power).toBe(originalPower + n);
    expect(weapon.upgrades).toBe(n);
    expect(material.count).toBe(5 - n * 2);
    expect(ground.count).toBe(20);
    expect(r.gold).toBe(100 - n * REFINE_COST.gold);
  }
  const before = structuredClone(state);
  expect(command(state, { type: 'refine', id: weapon.id })).toBe(false);
  expect(state).toEqual(before);
  expect(isGameSave(state)).toBe(true);
});

it.each(['combat', 'loot', 'dead'] as const)('%s에서는 정비 구매·강화·판매를 거부한다', (phase) => {
  const state = fixture(),
    r = state.run!;
  r.gold = 100;
  r.phase = phase;
  r.fighter.items.push(makeLootItem('material-0', 'material', 'ground'));
  const before = structuredClone(state);
  for (const cmd of [
    { type: 'buySupply', templateId: 'medicine-small' },
    { type: 'refine', id: r.fighter.items[0].id },
    { type: 'sellMaterial', id: 'material' },
  ] as const)
    expect(command(state, cmd)).toBe(false);
  expect(state).toEqual(before);
});

it('부족한 재료·금전과 성장 선택 중 거래는 원자적으로 실패한다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 4;
  spawnWave(r);
  r.gold = 100;
  const before = structuredClone(state);
  expect(command(state, { type: 'refine', id: r.fighter.items[0].id })).toBe(false);
  expect(state).toEqual(before);
  const material = makeLootItem('material-0', 'material', 'ground');
  material.count = 2;
  r.fighter.items.push(material);
  r.gold = 0;
  const poor = structuredClone(state);
  expect(command(state, { type: 'refine', id: r.fighter.items[0].id })).toBe(false);
  expect(state).toEqual(poor);
  grantXp(r, 20);
  const choosing = structuredClone(state);
  expect(command(state, { type: 'sellMaterial', id: material.id })).toBe(false);
  expect(state).toEqual(choosing);
});

it('재료는 표시된 단가×수량으로 판매하고, 장비·미수납 전리품 판매는 거부한다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 4;
  spawnWave(r);
  const material = makeLootItem('material-7', 'material', 'ground');
  material.count = 3;
  r.fighter.items.push(material);
  expect(command(state, { type: 'sellMaterial', id: material.id })).toBe(true);
  expect(r.gold).toBe(15);
  expect(r.fighter.items.find((item) => item.id === material.id)).toBeUndefined();
  expect(command(state, { type: 'sellMaterial', id: material.id })).toBe(false);
  expect(command(state, { type: 'sellMaterial', id: r.fighter.items[0].id })).toBe(false);
});

it('종류·등급·강화·템플릿이 다른 물품은 합치지 않고 오래된 물품끼리만 기존 중첩을 유지한다', () => {
  const material = makeLootItem('material-0', 'a', 'ground');
  expect(canStack(material, { ...material, id: 'b' })).toBe(true);
  for (const change of [
    { templateId: 'material-1' },
    { rarity: 'rare' as const },
    { upgrades: 1 },
    { quality: 90 },
  ])
    expect(canStack(material, { ...material, ...change })).toBe(false);
  const old = makeItem('ore', 'old', 'ground');
  expect(canStack(old, { ...old, id: 'old-2' })).toBe(true);
  const boss = bossReward('1-4', 'new')!;
  const legacyBoss = {
    ...boss,
    id: 'old-boss',
    templateId: undefined,
    rarity: undefined,
    upgrades: undefined,
  };
  expect(canStack(boss, legacyBoss)).toBe(true);
});

it('완주 정산·7일 수명·최근 기록은 한 번만 적용하며 사망 시 돈과 물품을 지급하지 않는다', () => {
  const state = fixture(),
    r = state.run!;
  r.wave = 20;
  r.phase = 'loot';
  r.gold = 83;
  r.fighter.hp = 47;
  expect(command(state, { type: 'next' }, 1800000000000)).toBe(true);
  expect(state.family.silver).toBe(83);
  expect(state.family.journeys?.[0]).toMatchObject({
    outcome: 'victory',
    gold: 83,
    items: 2,
    wave: 20,
  });
  expect(state.family.roster[0].hp).toBe(47);
  expect(state.family.roster[0].expiresAt).toBe(1800000000000 + 7 * 86400000);
  expect(command(state, { type: 'next' })).toBe(false);
  expect(state.family.silver).toBe(83);
  expect(isGameSave(state)).toBe(true);
  startRun(state, '다음 무인', 222);
  state.run!.phase = 'dead';
  state.run!.gold = 90;
  expect(command(state, { type: 'claim' })).toBe(true);
  expect(state.family.silver).toBe(83);
  expect(state.family.journeys?.[0]).toMatchObject({ outcome: 'dead', gold: 0, items: 0 });
  expect(command(state, { type: 'claim' })).toBe(false);
  expect(isGameSave(state)).toBe(true);
});

it('새 저장 필드가 없어도 이어가며 잘못된 템플릿·강화 횟수·가격·정산을 거부한다', () => {
  const state = fixture();
  const old = structuredClone(state);
  old.run!.fighter.items.forEach((item) => {
    delete item.templateId;
    delete item.rarity;
    delete item.upgrades;
  });
  expect(isGameSave(old)).toBe(true);
  const invalid = structuredClone(state);
  invalid.run!.fighter.items[0].templateId = 'unknown';
  expect(isGameSave(invalid)).toBe(false);
  invalid.run!.fighter.items[0].templateId = 'weapon-sword-0';
  invalid.run!.fighter.items[0].upgrades = 3;
  expect(isGameSave(invalid)).toBe(false);
  const corrupt = fixture();
  corrupt.run!.wave = 4;
  spawnWave(corrupt.run!);
  corrupt.run!.supplies![0].price = 0;
  expect(isGameSave(corrupt)).toBe(false);
  const badFunds = fixture();
  badFunds.family.silver = -1;
  expect(isGameSave(badFunds)).toBe(false);
});
