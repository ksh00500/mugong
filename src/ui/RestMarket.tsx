import type { Run } from '../domain/model';
import { itemDefinition, RARITY_NAMES } from '../domain/items';
import { merchantSupplies } from '../domain/loot';
import { regionName } from '../domain/campaign';
import { gameStore } from '../platform/store';
import { itemEffect } from '../platform/game-copy';
import { makeLootItem } from '../domain/items';
import { t } from '../platform/i18n';
import { Modal } from './shared';
import { ItemArt } from './Icons';

export function RestMarket({
  run,
  busy,
  onClose,
}: {
  run: Run;
  busy: boolean;
  onClose: () => void;
}) {
  const supplies = run.supplies ?? merchantSupplies(run);
  return (
    <Modal title={t('정비 상인')} onClose={onClose} className="rest-market">
      <div className="rest-market-status">
        <b>{t(regionName(run))}</b>
        <span>{t('소지금 {0}전', { 0: run.gold })}</span>
      </div>
      <div className="rest-market-stock">
        {supplies.map((supply) => {
          const definition = itemDefinition(supply.templateId)!;
          const item = makeLootItem(supply.templateId, 'preview', 'ground');
          return (
            <article key={supply.templateId}>
              <ItemArt item={item} kind={item.kind} weaponStyle={item.weaponStyle} />
              <div>
                <h3>{t(definition.name)}</h3>
                <span>
                  {t(RARITY_NAMES[definition.rarity])} · {itemEffect(item)}
                </span>
                <small>{t('재고 {0}', { 0: supply.stock })}</small>
              </div>
              <button
                className="primary"
                disabled={busy || !supply.stock || run.gold < supply.price}
                onClick={() =>
                  void gameStore.dispatch({ type: 'buySupply', templateId: supply.templateId })
                }
              >
                {supply.stock ? t('구매 · {0}전', { 0: supply.price }) : t('품절')}
              </button>
            </article>
          );
        })}
      </div>
      <p>{t('구매 물품은 가방의 획득 물품에 놓입니다.')}</p>
      <button
        onClick={() => {
          onClose();
          gameStore.openBag(true);
        }}
      >
        {t('가방 정리')}
      </button>
    </Modal>
  );
}
