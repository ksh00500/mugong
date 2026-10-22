import type { CombatReport } from '../domain/combat-report';
import { ARTS } from '../domain/content';
import { t, formatNumber } from '../platform/i18n';

export function CombatReview({ report }: { report?: CombatReport }) {
  if (!report) return <p className="action-hint">{t('이 여정에는 상세 전투 기록이 없습니다.')}</p>;
  const number = (n: number) => formatNumber(Math.round(n * 10) / 10);
  return (
    <section className="combat-review" aria-label={t('전투 기록')}>
      {report.fatal && (
        <p className="combat-fatal">
          <strong>{t('마지막 피해')}</strong> · {t(report.fatal.source.label)} ·{' '}
          {number(report.fatal.amount)} HP
        </p>
      )}
      <dl className="combat-review-totals">
        <div>
          <dt>{t('받은 피해')}</dt>
          <dd>{number(report.damageTaken)}</dd>
        </div>
        <div>
          <dt>{t('회복약 사용')}</dt>
          <dd>{report.potionsUsed}</dd>
        </div>
        <div>
          <dt>{t('피격 횟수')}</dt>
          <dd>{t('최근 {0}회', { 0: report.hits.length })}</dd>
        </div>
      </dl>
      {report.startedAt > 0 && (
        <p className="action-hint">
          {t('이 기록은 여정 {0}초부터 측정했습니다.', { 0: number(report.startedAt) })}
        </p>
      )}
      <details>
        <summary>{t('웨이브와 보스 기록')}</summary>
        <ol className="combat-wave-list">
          {report.waves.map((w) => (
            <li key={w.wave}>
              <b>
                {w.wave}
                {t('웨이브')}
                {w.wave % 5 === 0 ? ` · ${t('보스')}` : ''}
              </b>
              <span>
                {number(w.seconds)}s · {t('받은 피해')} {number(w.damageTaken)}
              </span>
            </li>
          ))}
        </ol>
        {!report.waves.length && <p>{t('아직 완료한 전투가 없습니다.')}</p>}
      </details>
      <details>
        <summary>{t('최근 피격과 사용 무공')}</summary>
        {report.remainingMedicine !== undefined && (
          <p>{t('남은 회복약 {0}개', { 0: report.remainingMedicine })}</p>
        )}
        {report.loadout && (
          <p>{report.loadout.map((a) => `${t(ARTS[a.id].name)} Lv.${a.level}`).join(' · ')}</p>
        )}
        <ol className="combat-hit-list">
          {[...report.hits].reverse().map((hit, n) => (
            <li key={`${hit.time}-${n}`}>
              <span>
                {number(hit.time)}s · {t(hit.source.label)}
              </span>
              <b>−{number(hit.amount)} HP</b>
            </li>
          ))}
        </ol>
        <p>
          {Object.entries(report.attacks)
            .map(
              ([id, count]) =>
                `${id === 'basic' ? t('기본 공격') : t(ARTS[id as keyof typeof ARTS].name)} ${count}`,
            )
            .join(' · ') || t('기록된 공격이 없습니다.')}
        </p>
      </details>
    </section>
  );
}
