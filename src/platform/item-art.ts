import type { Item, ItemKind, WeaponStyle } from '../domain/model';
import { itemIdentity, ITEM_CATALOGUE } from '../domain/items';
import manifest from './item-art-manifest.json';

export interface ItemArtwork {
  src: string;
  width: number;
  height: number;
  bounds: number[];
}
export const ITEM_ARTWORK: Readonly<Record<string, ItemArtwork>> = manifest;
export function dedicatedItemArt(item?: Item) {
  if (!item) return undefined;
  const id = itemIdentity(item);
  // Old saves have names but no template IDs; their state is never rewritten for art.
  const legacy = !id
    ? item.name === '철광석' && item.kind === 'ore'
      ? 'material-0'
      : ITEM_CATALOGUE.find(
          (d) =>
            d.name === item.name &&
            d.kind === item.kind &&
            d.style === (item.kind === 'sword' ? (item.weaponStyle ?? 'sword') : undefined),
        )?.id
    : undefined;
  const key = id ?? legacy;
  return key && ITEM_ARTWORK[key] ? { id: key, ...ITEM_ARTWORK[key] } : undefined;
}

export function itemArtView(art: ItemArtwork, rotated: boolean) {
  const [x, y, width, height] = art.bounds;
  const cx = x + width / 2,
    cy = y + height / 2;
  return {
    viewBox: rotated
      ? [cx - height / 2, cy - width / 2, height, width].join(' ')
      : art.bounds.join(' '),
    transform: rotated ? `rotate(-90 ${cx} ${cy})` : undefined,
  };
}
export function defaultItemArtId(kind: ItemKind, style?: WeaponStyle) {
  if (kind === 'sword') return `weapon-${style ?? 'sword'}-0`;
  return (
    {
      robe: 'gear-robe-0',
      boots: 'gear-boots-0',
      charm: 'gear-charm-0',
      medicine: 'medicine-small',
      manual: 'manual-training',
      ore: 'material-0',
    } as const
  )[kind];
}
