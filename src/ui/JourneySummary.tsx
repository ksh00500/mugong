import type { JourneyResult } from '../domain/model';
import { t } from '../platform/i18n';
import { Modal } from './shared';
import { Icon } from './Icons';
import { gameStore } from '../platform/store';

export function JourneySummary({
  result,
  onClose,
}: {
  result: JourneyResult;
  onClose: () => void;
}) {
  return (
    <Modal title={t('강호 완주')} onClose={onClose} className="journey-summary">
      <div className="journey-heading">
        <Icon name="compass" />
        <h3>
          {result.name} · Lv.{result.level}
        </h3>
      </div>
      <div className="journey-totals">
        <span>
          <small>{t('웨이브')}</small>
          <b>20 / 20</b>
        </span>
        <span>
          <small>{t('처치')}</small>
          <b>{result.kills}</b>
        </span>
        <span>
          <small>{t('가져온 물품')}</small>
          <b>{result.items}</b>
        </span>
        <span>
          <small>{t('세가 정산')}</small>
          <b>{t('{0}전', { 0: result.gold })}</b>
        </span>
      </div>
      <p className="journey-route">{result.route.map((region) => t(region)).join(' → ')}</p>
      <p>{t('체력·무공·물품을 유지합니다. 지금부터 수명 7일이 시작됩니다.')}</p>
      <button
        className="primary"
        onClick={() => {
          onClose();
          gameStore.openBag(true);
        }}
      >
        {t('무인의 가방')}
      </button>
    </Modal>
  );
}
