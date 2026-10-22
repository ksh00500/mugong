import { useState } from 'react';
import type { Item, ItemKind, WeaponStyle } from '../domain/model';
import {
  dedicatedItemArt,
  defaultItemArtId,
  ITEM_ARTWORK,
  itemArtView,
} from '../platform/item-art';
import { PaintedSprite } from './PaintedSprite';

const items: Record<ItemKind, number> = {
  sword: 0,
  medicine: 1,
  manual: 2,
  robe: 3,
  boots: 4,
  charm: 5,
  ore: 6,
};
const lootIcons: (number | undefined)[][] = [
  [undefined, 1, 0, 1],
  [2, undefined, 1, 3],
  [undefined, 1, 1, 6],
  [undefined, 4, undefined, 1],
  [undefined, undefined, 1, undefined],
  [undefined, undefined, 1, 1],
  [6, 1, 5, 1],
  [undefined, 0, 0, undefined],
  [7, 7, 1, undefined],
  [6, 5, 1, undefined],
];
export function ItemArt({
  item,
  kind,
  rotated = false,
  weaponStyle,
  originBoss,
}: {
  item?: Item;
  kind: ItemKind;
  rotated?: boolean;
  weaponStyle?: WeaponStyle;
  originBoss?: string;
}) {
  const [failed, setFailed] = useState<string>();
  const identified = dedicatedItemArt(item);
  const defaultId = defaultItemArtId(kind, weaponStyle);
  const art =
    identified ??
    (!item && ITEM_ARTWORK[defaultId] ? { id: defaultId, ...ITEM_ARTWORK[defaultId] } : undefined);
  if (art && failed !== art.src) {
    const view = itemArtView(art, rotated);
    return (
      <svg
        className={`painted-sprite item-art ${kind} ${weaponStyle ?? ''}`}
        viewBox={view.viewBox}
        data-art-id={art.id}
        data-art-rotated={rotated}
        aria-hidden="true"
        focusable="false"
      >
        <image
          href={art.src}
          width={art.width}
          height={art.height}
          transform={view.transform}
          onError={() => setFailed(art.src)}
        />
      </svg>
    );
  }
  if (originBoss && kind !== 'sword') {
    const [region, phase] = originBoss.split('-').map(Number);
    const index = lootIcons[region]?.[phase - 1];
    if (index !== undefined)
      return <PaintedSprite sheet="bossLoot" index={index} className={`item-art ${kind}`} />;
  }
  const weapons = { sword: 0, dao: 1, dart: 2, gauntlet: 3, staff: 4, fan: 5 };
  if (kind === 'sword' && weaponStyle)
    return (
      <PaintedSprite
        sheet="weapons"
        index={weapons[weaponStyle]}
        className={`item-art sword ${weaponStyle}`}
        narrow={['sword', 'dao', 'staff'].includes(weaponStyle)}
        rotated={rotated}
      />
    );
  return (
    <PaintedSprite
      sheet="symbols"
      index={items[kind]}
      className={`item-art ${kind}`}
      narrow={kind === 'sword'}
      rotated={kind === 'sword' && rotated}
    />
  );
}
const icons = {
  bag: 0,
  warehouse: 1,
  close: 2,
  pause: 3,
  rotate: 4,
  arrow: 5,
  heart: 6,
  sword: 7,
  record: 8,
  clock: 9,
  help: 10,
  compass: 11,
  sound: 12,
  muted: 13,
  settings: 14,
  discard: 15,
};
export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <PaintedSprite sheet="navigation" index={icons[name]} className={`ui-icon icon-${name}`} />
  );
}
