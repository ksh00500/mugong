import { useRef } from 'react';
import type { Run } from '../domain/model';
import { restEvent } from '../domain/rest-event';
import { itemDefinition } from '../domain/items';
import { gameStore } from '../platform/store';
import { t } from '../platform/i18n';

export function RestEvent({ run, busy }: { run: Run; busy: boolean }) {
  const event = restEvent(run),
    status = useRef<HTMLParagraphElement>(null);
  const choose = async (choice: 'accept' | 'leave') => {
    if (await gameStore.dispatch({ type: 'restEvent', choice })) status.current?.focus();
  };
  return (
    <div className="rest-event" data-event-kind={event.kind}>
      <p className="rest-event-story">{t(event.story)}</p>
      <dl className="rest-event-terms">
        <div>
          <dt>{t('지불')}</dt>
          <dd>
            {event.itemCost
              ? `${t(itemDefinition(event.itemCost.templateId)!.name)} ×${event.itemCost.count} (${event.heldCount})`
              : event.hpCost
                ? t('체력 {0}', { 0: event.hpCost })
                : t('{0}전', { 0: event.goldCost })}
          </dd>
        </div>
        <div>
          <dt>{t('보상')}</dt>
          <dd>
            {t(itemDefinition(event.templateId)!.name)} ×{event.count}
          </dd>
        </div>
      </dl>
      <p>{t('보상은 미수납 물품으로 지급됩니다. 가방에서 수납하거나 사용하세요.')}</p>
      <p ref={status} role="status" tabIndex={-1} className="rest-event-result">
        {event.record
          ? t(
              event.record.choice === 'accept'
                ? '기연을 마쳤습니다. 보상을 확인하세요.'
                : '이번 기연을 지나쳤습니다.',
            )
          : !event.available
            ? t(
                event.itemCost
                  ? '교환할 물품이 부족합니다.'
                  : event.hpCost
                    ? '체력이 부족합니다. 체력은 1 이상 남아야 합니다.'
                    : '금전 부족',
              )
            : t('한 번 선택하면 이 쉼터에서는 바꿀 수 없습니다.')}
      </p>
      {!event.record && (
        <div className="rest-event-actions">
          <button
            className="primary"
            disabled={busy || !event.available}
            onClick={() => void choose('accept')}
          >
            {t('거래하기')}
          </button>
          <button disabled={busy} onClick={() => void choose('leave')}>
            {t('그냥 지나가기')}
          </button>
        </div>
      )}
      <button disabled={busy} onClick={() => gameStore.openBag(true)}>
        {t('가방과 획득 물품')}
      </button>
    </div>
  );
}
