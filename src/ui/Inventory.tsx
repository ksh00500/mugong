import { CharacterProfile, CharacterTraining } from './CharacterProfile';
import { t } from '../platform/i18n';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ARTS, BAG, maximumHp } from '../domain/content';
import {
  canPlace,
  compatibleWeapon,
  equipmentSwapPlan,
  firstSpace,
  placementIssue,
  size,
} from '../domain/inventory';
import { selectedFighter } from '../domain/game';
import { quickTransferPlan } from '../domain/inventory-transfer';
import { isTopDialog } from './dialog-layer';
import {
  isRefiningMaterial,
  itemValue,
  RARITY_NAMES,
  refinePreview,
  REFINE_COST,
} from '../domain/items';
import type { BoundFighter, Item, Place } from '../domain/model';
import { gameStore, type View } from '../platform/store';
import { ArtGlyph, Confirmation, lifespan, Meter, Modal } from './shared';
import { ItemArt, Icon } from './Icons';
import { PagedItems } from './PagedItems';
import { BagDrag, ItemTile, type DragItem } from './InventoryItem';
import { sound } from '../platform/audio';
import { itemDescription, itemEffect, itemOrigin } from '../platform/game-copy';
import { QuickDetails } from './QuickDetails';
import { EquipmentComparison } from './EquipmentComparison';
import { equipmentComparisons } from '../domain/equipment-comparison';
import { itemQuantity, stowLabel, displayValue } from '../platform/ui-copy';
import { isWalkablePreparation } from '../domain/waystation';

function BagUsage({
  place,
  items,
  actions,
}: {
  place: 'weapon' | 'general';
  items: Item[];
  actions?: ReactNode;
}) {
  const bag = BAG[place],
    total = bag.w * bag.h;
  const used = items
    .filter((item) => item.place === place)
    .reduce((sum, item) => sum + item.w * item.h, 0);
  return (
    <div className="bag-usage" data-place={place}>
      <div className="bag-usage-heading">
        <h3>
          <span className="bag-title-full">
            {t(place === 'weapon' ? '무장 가방' : '일반 가방')}
          </span>
          <span className="bag-title-short">{t(place === 'weapon' ? '무장' : '가방')}</span>
        </h3>
        {actions}
        <span className="bag-dimensions">
          {bag.w}×{bag.h}
        </span>
      </div>
      <div className="bag-usage-numbers">
        <strong>
          {used}
          <small> / {total}</small>
        </strong>
        <span>{t('{0}칸 여유', { 0: total - used })}</span>
      </div>
      <div
        className="bag-usage-meter"
        role="meter"
        aria-label={t('가방 사용 칸')}
        aria-valuenow={used}
        aria-valuemax={total}
        aria-valuemin={0}
      >
        <i style={{ width: `${(used / total) * 100}%` }} />
      </div>
    </div>
  );
}

function BagGrid({
  place,
  items,
  selected,
  locked,
  onSelect,
  onIssue,
}: {
  place: 'weapon' | 'general';
  items: Item[];
  selected?: Item;
  locked: boolean;
  onSelect: (item: Item) => void;
  onIssue: (issue: 'type' | 'bounds' | 'collision') => void;
}) {
  const dragging = useContext(BagDrag);
  const b = BAG[place];
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const dragged = dragging?.drag?.item;
  const footprint = dragged ? size(dragged) : null;
  const issue = dragged && hover ? placementIssue(items, dragged, place, hover.x, hover.y) : null;
  useEffect(() => {
    setHover(null);
  }, [dragging?.drag?.id, locked]);
  function position(event: React.DragEvent<HTMLDivElement>, current: DragItem) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * b.w) - current.offsetX,
      y: Math.floor(((event.clientY - rect.top) / rect.height) * b.h) - current.offsetY,
    };
  }
  return (
    <div
      className={`bag-grid ${place}`}
      style={{ '--cols': b.w, '--rows': b.h } as React.CSSProperties}
      aria-label={place === 'weapon' ? t('무장 가방 격자') : t('일반 가방 격자')}
      data-dragging={!!dragging?.drag}
      onDragOver={(event) => {
        const current = dragging?.readDrag();
        if (locked || !current) return;
        event.preventDefault();
        const { x, y } = position(event, current);
        setHover({ x, y });
        // Accept the drop event even at an invalid position, then report why it failed.
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        const current = dragging?.readDrag();
        if (
          !locked &&
          current &&
          event.dataTransfer.getData('application/x-mugong-item') === current.id
        ) {
          const { x, y } = position(event, current);
          const problem = placementIssue(items, current.item, place, x, y);
          if (problem) onIssue(problem);
          else
            void gameStore.dispatch({
              type: 'moveItem',
              id: current.id,
              place,
              x,
              y,
              rotated: current.item.rotated,
            });
        }
        dragging?.setDrag(null);
        setHover(null);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(null);
      }}
      onMouseLeave={() => setHover(null)}
    >
      {dragging?.drag && hover && !locked && (
        <span className="placement-feedback" role="status">
          {issue === 'type'
            ? t('이 가방에는 무기만 수납할 수 있습니다.')
            : issue === 'bounds'
              ? t('가방 경계를 벗어납니다.')
              : issue === 'collision'
                ? t('다른 물품과 겹칩니다.')
                : t('놓으면 이 위치에 수납합니다.')}
        </span>
      )}
      {Array.from({ length: b.w * b.h }, (_, i) => {
        const x = i % b.w,
          y = Math.floor(i / b.w),
          valid = dragged && canPlace(items, dragged, place, x, y);
        return (
          <span
            className={`bag-cell ${dragged && !locked && valid ? 'valid' : ''}`}
            style={{ gridColumn: x + 1, gridRow: y + 1 }}
            key={i}
            data-cell={i}
            aria-hidden="true"
          />
        );
      })}
      {hover &&
        hover.x >= 0 &&
        hover.x < b.w &&
        hover.y >= 0 &&
        hover.y < b.h &&
        footprint &&
        dragged &&
        !locked && (
          <div
            className={`placement-preview ${canPlace(items, dragged, place, hover.x, hover.y) ? 'fits' : 'blocked'}`}
            style={{
              gridColumn: `${hover.x + 1} / span ${Math.min(footprint.w, b.w - hover.x)}`,
              gridRow: `${hover.y + 1} / span ${Math.min(footprint.h, b.h - hover.y)}`,
            }}
            aria-hidden="true"
          >
            <ItemArt
              item={dragged}
              kind={dragged.kind}
              rotated={dragged.rotated}
              weaponStyle={dragged.weaponStyle}
              originBoss={dragged.originBoss}
            />
          </div>
        )}
      {items
        .filter((i) => i.place === place)
        .map((item) => {
          const s = size(item);
          return (
            <div
              key={item.id}
              className="bag-item"
              style={{
                gridColumn: `${item.x + 1} / span ${s.w}`,
                gridRow: `${item.y + 1} / span ${s.h}`,
              }}
            >
              <ItemTile
                item={item}
                selected={selected?.id === item.id}
                locked={locked}
                onSelect={() => onSelect(item)}
              />
            </div>
          );
        })}
    </div>
  );
}
export function Inventory({
  view,
  onClose,
  onNext,
}: {
  view: View;
  onClose?: () => void;
  onNext?: () => void;
}) {
  const f = selectedFighter(view.state) as BoundFighter | undefined;
  const forgeHere =
    !isWalkablePreparation(view.state.run) || view.waystationDialogue === 'blacksmith';
  const sellHere = !isWalkablePreparation(view.state.run) || view.waystationDialogue === 'merchant';
  const materialCount =
    f?.items
      .filter((item) => isRefiningMaterial(item) && ['general', 'ground'].includes(item.place))
      .reduce((sum, item) => sum + item.count, 0) ?? 0;
  const [selectedId, setSelectedId] = useState(''),
    [rotated, setRotated] = useState(false),
    [discardId, setDiscardId] = useState('');
  const [drag, setDragState] = useState<DragItem | null>(null);
  const dragRef = useRef<DragItem | null>(null);
  const detailsScope = useRef<HTMLDivElement>(null);
  const [actionNotice, setActionNotice] = useState('');
  function setDrag(value: DragItem | null) {
    dragRef.current = value;
    setDragState(value);
    if (value) setActionNotice('');
  }
  function reportIssue(issue: 'type' | 'bounds' | 'collision') {
    setActionNotice(
      issue === 'type'
        ? '이 가방에는 무기만 수납할 수 있습니다.'
        : issue === 'bounds'
          ? '가방 경계를 벗어납니다.'
          : '다른 물품과 겹칩니다.',
    );
    sound('reject');
  }
  const confirmationOpener = useRef<HTMLElement | null>(null);
  const selected =
      f?.items.find((i) => i.id === selectedId) ??
      (!view.state.run ? view.state.family.warehouse.find((i) => i.id === selectedId) : undefined),
    locked = view.state.run?.phase === 'combat' || view.busy;
  useEffect(() => {
    setActionNotice('');
  }, [selected?.place, selected?.x, selected?.y, selected?.rotated]);
  const ground = f?.items.filter((i) => i.place === 'ground') ?? [];
  function select(item: Item) {
    setSelectedId(item.id);
    setRotated(item.rotated);
    setActionNotice('');
  }
  function rotate() {
    if (!selected || locked || selected.w === selected.h || dragRef.current) return;
    const next = !rotated;
    if (selected.place === 'weapon' || selected.place === 'general') {
      const issue = placementIssue(
        f?.items ?? [],
        selected,
        selected.place,
        selected.x,
        selected.y,
        next,
      );
      if (issue) {
        reportIssue(issue);
        return;
      }
      void gameStore.dispatch({
        type: 'moveItem',
        id: selected.id,
        place: selected.place,
        x: selected.x,
        y: selected.y,
        rotated: next,
      });
    }
    setActionNotice('');
    setRotated(next);
  }
  function close() {
    gameStore.openBag(false);
    onClose?.();
  }
  function quickMove(item: Item) {
    if (!f || locked || discardId || dragRef.current) return;
    const plan = quickTransferPlan(
      item,
      f.items,
      !!view.state.run,
      item.id === selectedId ? rotated : item.rotated,
    );
    if (!plan) {
      setActionNotice('공간 부족');
      sound('reject');
      return;
    }
    void gameStore.dispatch(plan);
  }
  function arrange() {
    if (
      !locked &&
      !discardId &&
      !dragRef.current &&
      f?.items.some((item) => ['weapon', 'general', 'ground'].includes(item.place))
    )
      void gameStore.dispatch({ type: 'arrangeItems' });
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const dialog = target.closest<HTMLElement>('.inventory-workspace');
      if (
        !dialog ||
        !isTopDialog(dialog) ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        target.closest('input,select,textarea,[contenteditable="true"]') ||
        locked ||
        discardId ||
        dragRef.current
      )
        return;
      if (event.code === 'KeyR') {
        event.preventDefault();
        rotate();
      }
      if (event.code === 'KeyF') {
        const focusedId = target.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
        const focused =
          f?.items.find((item) => item.id === focusedId) ??
          (!view.state.run
            ? view.state.family.warehouse.find((item) => item.id === focusedId)
            : undefined);
        if (focused ?? selected) {
          event.preventDefault();
          quickMove((focused ?? selected)!);
        }
      }
      if (event.code === 'KeyT') {
        event.preventDefault();
        arrange();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selected, locked, discardId, rotated, f]);
  if (!f) return null;
  const move = (place: Place) => {
    if (selected) void gameStore.dispatch({ type: 'moveItem', id: selected.id, place });
  };
  const destination = selected?.kind === 'sword' ? 'weapon' : 'general';
  const free = selected ? firstSpace(f.items, { ...selected, rotated }, destination) : null;
  const equipmentSpace = selected ? equipmentSwapPlan(f.items, selected) !== null : true;
  const comparing = !!selected && equipmentComparisons(f, selected).length > 0;
  const directAction =
    selected &&
    (selected.place !== 'warehouse' &&
    ['medicine', 'manual'].includes(selected.kind) &&
    (selected.kind !== 'medicine' || f.hp < maximumHp(f))
      ? 'use'
      : ['robe', 'boots', 'charm'].includes(selected.kind) &&
          !['equipped', 'warehouse'].includes(selected.place)
        ? 'equip'
        : 'stow');
  const transferTarget = selected?.place === 'general' ? 'weapon' : 'general';
  const actionReasons = selected
    ? [
        ...new Set(
          [
            locked
              ? view.busy
                ? t('저장 중')
                : t('수납·사용은 전투 후에 가능합니다. 무장 가방의 무기는 연결할 수 있습니다.')
              : '',
            !locked && ['ground', 'warehouse', 'equipped'].includes(selected.place) && !free
              ? t('공간 부족')
              : '',
            !locked && selected.kind === 'medicine' && f.hp >= maximumHp(f)
              ? t('체력이 가득 찼습니다.')
              : '',
            !locked &&
            selected.place === 'warehouse' &&
            ['medicine', 'manual', 'robe', 'boots', 'charm'].includes(selected.kind)
              ? t('사용·착용하려면 먼저 가방에 수납하세요.')
              : '',
            !locked && directAction === 'equip' && !equipmentSpace
              ? t('기존 장비를 넣을 가방 공간이 없습니다.')
              : '',
            !locked && forgeHere && view.state.run?.phase === 'prep' && refinePreview(selected)
              ? view.state.run.gold < REFINE_COST.gold
                ? t('금전 부족')
                : materialCount < REFINE_COST.materials
                  ? t('재료 부족')
                  : ''
              : '',
          ].filter(Boolean),
        ),
      ]
    : [];
  const trays = [
    {
      place: view.state.run ? 'ground' : 'warehouse',
      items: view.state.run ? ground : view.state.family.warehouse,
      label: view.state.run ? t('획득 물품') : t('세가 창고'),
    },
    ...(!view.state.run
      ? [{ place: 'ground' as const, items: ground, label: t('획득 물품') }]
      : []),
  ] as const;
  return (
    <BagDrag.Provider
      value={{ drag, setDrag, readDrag: () => dragRef.current, rotated, quickMove }}
    >
      <Modal
        title={view.state.run?.phase === 'combat' ? t('가방 · 정보 확인') : t('무인의 가방')}
        onClose={close}
        wide
        className="inventory-workspace glance-workspace"
        returnFocusTo={gameStore.bagOpener}
      >
        <div className="inventory-banner">
          {view.state.run?.phase === 'combat' ? (
            <>
              <strong>{t('전투 중')}</strong>
              {t('수납·사용은 전투 후에 가능합니다. 무장 가방의 무기는 연결할 수 있습니다.')}
            </>
          ) : (
            <>
              <strong>{t('가방 정리')}</strong>
              {t('드래그 · 버튼으로 이동')}{' '}
              <span>
                {t('회전 ')}
                <kbd>R</kbd>
              </span>
            </>
          )}
        </div>
        <div className="inventory-columns" ref={detailsScope}>
          <aside className="inventory-character" aria-label={t('무인 정보')}>
            <header className="inventory-identity">
              <b className="inventory-name" title={f.name}>
                {f.name}
              </b>
              <span>Lv.{f.level}</span>
            </header>
            <CharacterProfile fighter={f} />
            <section className="character-status" aria-label={t('상태')}>
              <div className="health-line">
                <Icon name="heart" />
                <b>
                  {Math.ceil(f.hp)} / {maximumHp(f)}
                </b>
              </div>
              <Meter value={f.hp} max={maximumHp(f)} identity={f.id} />
              {f.expiresAt && (
                <p className="remaining">
                  <Icon name="clock" />
                  {lifespan(f.expiresAt)}
                </p>
              )}
            </section>
            <section className="character-info" aria-label={t('무공')}>
              <div className="character-martial-heading">
                <h3>{t('무공')}</h3>
                <CharacterTraining fighter={f} />
              </div>
              <div className="binding-list">
                {f.arts.length === 0 && <p>{t('아직 배운 무공이 없습니다.')}</p>}
                {f.arts.map((a) => {
                  const weapon = f.items.find(
                    (i) =>
                      i.id === f.bindings?.[a.id] &&
                      i.place === 'weapon' &&
                      compatibleWeapon(i, a.id),
                  );
                  const canBind =
                    !!selected && selected.place === 'weapon' && compatibleWeapon(selected, a.id);
                  return (
                    <div
                      key={a.id}
                      data-technique={a.id}
                      data-level={a.level}
                      data-bound={!!weapon}
                      tabIndex={0}
                      role="group"
                      aria-label={`${t(ARTS[a.id].name)} Lv.${a.level} · ${weapon ? t(weapon.name) : t('연결 무기 없음')}`}
                      title={`${t(ARTS[a.id].name)} · ${weapon ? t(weapon.name) : t('연결 무기 없음')}`}
                    >
                      <ArtGlyph id={a.id} />
                      {weapon && (
                        <span className="bound-weapon" title={t(weapon.name)}>
                          <ItemArt item={weapon} kind="sword" />
                        </span>
                      )}
                      <b>Lv.{a.level}</b>
                      {canBind && (
                        <button
                          className="art-bind"
                          disabled={view.busy || view.state.run?.phase === 'dead'}
                          aria-label={t('{0}에 선택한 무기 연결', { 0: t(ARTS[a.id].name) })}
                          title={t('{0}에 선택한 무기 연결', { 0: t(ARTS[a.id].name) })}
                          aria-pressed={weapon?.id === selected.id}
                          onClick={() =>
                            void gameStore.dispatch({ type: 'bind', art: a.id, item: selected.id })
                          }
                        >
                          {t(weapon?.id === selected.id ? '연결됨' : '연결')}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="character-equipment" aria-label={t('착용 장비')}>
              <h3>{t('착용 장비')}</h3>
              <div className="equipped-list">
                {(['robe', 'boots', 'charm'] as const).map((kind) => {
                  const item = f.items.find((i) => i.kind === kind && i.place === 'equipped');
                  const label =
                    kind === 'robe' ? t('도포') : kind === 'boots' ? t('신발') : t('장신구');
                  return (
                    <div key={kind}>
                      {item ? (
                        <ItemTile
                          item={item}
                          selected={item.id === selectedId}
                          onSelect={() => select(item)}
                          locked={locked}
                        />
                      ) : (
                        <span
                          className="empty-equipment"
                          title={`${label}${t(' · 비어 있음')}`}
                          aria-label={`${label}${t(' · 비어 있음')}`}
                        >
                          <ItemArt kind={kind} />
                        </span>
                      )}
                      <small>{label}</small>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
          <section className="bag-column">
            <BagUsage place="weapon" items={f.items} />
            <BagGrid
              place="weapon"
              items={f.items}
              selected={selected}
              locked={locked}
              onSelect={select}
              onIssue={reportIssue}
            />
            <small className="bag-note">{t('이곳의 무기만 무공에 연결할 수 있습니다.')}</small>
          </section>
          <section className="bag-column general-column">
            <BagUsage
              place="general"
              items={f.items}
              actions={
                <button
                  className="bag-arrange"
                  disabled={
                    locked ||
                    !!drag ||
                    !f.items.some((item) => ['weapon', 'general', 'ground'].includes(item.place))
                  }
                  aria-label={t('자동 정리')}
                  aria-keyshortcuts="T"
                  title={`${t('가방을 정렬하고 획득 물품을 빈칸에 수납합니다.')} · T`}
                  onClick={arrange}
                >
                  <Icon name="rotate" /> {t('자동 정리')} <kbd>T</kbd>
                </button>
              }
            />
            <BagGrid
              place="general"
              items={f.items}
              selected={selected}
              locked={locked}
              onSelect={select}
              onIssue={reportIssue}
            />
            <small className="bag-note">{t('물품을 선택해 옮기거나 자세히 보세요')}</small>
          </section>
          <aside className="item-detail">
            <h3>{t('아이템 정보')}</h3>
            {selected ? (
              <>
                <div className="detail-heading">
                  <div className="detail-icon">
                    <ItemArt
                      item={selected}
                      kind={selected.kind}
                      rotated={rotated}
                      weaponStyle={selected.weaponStyle}
                      originBoss={selected.originBoss}
                    />
                  </div>
                  <div>
                    <h4>{t(selected.name)}</h4>
                    <span className="item-footprint">
                      {size(selected, rotated).w}×{size(selected, rotated).h} ·{' '}
                      {t('{0}칸', { 0: selected.w * selected.h })}
                    </span>
                  </div>
                </div>
                <div className="item-location">
                  {selected.place === 'warehouse'
                    ? t('세가 창고에 보관 중')
                    : selected.place === 'weapon'
                      ? t('무장 가방에 수납 중')
                      : selected.place === 'general'
                        ? t('일반 가방에 수납 중')
                        : selected.place === 'ground'
                          ? t('획득 물품')
                          : selected.place === 'equipped'
                            ? t('착용 중')
                            : t('획득 물품')}{' '}
                  <span>×{selected.count}</span>
                </div>
                {comparing && <EquipmentComparison key={selected.id} fighter={f} item={selected} />}
                {(!comparing || selected.originBoss) && (
                  <p>
                    {['medicine', 'manual'].includes(selected.kind) &&
                    selected.place === 'warehouse'
                      ? t('사용하려면 가방으로 옮기세요.')
                      : !comparing
                        ? itemDescription(selected, f)
                        : ''}
                    {selected.originBoss && (
                      <>
                        {!comparing && ' · '}
                        {itemOrigin(selected)}
                      </>
                    )}
                  </p>
                )}
                <dl>
                  <dt>{t('품질')}</dt>
                  <dd>
                    {selected.quality}
                    {selected.rarity && <> · {t(RARITY_NAMES[selected.rarity])}</>}
                    {!!selected.upgrades && <> +{selected.upgrades}</>}
                  </dd>
                  {!comparing && (
                    <>
                      <dt>{t('효과')}</dt>
                      <dd>{itemEffect(selected, f)}</dd>
                    </>
                  )}
                </dl>
                {forgeHere && view.state.run?.phase === 'prep' && refinePreview(selected) && (
                  <small className="refine-budget">
                    {t('소지금 {0}전 · 재료 {1}', { 0: view.state.run.gold, 1: materialCount })}
                  </small>
                )}
                <div
                  className="item-actions"
                  aria-describedby={actionReasons.length ? 'item-action-reasons' : undefined}
                >
                  {sellHere &&
                    view.state.run?.phase === 'prep' &&
                    selected.kind === 'ore' &&
                    ['general', 'ground'].includes(selected.place) && (
                      <button
                        disabled={locked}
                        onClick={() =>
                          void gameStore.dispatch({ type: 'sellMaterial', id: selected.id })
                        }
                      >
                        {t('판매 · {0}전', { 0: itemValue(selected) * selected.count })}
                      </button>
                    )}
                  {forgeHere &&
                    view.state.run?.phase === 'prep' &&
                    refinePreview(selected) &&
                    ['weapon', 'general', 'equipped', 'ground'].includes(selected.place) && (
                      <button
                        disabled={
                          locked ||
                          view.state.run.gold < REFINE_COST.gold ||
                          materialCount < REFINE_COST.materials
                        }
                        title={t('효과 {0} → {1} · 최대 두 번 강화', {
                          0: displayValue(selected.power),
                          1: displayValue(refinePreview(selected)!.power),
                        })}
                        onClick={() => void gameStore.dispatch({ type: 'refine', id: selected.id })}
                      >
                        {t('강화 · {0}전 + 재료 {1}', {
                          0: REFINE_COST.gold,
                          1: REFINE_COST.materials,
                        })}
                      </button>
                    )}
                  {['ground', 'warehouse', 'equipped'].includes(selected.place) && (
                    <button
                      className={directAction === 'stow' ? 'primary' : undefined}
                      disabled={locked || !free}
                      title={!free ? t('공간 부족') : undefined}
                      onClick={() =>
                        free &&
                        void gameStore.dispatch({
                          type: 'moveItem',
                          id: selected.id,
                          place: destination,
                          ...free,
                          rotated,
                        })
                      }
                    >
                      {stowLabel(destination)}
                    </button>
                  )}
                  {selected.place !== 'equipped' && (
                    <button
                      disabled={locked || selected.w === selected.h || !!drag}
                      title={
                        selected.w === selected.h
                          ? t('정사각형 물품은 회전할 필요가 없습니다.')
                          : undefined
                      }
                      onClick={rotate}
                    >
                      <Icon name="rotate" />
                      {t(' 회전 ')}
                      <kbd>R</kbd>
                    </button>
                  )}
                  {selected.kind === 'sword' && (
                    <button
                      className={selected.place === 'general' ? 'primary' : undefined}
                      disabled={
                        locked ||
                        !firstSpace(
                          f.items,
                          { ...selected, rotated },
                          selected.place === 'general' ? 'weapon' : 'general',
                        )
                      }
                      onClick={() => {
                        const place = selected.place === 'general' ? 'weapon' : 'general';
                        const position = firstSpace(f.items, { ...selected, rotated }, place);
                        if (position)
                          void gameStore.dispatch({
                            type: 'moveItem',
                            id: selected.id,
                            place,
                            ...position,
                            rotated,
                          });
                      }}
                    >
                      {stowLabel(transferTarget)}
                    </button>
                  )}
                  {['medicine', 'manual'].includes(selected.kind) && (
                    <button
                      className={directAction === 'use' ? 'primary' : undefined}
                      title={
                        selected.kind === 'medicine' && f.hp >= maximumHp(f)
                          ? t('체력이 가득 찼습니다.')
                          : undefined
                      }
                      disabled={
                        locked ||
                        selected.place === 'warehouse' ||
                        (selected.kind === 'medicine' && f.hp >= maximumHp(f))
                      }
                      onClick={() => void gameStore.dispatch({ type: 'use', id: selected.id })}
                    >
                      {t('사용')}
                    </button>
                  )}
                  {['robe', 'boots', 'charm'].includes(selected.kind) &&
                    selected.place !== 'equipped' && (
                      <button
                        className={directAction === 'equip' ? 'primary' : undefined}
                        disabled={locked || selected.place === 'warehouse' || !equipmentSpace}
                        title={
                          !equipmentSpace ? t('기존 장비를 넣을 가방 공간이 없습니다.') : undefined
                        }
                        onClick={() => move('equipped')}
                      >
                        {t('착용')}
                      </button>
                    )}
                  {selected.place !== 'warehouse' && selected.place !== 'ground' && (
                    <button disabled={locked} onClick={() => move('ground')}>
                      {t('획득 물품으로')}
                    </button>
                  )}
                  {selected.place === 'ground' && (
                    <button
                      disabled={locked}
                      onClick={() => {
                        confirmationOpener.current = document.activeElement as HTMLElement | null;
                        setDiscardId(selected.id);
                      }}
                    >
                      {t('폐기')}
                    </button>
                  )}
                  {!view.state.run && selected.place !== 'warehouse' && (
                    <button disabled={locked} onClick={() => move('warehouse')}>
                      <Icon name="warehouse" />
                      {t(' 창고로')}
                    </button>
                  )}
                </div>
                {!!actionReasons.length && (
                  <p className="action-hint" id="item-action-reasons">
                    {actionReasons.join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <div className="empty-detail">
                <Icon name="bag" />
                <p>{t('물품을 선택하면 정보와 가능한 행동이 표시됩니다.')}</p>
              </div>
            )}
          </aside>
          <QuickDetails scope={detailsScope} fighter={f} />
        </div>
        <div className="inventory-trays">
          {trays.map(({ place, items, label }) => (
            <section
              key={place}
              className={`inventory-tray ${place}-section`}
              aria-label={label}
              onDragOver={(event) => {
                if (!locked && (place === 'ground' || place === 'warehouse') && dragRef.current) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (
                  !locked &&
                  (place === 'ground' || place === 'warehouse') &&
                  dragRef.current &&
                  event.dataTransfer.getData('application/x-mugong-item') === dragRef.current.id
                )
                  void gameStore.dispatch({ type: 'moveItem', id: dragRef.current.id, place });
                setDrag(null);
              }}
            >
              <header className="tray-header">
                <h3>
                  {label} <small>{itemQuantity(items)}</small>
                </h3>
              </header>
              <PagedItems
                compact

                label={
                  place === 'warehouse'
                    ? t('창고 물품')
                    : place === 'ground'
                      ? t('획득 물품')
                      : label
                }
                items={items}
                renderItem={(item) => (
                  <ItemTile
                    key={item.id}
                    item={item}
                    selected={selectedId === item.id}
                    onSelect={() => select(item)}
                    locked={locked}
                  />
                )}
                empty={
                  <p>
                    {place === 'warehouse'
                      ? t('아직 보관한 물품이 없습니다.')
                      : place === 'ground'
                        ? t('수납할 물품이 없습니다.')
                        : t('수납할 물품이 없습니다.')}
                  </p>
                }
              />
            </section>
          ))}
        </div>
        <footer className="inventory-status">
          <span role="status">
            {(actionNotice && t(actionNotice)) || (view.notice && t(view.notice)) || ''}
          </span>
          <div className="inventory-controls">
            {onNext && ['loot', 'prep'].includes(view.state.run?.phase ?? '') && (
              <button
                className="primary inventory-next"
                disabled={view.busy || !!drag}
                onClick={onNext}
              >
                {view.state.run!.wave === 20
                  ? t('귀환')
                  : t('다음 {0}웨이브 →', { 0: view.state.run!.wave + 1 })}
              </button>
            )}
            <span className="inventory-shortcuts">
              <span title={t('Ctrl+클릭으로 바로 옮기기')}>
                <kbd>F</kbd>{' '}
                {selected
                  ? selected.place === 'ground' || selected.place === 'warehouse'
                    ? stowLabel(destination)
                    : view.state.run
                      ? t('획득 물품으로')
                      : t('창고로')
                  : t('빠른 이동')}
              </span>
              <kbd>R</kbd>
              {t(' 회전 · ')}
              <kbd>Esc</kbd>
              {t(' 닫기')}
            </span>
          </div>
        </footer>
        {discardId && (
          <Confirmation
            title={t('물품 폐기 확인')}
            onClose={() => setDiscardId('')}
            returnFocusTo={confirmationOpener.current}
          >
            <div className="panel">
              <h3>{t('이 물품을 폐기할까요?')}</h3>
              <ul>
                {f.items
                  .filter((i) => i.id === discardId)
                  .map((i) => (
                    <li key={i.id}>
                      {t(i.name)} ×{i.count}
                    </li>
                  ))}
              </ul>
              <p>{t('선택한 물품만 폐기합니다. 되돌릴 수 없습니다.')}</p>
              <div>
                <button autoFocus onClick={() => setDiscardId('')}>
                  {t('계속 정리')}
                </button>
                <button
                  className="danger"
                  disabled={view.busy}
                  onClick={async () => {
                    if (await gameStore.dispatch({ type: 'discardItem', id: discardId })) {
                      setDiscardId('');
                      setSelectedId('');
                    }
                  }}
                >
                  {t('폐기')}
                </button>
              </div>
            </div>
          </Confirmation>
        )}
      </Modal>
    </BagDrag.Provider>
  );
}
export { Warehouse } from './Warehouse';
