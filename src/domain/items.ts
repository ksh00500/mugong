import { makeItem, makeWeapon } from './content';
import { statPrecision } from './balance';
import type { Item, ItemKind, WeaponStyle } from './model';

export type Rarity = NonNullable<Item['rarity']>;
export interface ItemDefinition {
  id: string;
  name: string;
  kind: ItemKind;
  style?: WeaponStyle;
  rarity: Rarity;
  power: number;
  value: number;
  region?: number;
}
export const RARITY_NAMES: Record<Rarity, string> = {
  common: '일반 등급',
  refined: '정련',
  rare: '희귀',
  heroic: '영웅',
};
export const WEAPON_STYLES: WeaponStyle[] = ['sword', 'dao', 'dart', 'gauntlet', 'staff', 'fan'];
const weaponNames: Record<WeaponStyle, string[]> = {
  sword: ['수련검', '강철검', '청운검'],
  dao: ['수련도', '강철도', '흑월도'],
  dart: ['수련 암기', '강철 독침', '청린 독침'],
  gauntlet: ['수련 권갑', '철권갑', '금강 권갑'],
  staff: ['수련봉', '철심봉', '송풍봉'],
  fan: ['수련 부채', '철골선', '기문선'],
};
const rarities: Rarity[] = ['common', 'refined', 'rare'];
const weapons = WEAPON_STYLES.flatMap((style) =>
  weaponNames[style].map((name, tier) => ({
    id: `weapon-${style}-${tier}`,
    name,
    kind: 'sword' as const,
    style,
    rarity: rarities[tier],
    power: [3, 6, 9][tier],
    value: [5, 12, 24][tier],
  })),
);
const gear = (['robe', 'boots', 'charm'] as const).flatMap((kind) => {
  const names = {
    robe: ['무명 도포', '정련 도포', '청강 도포'],
    boots: ['경량 가죽신', '유운화', '비연화'],
    charm: ['청옥 패옥', '백옥 패옥', '명경 패옥'],
  };
  const powers = { robe: [1, 2, 3], boots: [1, 2, 3], charm: [2, 4, 6] };
  return names[kind].map((name, tier) => ({
    id: `gear-${kind}-${tier}`,
    name,
    kind,
    rarity: rarities[tier],
    power: powers[kind][tier],
    value: [4, 10, 20][tier],
  }));
});
// Region order follows the uploaded workbook. These extend its themes, not its boss names.
const regionGear: [string, 'robe' | 'boots' | 'charm', number][] = [
  ['표국 도포', 'robe', 3],
  ['청린 패옥', 'charm', 6],
  ['검객 패옥', 'charm', 6],
  ['설산 털신', 'boots', 3],
  ['나한 도포', 'robe', 3],
  ['죽엽 경화', 'boots', 3],
  ['월광 패옥', 'charm', 6],
  ['대상단 장화', 'boots', 3],
  ['혈문 도포', 'robe', 3],
  ['팔진 패옥', 'charm', 6],
];
const materialNames = [
  '정련철',
  '독초',
  '청강석',
  '빙잠실',
  '금강사',
  '청죽',
  '고옥 파편',
  '서역 향료',
  '혈옥 조각',
  '기관 부품',
];
export const ITEM_CATALOGUE: ItemDefinition[] = [
  ...weapons,
  ...gear,
  ...regionGear.map(([name, kind, power], region) => ({
    id: `regional-gear-${region}`,
    name,
    kind,
    power,
    region,
    rarity: 'rare' as const,
    value: 22,
  })),
  { id: 'medicine-small', name: '금창약', kind: 'medicine', rarity: 'common', power: 35, value: 4 },
  {
    id: 'medicine-medium',
    name: '상급 금창약',
    kind: 'medicine',
    rarity: 'refined',
    power: 50,
    value: 7,
  },
  { id: 'medicine-large', name: '대환단', kind: 'medicine', rarity: 'rare', power: 70, value: 11 },
  {
    id: 'medicine-snow',
    name: '설삼',
    kind: 'medicine',
    rarity: 'refined',
    power: 50,
    value: 7,
    region: 3,
  },
  {
    id: 'manual-training',
    name: '수련 비급',
    kind: 'manual',
    rarity: 'refined',
    power: 20,
    value: 8,
  },
  ...materialNames.map((name, region) => ({
    id: `material-${region}`,
    name,
    kind: 'ore' as const,
    power: 0,
    region,
    rarity: 'common' as const,
    value: region === 7 || region === 8 ? 5 : 3,
  })),
];
const catalogue = new Map(ITEM_CATALOGUE.map((item) => [item.id, item]));
export function itemDefinition(id?: string) {
  return id ? catalogue.get(id) : undefined;
}
export function itemIdentity(item: Item) {
  return (
    item.templateId ??
    (item.originBoss
      ? `boss-${item.originBoss}`
      : ITEM_CATALOGUE.find(
          (definition) =>
            definition.name === item.name &&
            definition.kind === item.kind &&
            definition.style === item.weaponStyle,
        )?.id)
  );
}
export function itemRarity(item: Item): Rarity {
  const phase = item.originBoss && Number(item.originBoss.split('-')[1]);
  return (
    item.rarity ??
    (phase
      ? phase === 4
        ? 'heroic'
        : phase === 1
          ? 'refined'
          : 'rare'
      : itemDefinition(itemIdentity(item))?.rarity) ??
    'common'
  );
}
export function makeLootItem(
  templateId: string,
  id: string,
  place: Item['place'],
  quality = 100,
): Item {
  const definition = itemDefinition(templateId);
  if (!definition) throw new Error(`Unknown item template: ${templateId}`);
  const item = definition.style
    ? makeWeapon(definition.style, id, place, quality)
    : makeItem(definition.kind, id, place, quality);
  return {
    ...item,
    templateId,
    name: definition.name,
    rarity: definition.rarity,
    power: refinable(item)
      ? statPrecision((definition.power * quality) / 100)
      : Math.round((definition.power * quality) / 100),
    upgrades: 0,
  };
}
export function itemValue(item: Item) {
  if (item.originBoss && item.kind === 'ore') return 6 * Number(item.originBoss.split('-')[1]);
  const base =
    itemDefinition(item.templateId)?.value ??
    { sword: 12, robe: 10, boots: 8, charm: 10, medicine: 4, manual: 8, ore: 3 }[item.kind];
  return Math.max(1, Math.round((base * item.quality) / 100));
}
export function stackable(item: Item) {
  return ['medicine', 'manual', 'ore'].includes(item.kind);
}
export function isRefiningMaterial(item: Item) {
  return item.kind === 'ore' && !item.originBoss && itemRarity(item) === 'common';
}
export function refinable(item: Item) {
  return ['sword', 'robe', 'boots', 'charm'].includes(item.kind);
}
export const REFINE_COST = { gold: 12, materials: 2, limit: 2 };
/** Refining is a small fixed improvement; it neither changes weapon class nor re-rolls the item. */
export function refinePreview(item: Item) {
  return refinable(item) && (item.upgrades ?? 0) < REFINE_COST.limit
    ? { power: statPrecision(item.power + 1), quality: Math.min(120, item.quality + 10) }
    : null;
}
