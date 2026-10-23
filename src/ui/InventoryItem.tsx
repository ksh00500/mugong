import { createContext, useContext, useRef } from 'react';
import type { Item } from '../domain/model';
import { size } from '../domain/inventory';
import { t } from '../platform/i18n';
import { ItemArt } from './Icons';

export type DragItem = { id: string; item: Item; offsetX: number; offsetY: number };
export const BagDrag = createContext<{
  drag: DragItem | null;
  setDrag: (value: DragItem | null) => void;
  readDrag: () => DragItem | null;
  rotated: boolean;
  quickMove: (item: Item) => void;
  reserved?:ReadonlySet<string>;
} | null>(null);

export function ItemTile({
  item,
  selected,
  onSelect,
  locked,
  onQuickMove,
  dragEnabled = true,
}: {
  item: Item;
  selected: boolean;
  onSelect: () => void;
  onQuickMove?: (item: Item) => void;
  dragEnabled?: boolean;
  locked: boolean;
}) {
  const dragging = useContext(BagDrag);
  locked=locked||!!dragging?.reserved?.has(item.id);
  const grabbed = useRef({ x: 0, y: 0 });
  const orientation = selected ? (dragging?.rotated ?? item.rotated) : item.rotated;
  return (
    <button
      className={`item-tile ${item.kind} ${selected ? 'selected' : ''} ${dragging?.drag?.id === item.id ? 'drag-source' : ''}`}
      data-item-id={item.id}
      draggable={!locked && dragEnabled}
      aria-pressed={selected}
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect(),
          footprint = size(item, orientation);
        grabbed.current = {
          x: Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * footprint.w)),
          y: Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * footprint.h)),
        };
      }}
      onDragStart={(e) => {
        if (locked) {
          e.preventDefault();
          return;
        }
        if (!selected) onSelect();
        const target = size(item, orientation);
        dragging?.setDrag({
          id: item.id,
          item: { ...item, rotated: orientation },
          offsetX: Math.min(target.w - 1, grabbed.current.x),
          offsetY: Math.min(target.h - 1, grabbed.current.y),
        });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-mugong-item', item.id);
        e.dataTransfer.setData('text/plain', item.id);
      }}
      onDragEnd={() => dragging?.setDrag(null)}
      onKeyDown={(event) => {
        if (
          event.code === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.repeat &&
          !locked
        ) {
          event.preventDefault();
          onSelect();
          (onQuickMove ?? dragging?.quickMove)?.(item);
        }
      }}
      onClick={(event) => {
        onSelect();
        if ((event.ctrlKey || event.metaKey) && !locked)
          (onQuickMove ?? dragging?.quickMove)?.(item);
      }}
      aria-keyshortcuts="Control+Enter Meta+Enter F"
      title={`${t(item.name)} · ${size(item, orientation).w}×${size(item, orientation).h}`}
      aria-label={t('{0} 선택', { 0: t(item.name) })}
    >
      <ItemArt
        item={item}
        kind={item.kind}
        rotated={orientation}
        weaponStyle={item.weaponStyle}
        originBoss={item.originBoss}
      />
      {item.count > 1 && (
        <span className="item-count" aria-hidden="true">
          {item.count}
        </span>
      )}
      <small>
        {t(item.name)}
        {item.count > 1 ? ` ×${item.count}` : ''}
      </small>
    </button>
  );
}
