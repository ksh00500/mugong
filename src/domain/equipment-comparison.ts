import type { ArtId, BoundFighter, Item } from './model';
import { compatibleWeapon } from './inventory';

export interface EquipmentComparison {
  arts: ArtId[];
  previous: Item[];
  metric: '공격' | '받는 피해 감소' | '이동 속도';
  current: number;
  next: number;
  delta: number;
  percent: boolean;
}
const speed = (power: number) => Math.round(((power * 8) / 265) * 1000) / 10;

/** Compare the slots that an equip/bind command actually replaces, without mutating the save. */
export function equipmentComparisons(f: BoundFighter, candidate: Item): EquipmentComparison[] {
  if (
    candidate.place === 'equipped' ||
    !['sword', 'robe', 'boots', 'charm'].includes(candidate.kind)
  )
    return [];
  const row = (previous: Item[], arts: ArtId[] = []): EquipmentComparison => {
    const power = previous.reduce((sum, item) => sum + item.power, 0);
    const percent = candidate.kind === 'boots';
    const current = percent ? speed(power) : power;
    const next = percent ? speed(candidate.power) : candidate.power;
    return {
      arts,
      previous,
      metric: candidate.kind === 'robe' ? '받는 피해 감소' : percent ? '이동 속도' : '공격',
      current,
      next,
      delta: Math.round((next - current) * 10) / 10,
      percent,
    };
  };
  if (candidate.kind !== 'sword')
    return [
      row(f.items.filter((item) => item.place === 'equipped' && item.kind === candidate.kind)),
    ];
  const compatible = f.arts.filter((art) => compatibleWeapon(candidate, art.id));
  const active = f.arts[f.active]?.id;
  compatible.sort((a, b) => Number(b.id === active) - Number(a.id === active));
  const groups = new Map<string, EquipmentComparison>();
  for (const art of compatible) {
    const current = f.items.find(
      (item) =>
        item.place === 'weapon' &&
        item.id === f.bindings?.[art.id] &&
        compatibleWeapon(item, art.id),
    );
    if (current?.id === candidate.id) continue;
    const key = current?.id ?? '';
    const existing = groups.get(key);
    if (existing) existing.arts.push(art.id);
    else groups.set(key, row(current ? [current] : [], [art.id]));
  }
  if (!f.arts.length && (candidate.weaponStyle ?? 'sword') === 'sword') {
    const current = f.items.find(
      (item) => item.place === 'weapon' && (item.weaponStyle ?? 'sword') === 'sword',
    );
    if (current?.id !== candidate.id) return [row(current ? [current] : [])];
  }
  return [...groups.values()];
}
