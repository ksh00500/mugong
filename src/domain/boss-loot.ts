import { bossById } from './campaign';
import { makeItem, makeWeapon } from './content';
import type { Item, ItemKind, WeaponStyle } from './model';
import { itemIdentity, itemRarity } from './items';

// Named rewards are the concrete items in the uploaded workbook, not invented drops.
const rewards: [string, ItemKind, WeaponStyle?][][] = [
  [
    ['정련 무기', 'sword', 'sword'],
    ['표국금패', 'charm'],
    ['철쇄 장신구', 'charm'],
    ['패도환', 'charm'],
  ],
  [
    ['독낭', 'ore'],
    ['독침함', 'sword', 'dart'],
    ['오독패', 'charm'],
    ['만독주', 'ore'],
  ],
  [
    ['청강검', 'sword', 'sword'],
    ['쌍검패', 'charm'],
    ['검심옥', 'charm'],
    ['천검편', 'ore'],
  ],
  [
    ['설피갑', 'robe'],
    ['빙잠사', 'ore'],
    ['설산호심경', 'robe'],
    ['빙옥패', 'charm'],
  ],
  [
    ['권갑', 'sword', 'gauntlet'],
    ['철나한갑', 'robe'],
    ['사리호심경', 'charm'],
    ['금강권갑', 'sword', 'gauntlet'],
  ],
  [
    ['경량 장비', 'boots'],
    ['취죽봉', 'sword', 'staff'],
    ['청죽패', 'charm'],
    ['송풍패', 'charm'],
  ],
  [
    ['묘문열쇠', 'ore'],
    ['고옥패', 'charm'],
    ['기관핵', 'ore'],
    ['월령옥', 'charm'],
  ],
  [
    ['곡도', 'sword', 'dao'],
    ['쌍환 장신구', 'charm'],
    ['흑사염주', 'charm'],
    ['대막곡도', 'sword', 'dao'],
  ],
  [
    ['혈정', 'ore'],
    ['혈옥 파편', 'ore'],
    ['홍의패', 'charm'],
    ['혈옥도', 'sword', 'dao'],
  ],
  [
    ['고성지도', 'ore'],
    ['기문반', 'charm'],
    ['팔문패', 'charm'],
    ['팔괘선', 'sword', 'fan'],
  ],
];
export function bossReward(id: string, itemId: string, quality = 100): Item | null {
  const boss = bossById(id);
  if (!boss) return null;
  const [region] = id.split('-').map(Number);
  const [name, kind, style] = rewards[region][boss.phase - 1];
  const item = style
    ? makeWeapon(style, itemId, 'ground', quality)
    : makeItem(kind, itemId, 'ground', quality);
  const phase = boss.phase;
  const basePower =
    kind === 'sword'
      ? 5 + phase * 2
      : kind === 'charm'
        ? 2 + phase
        : kind === 'robe'
          ? 2 + phase * 0.6
          : kind === 'boots'
            ? 2 + phase * 0.6
            : 0;
  return {
    ...item,
    name,
    originBoss: id,
    templateId: `boss-${id}`,
    upgrades: 0,
    rarity: phase === 4 ? 'heroic' : phase >= 2 ? 'rare' : 'refined',
    power: Math.round((basePower * quality) / 10) / 10,
  };
}
export function canStack(a: Item, b: Item) {
  return (
    a.kind === b.kind &&
    itemIdentity(a) === itemIdentity(b) &&
    itemRarity(a) === itemRarity(b) &&
    (a.upgrades ?? 0) === (b.upgrades ?? 0) &&
    a.name === b.name &&
    a.quality === b.quality &&
    a.power === b.power &&
    a.weaponStyle === b.weaponStyle &&
    a.originBoss === b.originBoss
  );
}
