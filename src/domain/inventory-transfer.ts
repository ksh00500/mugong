import { firstSpace } from './inventory';
import type { Command, Item } from './model';

/** All quick transfers use the same validated move and stack splitting as the buttons. */
export function quickTransferPlan(
  item: Item,
  items: Item[],
  inRun: boolean,
  rotated = item.rotated,
): Command | null {
  if (item.place === 'ground' || item.place === 'warehouse') {
    if (inRun && item.place === 'warehouse') return null;
    const place = item.kind === 'sword' ? 'weapon' : 'general';
    const position = firstSpace(items, { ...item, rotated }, place);
    return position ? { type: 'moveItem', id: item.id, place, ...position, rotated } : null;
  }
  return { type: 'moveItem', id: item.id, place: inRun ? 'ground' : 'warehouse' };
}
