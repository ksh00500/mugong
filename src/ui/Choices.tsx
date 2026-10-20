import { t } from '../platform/i18n';
import { ARTS } from '../domain/content';
import { offerAvailability } from '../domain/game';
import { milestoneGain } from '../domain/support';
import type { Fighter, Offer } from '../domain/model';
import { gameStore } from '../platform/store';
import { ArtGlyph } from './shared';
import { QuickDetails } from './QuickDetails';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDialogLayer } from './dialog-layer';
export function Choices({
  fighter,
  offers,
  busy,
}: {
  fighter: Fighter;
  offers: Offer[];
  busy: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialogLayer(ref);
  const [remaining, setRemaining] = useState(1);
  const [selectionError, setSelectionError] = useState('');
  const compactQuery = '(max-width: 760px), (max-height: 480px)';
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [page, setPage] = useState(0);
  useLayoutEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    if (focused && ref.current?.contains(focused) && !focused.getClientRects().length)
      (
        ref.current.querySelector<HTMLElement>('.choice-card:not([hidden]):not(:disabled)') ??
        ref.current
      ).focus();
  }, [compact, page]);
  useEffect(() => {
    const query = window.matchMedia(compactQuery);
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const summaries = {
    huashan: '넓은 검로 · 빠른 회피',
    wudang: '찌르기 · 반격',
    tianmo: '강한 공격 · 체력 회복',
    samja: '기초 방어 · 후반 성장',
    tang: '독 누적 · 원거리 침',
    shaolin: '버티기 · 근접 충격',
    gaebang: '취기 두 칸 · 강화 연계',
    jegal: '진점 설치 · 영역 통제',
  };
  useEffect(() => {
    ref.current?.focus();
    const ready = window.setTimeout(() => setRemaining(0), 1000);
    return () => {
      window.clearTimeout(ready);
    };
  }, []);
  const locked = remaining > 0;
  const availability = offerAvailability(fighter);
  const available = availability.filter((entry) => !entry.reasons.length).length;
  const reasonCopy = {
    cost: '수련 부족',
    max: '최대 성급',
    limit: '무공 네 개 보유',
    space: '무장 가방 공간 부족',
  } as const;
  const excluded = availability.filter((entry) => entry.reasons.length);
  return (
    <div className="scrim growth-scrim">
      <section
        ref={ref}
        className="growth"
        data-compact={compact}
        role="dialog"
        aria-modal="true"
        aria-label={t('무공 성장 선택')}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          event.stopPropagation();
          const buttons = Array.from(
              ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary') ?? [],
            ).filter((button) => button.getClientRects().length > 0),
            first = buttons[0],
            last = buttons[buttons.length - 1];
          if (!first) {
            event.preventDefault();
          } else if (document.activeElement === ref.current) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="growth-content">
          <div className="growth-kicker">
            {fighter.progressionVersion === 2 ? (
              t('수련 기회 · {0}', { 0: fighter.trainingPoints ?? 0 })
            ) : (
              <>
                {t('수련의 갈림길 · Lv.')}
                {fighter.level}
              </>
            )}
          </div>
          <h2>{fighter.arts.length ? t('다음 경지를 선택하세요') : t('첫 무공을 선택하세요')}</h2>
          <div className="growth-selection-status" role="status" aria-live="polite">
            {busy
              ? t('저장 중')
              : selectionError
                ? t(selectionError)
                : locked
                  ? t('오입력 방지 · {0}초 후 선택 가능', { 0: remaining })
                  : t('선택할 무공을 눌러 결정하세요 · Shift로 설명 확인')}
            {locked && (
              <span className="growth-wait-track" aria-hidden="true">
                <i />
              </span>
            )}
          </div>
          <div
            className="choice-grid"
            style={{ '--choice-count': offers.length } as React.CSSProperties}
          >
            {offers.map((o, index) => {
              const d = ARTS[o.art],
                current = fighter.arts.find((a) => a.id === o.art)?.level ?? 0;
              return (
                <button
                  className={`choice-card ${o.art}${locked ? ' cooldown' : ''}`}
                  key={o.art}
                  hidden={compact && index !== Math.min(page, offers.length - 1)}
                  data-technique={o.art}
                  data-level={current + 1}
                  data-next="true"
                  aria-description={t(d.description)}
                  disabled={busy || locked}
                  onClick={async () => {
                    if (locked || busy) return;
                    setSelectionError('');
                    if (!(await gameStore.dispatch({ type: 'choose', offer: o })))
                      setSelectionError(gameStore.notice || '지금은 할 수 없는 행동입니다.');
                  }}
                  style={{ '--art-color': d.hex } as React.CSSProperties}
                >
                  <div className="choice-identity">
                    <ArtGlyph id={o.art} />
                    <div>
                      <span className="choice-type">
                        {o.type === 'learn'
                          ? t('새 무공')
                          : current === 1 || current === 3
                            ? t('보조 효과 해금')
                            : t('경지 상승')}
                      </span>
                      <h3>{t(d.name)}</h3>
                      <div className="choice-level">
                        {current ? `Lv.${current} → Lv.${current + 1}` : t('Lv.1 입문')}
                      </div>
                    </div>
                  </div>
                  <p>{t(summaries[o.art])}</p>
                  {fighter.progressionVersion === 2 && (
                    <small>{t('수련 {0} 소모', { 0: o.type === 'learn' ? 1 : current })}</small>
                  )}
                  <div className="choice-skill">
                    {t(
                      milestoneGain(
                        o.art,
                        current + 1,
                        d.stages[current] ?? d.stages[d.stages.length - 1],
                      ),
                    )}
                  </div>
                  <small>
                    <kbd>Space</kbd> {t(d.defense)}
                  </small>
                  <span className="choose-label">
                    {locked ? t('잠시 후 선택 가능') : t('선택하기 →')}
                  </span>
                </button>
              );
            })}
          </div>
          {compact && (
            <nav className="growth-pages" aria-label={t('무공 후보 전환')}>
              <button
                disabled={page === 0}
                aria-label={t('이전 무공 후보')}
                onClick={() => setPage((value) => value - 1)}
              >
                ‹
              </button>
              <span>
                {page + 1} / {offers.length}
              </span>
              <button
                disabled={page >= offers.length - 1}
                aria-label={t('다음 무공 후보')}
                onClick={() => setPage((value) => value + 1)}
              >
                ›
              </button>
              <button
                className="growth-detail-link"
                disabled={locked || busy}
                data-details-toggle
                aria-expanded="false"
              >
                {t('설명')} <kbd>Shift</kbd>
              </button>
            </nav>
          )}
          <div className="growth-note">
            {fighter.progressionVersion === 2 && !!fighter.arts.length && (
              <button
                className="growth-defer"
                disabled={busy || locked}
                onClick={() => void gameStore.dispatch({ type: 'deferTraining' })}
              >
                {t('수련 기회 보관')}
              </button>
            )}
            <small>{t('최대 네 무공 · 선택 결과 자동 저장')}</small>
            {!compact && (
              <button
                className="growth-detail-link"
                disabled={locked || busy}
                data-details-toggle
                aria-expanded="false"
              >
                {t('설명')} <kbd>Shift</kbd>
              </button>
            )}
          </div>
          {offers.length < 3 && (
            <details className="growth-availability">
              <summary>{t('선택 가능 {0}개 · 조건 확인', { 0: available })}</summary>
              <div className="growth-availability-content">
                <p>
                  {t(
                    '보유 무공의 다음 성급은 현재 성급만큼 수련을 소모합니다. 새 무공은 수련 1이 필요하며, 호환 무장이 없다면 무장 가방 공간도 필요합니다.',
                  )}
                </p>
                <ul>
                  {excluded.map(({ offer, cost, reasons }) => (
                    <li key={offer.art}>
                      {t(ARTS[offer.art].name)} · {t('수련 {0} 소모', { 0: cost })} ·{' '}
                      {reasons.map((reason) => t(reasonCopy[reason])).join(' / ')}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          )}
        </div>
        <QuickDetails scope={ref} fighter={fighter} placement="inline" />
      </section>
    </div>
  );
}
