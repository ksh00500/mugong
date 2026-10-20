import { useEffect, useRef, useState } from 'react';
import { maximumHp } from '../domain/content';
import { encounterHp } from '../domain/balance';
import { bossDefinition, regionName } from '../domain/campaign';
import { healingOffer } from '../domain/preparation';
import {
  isRefiningMaterial,
  refinable,
  refinePreview,
  REFINE_COST,
  makeLootItem,
} from '../domain/items';
import { hasWeapon } from '../domain/inventory';
import { merchantSupplies } from '../domain/loot';
import type { Run } from '../domain/model';
import { t } from '../platform/i18n';
import { gameStore } from '../platform/store';
import { itemEffect } from '../platform/game-copy';
import { Icon, ItemArt } from './Icons';
import { Meter } from './shared';
import { bossBriefing, displayValue } from '../platform/ui-copy';

export function PrepStop({
  run,
  busy,
  hidden,
  onMarket,
  onNext,
}: {
  run: Run;
  busy: boolean;
  hidden: boolean;
  onMarket: () => void;
  onNext: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    heading.current?.focus();
  }, [run.id, run.wave]);
  const f = run.fighter,
    offer = healingOffer(f, run.gold);
  const equipment = f.items.filter(
    (i) => refinable(i) && ['weapon', 'general', 'equipped', 'ground'].includes(i.place),
  );
  const item = equipment.find((i) => i.id === selected) ?? equipment[0];
  const next = item && refinePreview(item);
  const materialCount = f.items
    .filter((i) => isRefiningMaterial(i) && ['general', 'ground'].includes(i.place))
    .reduce((sum, i) => sum + i.count, 0);
  const canRefine =
    !!next && run.gold >= REFINE_COST.gold && materialCount >= REFINE_COST.materials;
  const boss = bossDefinition({ ...run, wave: run.wave + 1 });
  const briefing = boss ? bossBriefing(boss.id) : [];
  const stock = run.supplies ?? merchantSupplies(run);
  const medicine = makeLootItem('medicine-small', 'physician-preview', 'ground');
  const merchandise = makeLootItem(
    stock[1]?.templateId ?? 'weapon-sword-1',
    'vendor-preview',
    'ground',
  );
  const art = f.arts[f.active];
  const waiting = f.items.filter((i) => i.place === 'ground').reduce((sum, i) => sum + i.count, 0);
  return (
    <section
      className="prep-stop"
      hidden={hidden}
      aria-labelledby="prep-stop-title"
      onKeyDown={(event) => {
        if (event.key === 'Tab' || event.key === ' ') event.stopPropagation();
      }}
    >
      <header className="prep-heading">
        <div>
          <small>
            {t(regionName(run))} · {t('{0}웨이브', { 0: run.wave })}
          </small>
          <h1 id="prep-stop-title" ref={heading} tabIndex={-1}>
            {t('다음 시련을 준비하세요')}
          </h1>
        </div>
        <b className="prep-gold">{t('소지금 {0}전', { 0: run.gold })}</b>
      </header>
      <div className="prep-services">
        <article
          className="prep-service"
          aria-labelledby="prep-medic"
          data-recommended={f.hp / offer.maximum <= 0.5}
        >
          <div className="prep-service-title">
            <ItemArt item={medicine} kind="medicine" />
            <div>
              <small>{t('회복')}</small>
              <h2 id="prep-medic">{t('의원')}</h2>
            </div>
          </div>
          <div className="prep-service-body">
            <div className="prep-health-number">
              <Icon name="heart" />
              <b>
                {Math.ceil(f.hp)} / {maximumHp(f)}
              </b>
            </div>
            <Meter value={f.hp} max={offer.maximum} identity={f.id} />
            <p>
              {offer.amount > 0
                ? t('체력 {0} 회복', { 0: displayValue(offer.amount) })
                : t('체력이 가득 찼습니다.')}
            </p>
            <small>{t('치료 비용은 1회 12전입니다.')}</small>
          </div>
          <button
            aria-describedby="prep-heal-reason"
            disabled={busy || !offer.available}
            onClick={async () => {
              if (await gameStore.dispatch({ type: 'heal' })) setNotice('치료를 마쳤습니다.');
            }}
          >
            {t('의원 · 회복 12전')}
          </button>
          <small className="prep-reason" id="prep-heal-reason">
            {busy
              ? t('저장 중')
              : offer.amount <= 0
                ? t('체력이 가득 찼습니다.')
                : run.gold < offer.price
                  ? t('금전 부족')
                  : f.hp / offer.maximum <= 0.5
                    ? t('보스 전투 전에 회복을 권합니다.')
                    : '\u00a0'}
          </small>
        </article>
        <article className="prep-service" aria-labelledby="prep-vendor">
          <div className="prep-service-title">
            <ItemArt
              item={merchandise}
              kind={merchandise.kind}
              weaponStyle={merchandise.weaponStyle}
            />
            <div>
              <small>{t('보급')}</small>
              <h2 id="prep-vendor">{t('정비 상인')}</h2>
            </div>
          </div>
          <div className="prep-service-body">
            <p>{t('회복품·현재 무공용 무장·지역 특산 장비')}</p>
            <strong>
              {t('남은 재고 {0}개', { 0: stock.reduce((sum, s) => sum + s.stock, 0) })}
            </strong>
            <small>{t('구매 물품은 가방의 획득 물품에 놓입니다.')}</small>
          </div>
          <button disabled={busy} onClick={onMarket}>
            {t('정비 상인')}
          </button>
          <small className="prep-reason">{t('재고와 가격은 여정에 저장됩니다.')}</small>
        </article>
        <article className="prep-service" aria-labelledby="prep-forge">
          <div className="prep-service-title">
            {item ? (
              <ItemArt item={item} kind={item.kind} weaponStyle={item.weaponStyle} />
            ) : (
              <Icon name="sword" />
            )}
            <div>
              <small>{t('정련')}</small>
              <h2 id="prep-forge">{t('장비 정비')}</h2>
            </div>
          </div>
          <div className="prep-service-body">
            <label htmlFor="prep-equipment">{t('강화할 장비')}</label>
            <select
              className="ui-input"
              id="prep-equipment"
              value={item?.id ?? ''}
              disabled={busy || !item}
              onChange={(e) => setSelected(e.target.value)}
            >
              {equipment.map((i) => (
                <option key={i.id} value={i.id}>
                  {t(i.name)} +{i.upgrades ?? 0}
                </option>
              ))}
            </select>
            {item && (
              <p>
                {itemEffect(item)}
                {next && <> → {itemEffect({ ...item, power: next.power })}</>}
              </p>
            )}
            <small>
              {t('강화 재료 {0} / {1}', { 0: materialCount, 1: REFINE_COST.materials })}
            </small>
          </div>
          <button
            aria-describedby="prep-refine-reason"
            disabled={busy || !canRefine}
            onClick={async () => {
              if (item && (await gameStore.dispatch({ type: 'refine', id: item.id })))
                setNotice('장비를 강화했습니다.');
            }}
          >
            {t('강화 · {0}전 + 재료 {1}', { 0: REFINE_COST.gold, 1: REFINE_COST.materials })}
          </button>
          <small className="prep-reason" id="prep-refine-reason">
            {busy
              ? t('저장 중')
              : !next
                ? item
                  ? t('이 장비는 더 강화할 수 없습니다.')
                  : t('강화할 수 있는 장비가 없습니다.')
                : run.gold < REFINE_COST.gold
                  ? t('금전 부족')
                  : materialCount < REFINE_COST.materials
                    ? t('재료 부족')
                    : t('장비당 최대 두 번 강화')}
          </small>
        </article>
      </div>
      <div className="prep-next-boss">
        <Icon name="compass" />
        <div>
          <b>
            {t('다음 보스')} · {boss ? t(boss.name) : t('보스 전투')}
          </b>
          <small>
            {t('체력 {0}', { 0: encounterHp(Math.floor(run.wave / 5), true) })} ·{' '}
            {art && !hasWeapon(f, art.id)
              ? t('현재 무공의 무장을 연결하세요.')
              : t('무공과 장비를 확인하고 출발하세요.')}
          </small>
          {!!briefing.length && (
            <ul className="prep-boss-moves">
              {briefing.map((entry) => (
                <li key={entry.label}>
                  <b>{t(entry.label)}</b>
                  <span>{t(entry.advice)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <footer className="prep-actions">
        <div role="status">
          {notice
            ? t(notice)
            : waiting
              ? t('미수납 물품 {0}개', { 0: waiting })
              : t('준비가 끝나면 다음 보스로 진행하세요.')}
        </div>
        <button disabled={busy} onClick={() => gameStore.openBag(true)}>
          <Icon name="bag" />
          {t('가방과 획득 물품')}
        </button>
        <button className="primary" disabled={busy} onClick={onNext}>
          {t('다음 {0}웨이브 →', { 0: run.wave + 1 })}
        </button>
      </footer>
    </section>
  );
}
