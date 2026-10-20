import type { JourneyResult, Run } from '../domain/model';
import { t, formatNumber } from '../platform/i18n';
import { Modal } from './shared';
import { Icon } from './Icons';
import { gameStore } from '../platform/store';

function JourneyFacts({
  wave,
  kills,
  elapsed,
  items,
  gold,
}: Pick<JourneyResult, 'wave' | 'kills' | 'elapsed'> &
  Partial<Pick<JourneyResult, 'items' | 'gold'>>) {
  return (
    <dl className="journey-totals">
      <div>
        <dt>{t('웨이브')}</dt>
        <dd>{wave} / 20</dd>
      </div>
      <div>
        <dt>{t('처치')}</dt>
        <dd>{formatNumber(kills)}</dd>
      </div>
      <div>
        <dt>{t('여정 시간')}</dt>
        <dd>{t('{0}분 {1}초', { 0: Math.floor(elapsed / 60), 1: Math.floor(elapsed % 60) })}</dd>
      </div>
      {items !== undefined && (
        <div>
          <dt>{t('가져온 물품')}</dt>
          <dd>{t('{0}개', { 0: items })}</dd>
        </div>
      )}
      {gold !== undefined && (
        <div>
          <dt>{t('세가 정산')}</dt>
          <dd>{t('{0}전', { 0: gold })}</dd>
        </div>
      )}
    </dl>
  );
}

export function DeathSummary({ run, busy }: { run: Run; busy: boolean }) {
  return (
    <Modal title={t('강호에 남긴 이름')} className="journey-summary journey-death">
      <div className="journey-summary-content death-result">
        <span className="journey-outcome-mark" aria-hidden="true">
          殞
        </span>
        <h3>
          {t('{0}, 강호에서 쓰러지다', { 0: run.fighter.name })} · Lv.{run.fighter.level}
        </h3>
        <JourneyFacts wave={run.wave} kills={run.kills} elapsed={run.elapsed} />
        {!!run.regionRoute?.length && (
          <p className="journey-route" aria-label={t('방문한 지역')}>
            {run.regionRoute
              .slice(0, Math.ceil(run.wave / 5))
              .map((region) => t(region))
              .join(' → ')}
          </p>
        )}
        <p className="journey-retention">{t('무인과 이번 여정의 물품은 돌아오지 않습니다.')}</p>
        <p className="journey-next-hint">
          {t('세가 창고와 기존 자금은 유지됩니다. 돌아가서 새 무인을 모집하세요.')}
        </p>
      </div>
      <footer className="journey-summary-actions">
        <p className="action-hint" role="status">
          {busy ? t('사망 기록을 저장하고 있습니다.') : t('돌아가면 이번 여정이 기록됩니다.')}
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() => void gameStore.dispatch({ type: 'claim' })}
        >
          {t('세가로 돌아가기')}
        </button>
      </footer>
    </Modal>
  );
}

export function JourneySummary({
  result,
  onClose,
}: {
  result: JourneyResult;
  onClose: () => void;
}) {
  return (
    <Modal title={t('강호 완주')} onClose={onClose} className="journey-summary">
      <div className="journey-summary-content">
        <div className="journey-heading">
          <Icon name="compass" />
          <h3>
            {result.name} · Lv.{result.level}
          </h3>
        </div>
        <JourneyFacts {...result} />
        <p className="journey-route" aria-label={t('방문한 지역')}>
          {result.route.map((region) => t(region)).join(' → ')}
        </p>
        <p className="journey-retention">
          {t('체력·무공·착용·수납한 물품을 유지하며 귀환 시점부터 수명 7일이 시작됩니다.')}
        </p>
        <p className="journey-next-hint">
          {t('먼저 가방을 정리하거나 명부에서 귀환한 무인을 확인하세요.')}
        </p>
      </div>
      <footer className="journey-summary-actions">
        <button onClick={onClose}>{t('명부 확인')}</button>
        <button
          className="primary"
          onClick={() => {
            onClose();
            gameStore.openBag(true);
          }}
        >
          {t('무인의 가방')}
        </button>
      </footer>
    </Modal>
  );
}
