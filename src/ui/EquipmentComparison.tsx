import { useState } from 'react';
import { ARTS } from '../domain/content';
import { equipmentComparisons } from '../domain/equipment-comparison';
import type { BoundFighter, Item } from '../domain/model';
import { t, formatNumber } from '../platform/i18n';
import { ItemArt } from './Icons';

export function EquipmentComparison({ fighter, item }: { fighter: BoundFighter; item: Item }) {
  const rows = equipmentComparisons(fighter, item);
  const [choice, setChoice] = useState('');
  const key = (row: (typeof rows)[number]) => row.arts.join(',') || 'equipment';
  const selected = rows.find((row) => key(row) === choice) ?? rows[0];
  if (!selected) return null;
  const number = (value: number) => `${formatNumber(value, 1)}${selected.percent ? '%' : ''}`;
  return (
    <section
      className="equipment-comparison"
      aria-label={t('장비 비교')}
      title={selected.arts.map((art) => t(ARTS[art].name)).join(' · ')}
    >
      {rows.length > 1 && (
        <select
          className="ui-input"
          aria-label={t('비교할 무공')}
          value={key(selected)}
          onChange={(event) => setChoice(event.target.value)}
        >
          {rows.map((row) => (
            <option key={key(row)} value={key(row)}>
              {row.arts.map((art) => t(ARTS[art].name)).join(' · ')}
            </option>
          ))}
        </select>
      )}
      <header>
        <small>{t(item.kind === 'sword' ? '현재 연결' : '현재 착용')}</small>
        {selected.previous[0] && (
          <ItemArt item={selected.previous[0]} kind={selected.previous[0].kind} />
        )}
        <span>
          {selected.previous.length
            ? selected.previous.map((previous) => t(previous.name)).join(' · ')
            : t('없음')}
        </span>
      </header>
      <div className="comparison-values">
        <span>
          {t(selected.metric)} {number(selected.current)}{' '}
          <span aria-label={t('선택 물품')}>→ {number(selected.next)}</span>
        </span>
        <strong data-change={selected.delta > 0 ? 'up' : selected.delta < 0 ? 'down' : 'same'}>
          {selected.delta
            ? `${selected.delta > 0 ? '+' : '−'}${number(Math.abs(selected.delta))}`
            : t('동일')}
        </strong>
      </div>
    </section>
  );
}
