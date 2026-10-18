import { medicineFactor } from './character';
import { ART_WEAPONS, BAG, maximumHp } from './content';
import type { BoundFighter, Fighter, Item, Place } from './model';
export function size(item: Item, rotated = item.rotated) {
  return rotated ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
}
export function placementIssue(
  items: Item[],
  item: Item,
  place: Place,
  x = 0,
  y = 0,
  rotated = item.rotated,
): 'type' | 'bounds' | 'collision' | null {
  if (place === 'weapon' && item.kind !== 'sword') return 'type';
  if (place !== 'weapon' && place !== 'general') return null;
  const b = BAG[place],
    s = size(item, rotated);
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x + s.w > b.w ||
    y + s.h > b.h
  )
    return 'bounds';
  return items.some((other) => {
    if (other.id === item.id || other.place !== place) return false;
    const o = size(other);
    return x < other.x + o.w && x + s.w > other.x && y < other.y + o.h && y + s.h > other.y;
  })
    ? 'collision'
    : null;
}
export function canPlace(
  items: Item[],
  item: Item,
  place: Place,
  x = 0,
  y = 0,
  rotated = item.rotated,
) {
  return placementIssue(items, item, place, x, y, rotated) === null;
}
export function firstSpace(items: Item[], item: Item, place: 'weapon' | 'general') {
  const b = BAG[place];
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) if (canPlace(items, item, place, x, y)) return { x, y };
  return null;
}
/** One greedy pass, preserving orientation, item IDs and storage area.
 * Commit a bag only if every existing item fits; never spill a linked weapon. */
export function compactBags(items: Item[]) {
  for (const place of ['weapon', 'general'] as const) {
    const bag = items.filter((item) => item.place === place);
    const packed: Item[] = [];
    for (const item of [...bag].sort((a, b) => b.w * b.h - a.w * a.h)) {
      const space = firstSpace(packed, item, place);
      if (!space) break;
      packed.push({ ...item, ...space });
    }
    if (packed.length !== bag.length) continue;
    for (const item of bag) {
      const position = packed.find((copy) => copy.id === item.id)!;
      item.x = position.x;
      item.y = position.y;
    }
  }
}
/** Plan every displaced piece before changing an equipment slot. No swap may drop equipment outside a bag. */
export function equipmentSwapPlan(items: Item[], incoming: Item) {
  const displaced = items.filter(
    (other) =>
      other.id !== incoming.id && other.kind === incoming.kind && other.place === 'equipped',
  );
  const preview = items.filter((other) => other.id !== incoming.id).map((other) => ({ ...other }));
  const plan: { id: string; x: number; y: number }[] = [];
  for (const old of displaced) {
    const preferred =
      incoming.place === 'general' && canPlace(preview, old, 'general', incoming.x, incoming.y)
        ? { x: incoming.x, y: incoming.y }
        : null;
    const space = preferred ?? firstSpace(preview, old, 'general');
    if (!space) return null;
    const copy = preview.find((entry) => entry.id === old.id)!;
    Object.assign(copy, { place: 'general', ...space });
    plan.push({ id: old.id, ...space });
  }
  return plan;
}
export function removeBindings(f: BoundFighter, itemId: string) {
  for (const art of Object.keys(f.bindings ?? {}) as (keyof NonNullable<
    BoundFighter['bindings']
  >)[])
    if (f.bindings?.[art] === itemId) delete f.bindings[art];
}
export function hasWeapon(f: BoundFighter, art?: string) {
  if (!art) return f.items.some((i) => i.place === 'weapon' && compatibleWeapon(i, 'huashan'));
  const id = f.bindings?.[art as keyof NonNullable<BoundFighter['bindings']>];
  return f.items.some(
    (i) =>
      i.id === id && i.place === 'weapon' && compatibleWeapon(i, art as keyof typeof ART_WEAPONS),
  );
}
export function compatibleWeapon(item: Item, art: keyof typeof ART_WEAPONS) {
  // Saves from the four-art version used an unclassified blade for both sword and dao arts.
  return (
    item.kind === 'sword' &&
    (item.weaponStyle
      ? item.weaponStyle === ART_WEAPONS[art]
      : ART_WEAPONS[art] === 'sword' || ART_WEAPONS[art] === 'dao')
  );
}
export function activeWeapon(f: BoundFighter) {
  const id = f.arts[f.active]?.id;
  const item = id
    ? f.items.find(
        (i) => i.id === f.bindings?.[id] && i.place === 'weapon' && compatibleWeapon(i, id),
      )
    : f.items.find(
        (i) => i.place === 'weapon' && i.kind === 'sword' && (i.weaponStyle ?? 'sword') === 'sword',
      );
  return item;
}
export function weaponPower(f: BoundFighter) {
  return activeWeapon(f)?.power ?? 0;
}
export function equipmentBonus(f: Fighter, kind: Item['kind']) {
  return f.items
    .filter((i) => i.place === 'equipped' && i.kind === kind)
    .reduce((v, i) => v + i.power, 0);
}
export function useItem(f: Fighter, item: Item) {
  if (item.kind === 'medicine') {
    if (f.hp >= maximumHp(f)) return false;
    f.hp = Math.min(maximumHp(f), f.hp + item.power * medicineFactor(f));
  } else if (item.kind !== 'manual') return false;
  item.count--;
  if (!item.count) f.items = f.items.filter((i) => i.id !== item.id);
  return true;
}
