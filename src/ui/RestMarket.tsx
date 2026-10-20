import { useState } from 'react';
import type { Run } from '../domain/model';
import { itemDefinition, makeLootItem, RARITY_NAMES } from '../domain/items';
import { merchantSupplies } from '../domain/loot';
import { regionName } from '../domain/campaign';
import { gameStore } from '../platform/store';
import { itemDescription, itemEffect } from '../platform/game-copy';
import { t } from '../platform/i18n';
import { Modal } from './shared';
import { ItemArt } from './Icons';
import { EquipmentComparison } from './EquipmentComparison';
import { equipmentComparisons } from '../domain/equipment-comparison';
import { PREPARATION_ART } from '../platform/preparation-art';
import artSizes from '../platform/preparation-art-sizes.json';

export function RestMarket({
  run,
  busy,
  onClose,
  returnFocusTo,
}: {
  run: Run;
  busy: boolean;
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const supplies = run.supplies ?? merchantSupplies(run);
  const [selection, setSelection] = useState('');
  const selected = supplies.find((s) => s.templateId === selection) ?? supplies[0];
  const item = selected && makeLootItem(selected.templateId, 'market-preview', 'ground');
  const reason = !selected
    ? t('판매 물품이 없습니다.')
    : busy
      ? t('저장 중')
      : !selected.stock
        ? t('품절')
        : run.gold < selected.price
          ? t('금전 {0}전 부족', { 0: selected.price - run.gold })
          : '';
  const comparisons = item ? equipmentComparisons(run.fighter, item) : [];
  return (
    <Modal
      title={t('정비 상인')}
      onClose={onClose}
      className="rest-market"
      returnFocusTo={returnFocusTo}
    >
      <div className="rest-market-status">
        <div className="market-keeper">
          <img
            src={PREPARATION_ART.merchant}
            width={artSizes.merchant.width}
            height={artSizes.merchant.height}
            alt=""
            decoding="async"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
          <div>
            <b>{t(regionName(run))}</b>
            <p>{t('다음 길에 필요한 물건을 골라보세요.')}</p>
          </div>
        </div>
        <span>{t('소지금 {0}전', { 0: run.gold })}</span>
      </div>
      <div className="rest-market-content">
        <div className="rest-market-stock" aria-label={t('판매 물품')}>
          {supplies.map((s) => {
            const d = itemDefinition(s.templateId)!,
              preview = makeLootItem(s.templateId, 'preview', 'ground');
            return (
              <button
                key={s.templateId}
                className="market-stock-select"
                aria-pressed={s === selected}
                onClick={() => setSelection(s.templateId)}
              >
                <ItemArt item={preview} kind={preview.kind} weaponStyle={preview.weaponStyle} />
                <span>
                  <b>{t(d.name)}</b>
                  <small>{itemEffect(preview, run.fighter)}</small>
                  <small>
                    {t('재고 {0}', { 0: s.stock })} · {t('{0}전', { 0: s.price })}
                  </small>
                </span>
                <span className="market-stock-state">
                  {s.stock ? (run.gold < s.price ? t('금전 부족') : t('비교')) : t('품절')}
                </span>
              </button>
            );
          })}
        </div>
        <section className="market-detail" aria-label={t('구매할 물품')}>
          {item && selected ? (
            <>
              <div className="market-item-heading">
                <ItemArt item={item} kind={item.kind} weaponStyle={item.weaponStyle} />
                <div>
                  <h3>{t(item.name)}</h3>
                  <small>
                    {t(RARITY_NAMES[item.rarity!])} · {itemEffect(item, run.fighter)}
                  </small>
                </div>
              </div>
              <div className="market-detail-copy">
                {comparisons.length ? (
                  <EquipmentComparison
                    key={selected.templateId}
                    fighter={run.fighter}
                    item={item}
                  />
                ) : (
                  <p>{itemDescription(item, run.fighter)}</p>
                )}
                {item.kind === 'sword' && !comparisons.length && (
                  <p className="action-hint">
                    {t('현재 배운 무공과 호환되는 연결 대상이 없습니다.')}
                  </p>
                )}
                <p className="market-destination">
                  {t('구매 후 획득 물품에 보관됩니다. 사용·착용은 가방에서 하세요.')}
                </p>
              </div>
              <div className="market-purchase">
                <button
                  className="primary"
                  disabled={!!reason}
                  aria-describedby="market-purchase-reason"
                  onClick={() =>
                    void gameStore.dispatch({ type: 'buySupply', templateId: selected.templateId })
                  }
                >
                  {selected.stock ? t('구매 · {0}전', { 0: selected.price }) : t('품절')}
                </button>
                <p className="action-hint" id="market-purchase-reason" role="status">
                  {reason || t('구매 후 잔액 {0}전', { 0: run.gold - selected.price })}
                </p>
              </div>
            </>
          ) : (
            <p>{t('판매 물품이 없습니다.')}</p>
          )}
        </section>
      </div>
      <footer className="market-actions">
        <span>{t('구매 물품은 가방의 획득 물품에 놓입니다.')}</span>
        <button
          onClick={() => {
            onClose();
            gameStore.openBag(true);
          }}
        >
          {t('가방과 획득 물품')}
        </button>
      </footer>
    </Modal>
  );
}
