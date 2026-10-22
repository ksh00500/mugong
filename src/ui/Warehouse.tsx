import { useEffect, useRef, useState } from 'react';
import { selectedFighter } from '../domain/game';
import { quickTransferPlan } from '../domain/inventory-transfer';
import type { Item } from '../domain/model';
import { gameStore, type View } from '../platform/store';
import { t } from '../platform/i18n';
import { itemEffect } from '../platform/game-copy';
import { RARITY_NAMES } from '../domain/items';
import { ItemArt, Icon } from './Icons';
import { ItemTile } from './InventoryItem';
import { PagedItems } from './PagedItems';
import { Modal } from './shared';
import { isTopDialog } from './dialog-layer';
import { itemQuantity, stowLabel } from '../platform/ui-copy';

export function Warehouse({ view, close }: { view: View; close: () => void }) {
  const [id, setId] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [capacity, setCapacity] = useState({ columns: 5, rows: 3 });
  const catalog = useRef<HTMLDivElement>(null);
  const item = view.state.family.warehouse.find((entry) => entry.id === id);
  const fighter = selectedFighter(view.state);
  const locked = view.busy || !!view.state.run || !fighter;
  const filtered = view.state.family.warehouse.filter(
    (entry) =>
      (kind === 'all' ||
        (kind === 'sword'
          ? entry.kind === 'sword'
          : kind === 'equipment'
            ? ['robe', 'boots', 'charm'].includes(entry.kind)
            : ['medicine', 'manual', 'ore'].includes(entry.kind))) &&
      t(entry.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const plan = item && fighter ? quickTransferPlan(item, fighter.items, false) : null;
  const reason = view.state.run
    ? t('강호에서는 창고 물품을 옮길 수 없습니다.')
    : !fighter
      ? t('귀환한 무인을 선택하세요.')
      : !plan
        ? t('공간 부족')
        : '';
  function take(entry: Item) {
    if (locked || !fighter) return;
    const move = quickTransferPlan(entry, fighter.items, false);
    if (move) void gameStore.dispatch(move);
  }
  useEffect(() => {
    const element = catalog.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const columns = Math.max(1, Math.floor((width + 12) / 148));
      const rows = Math.max(1, Math.floor((height - 58 + 12) / 148));
      setCapacity((old) =>
        old.columns === columns && old.rows === rows ? old : { columns, rows },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const dialog = target.closest<HTMLElement>('.warehouse-workspace');
      if (
        event.code !== 'KeyF' ||
        event.repeat ||
        event.isComposing ||
        locked ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey ||
        !dialog ||
        !isTopDialog(dialog) ||
        target.closest('input,select,textarea,[contenteditable="true"]')
      )
        return;
      const focusedId = target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
      const entry = view.state.family.warehouse.find((entry) => entry.id === focusedId) ?? item;
      if (entry) {
        event.preventDefault();
        take(entry);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [item, locked, fighter, view.state.family.warehouse]);
  return (
    <Modal title={t('세가 창고')} onClose={close} wide className="warehouse-workspace">
      <div className="warehouse-toolbar">
        <strong>{itemQuantity(view.state.family.warehouse)}</strong>
        <input
          className="ui-input"
          type="search"
          aria-label={t('창고 검색')}
          placeholder={t('창고 검색')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          className="ui-input"
          aria-label={t('물품 종류')}
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          <option value="all">{t('전체')}</option>
          <option value="sword">{t('무기')}</option>
          <option value="equipment">{t('착용 장비')}</option>
          <option value="supplies">{t('소모품·재료')}</option>
        </select>
      </div>
      <div className="warehouse-content">
        <div
          className="warehouse-catalog"
          ref={catalog}
          style={
            {
              '--warehouse-columns': capacity.columns,
              '--warehouse-rows': capacity.rows,
            } as React.CSSProperties
          }
        >
          <PagedItems
            key={`${query}:${kind}`}
            label={t('창고 물품')}
            items={filtered}
            pageSize={capacity.columns * capacity.rows}
            renderItem={(entry) => (
              <ItemTile
                key={entry.id}
                item={entry}
                selected={id === entry.id}
                onSelect={() => setId(entry.id)}
                onQuickMove={take}
                dragEnabled={false}
                locked={locked}
              />
            )}
            empty={
              <div className="empty-warehouse">
                <Icon name="warehouse" />
                <p>
                  {t(
                    view.state.family.warehouse.length
                      ? '검색 결과가 없습니다.'
                      : '아직 보관한 물품이 없습니다.',
                  )}
                </p>
              </div>
            }
          />
        </div>
        <aside className="warehouse-detail">
          {item ? (
            <>
              <div className="warehouse-item-heading">
                <ItemArt
                  item={item}
                  kind={item.kind}
                  rotated={item.rotated}
                  weaponStyle={item.weaponStyle}
                  originBoss={item.originBoss}
                />
                <div>
                  <h3>{t(item.name)}</h3>
                  <span>×{item.count}</span>
                </div>
              </div>
              <dl>
                <dt>{t('품질')}</dt>
                <dd>
                  {item.quality}
                  {item.rarity && <> · {t(RARITY_NAMES[item.rarity])}</>}
                </dd>
                <dt>{t('크기')}</dt>
                <dd>
                  {item.w} × {item.h}
                </dd>
                <dt>{t('효과')}</dt>
                <dd>{itemEffect(item)}</dd>
              </dl>
              <button
                className="primary warehouse-take"
                aria-keyshortcuts="F"
                disabled={locked || !plan}
                title={reason || undefined}
                onClick={() => take(item)}
              >
                {stowLabel(item.kind === 'sword' ? 'weapon' : 'general')} <kbd>F</kbd>
              </button>
              {reason && <p className="warehouse-reason">{reason}</p>}
            </>
          ) : (
            <div className="warehouse-selection-hint">
              <Icon name="warehouse" />
              <p>{t('물품을 선택하세요.')}</p>
            </div>
          )}
        </aside>
      </div>
      <footer className="warehouse-footer">
        <span role="status">{view.notice ? t(view.notice) : t('Ctrl+클릭으로 바로 옮기기')}</span>
        <span>
          <kbd>F</kbd> {t('가방으로')} · <kbd>Esc</kbd> {t('닫기')}
        </span>
      </footer>
    </Modal>
  );
}
