import type { Item } from '../domain/model';
import type { RaidState } from '../raid/model';
export function carriedItems(m: RaidState, seat: number): Item[] {
  return (m.heirs ?? [])
    .filter((h) => h.carrier === seat && !h.returned && !h.lost)
    .map((h) => ({ ...h.item, place: 'general', x: h.x!, y: h.y! }));
}
