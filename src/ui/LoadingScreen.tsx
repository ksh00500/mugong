import { useEffect, useState } from 'react';
import { t, gameTitle } from '../platform/i18n';
import type { ImageProgress } from '../platform/assets';
export type LoadingFailure = 'images' | 'engine' | 'scene' | 'graphics';

export function LoadingScreen({
  kind,
  progress,
  error = false,
  failure = 'images',
  onRetry,
  onContinue,
}: {
  kind: 'interface' | 'combat';
  progress: ImageProgress;
  error?: boolean;
  failure?: LoadingFailure;
  onRetry?: () => void;
  onContinue?: () => void;
}) {
  const [slow, setSlow] = useState(false);
  const working = progress.stage === 'scene' || progress.stage === 'engine';
  const failureTitle = {
    images: '그림을 불러오지 못했습니다',
    engine: '전투 자료를 불러오지 못했습니다',
    scene: '전투 화면을 구성하지 못했습니다',
    graphics: '그래픽 연결이 끊겼습니다',
  }[failure];
  const failureCopy =
    failure === 'images' || failure === 'engine'
      ? '연결을 확인하고 다시 시도하세요. 받은 자료는 재사용하며 저장된 여정은 유지됩니다.'
      : failure === 'graphics'
        ? '같은 여정으로 화면을 다시 준비합니다. 반복되면 새로고침하세요.'
        : '그림 준비 이후 화면 구성에 실패했습니다. 다시 시도하고 반복되면 새로고침하세요.';
  useEffect(() => {
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, [kind, progress.stage]);
  return (
    <section
      className="loading-screen asset-loading"
      data-error={error}
      data-stage={progress.stage ?? 'images'}
      data-failure={error ? failure : undefined}
      aria-busy={!error}
    >
      <div className="loading-card">
        <span className="loading-brand">{gameTitle()}</span>
        <h2>
          {error
            ? t(failureTitle)
            : progress.stage === 'scene'
              ? t('전투 화면을 구성하고 있습니다.')
              : progress.stage === 'engine'
                ? t('전투 자료를 불러오고 있습니다.')
                : kind === 'combat'
                  ? t('강호를 준비하고 있습니다')
                  : t('세가를 준비하고 있습니다')}
        </h2>
        <p role={error ? 'alert' : 'status'}>
          {error
            ? t(failureCopy)
            : kind === 'combat'
              ? t('준비가 끝나면 전투가 시작됩니다.')
              : t('그림과 저장된 기록을 불러옵니다.')}
        </p>
        {!error && (
          <>
            {kind === 'combat' && (
              <ol className="loading-stages" aria-label={t('준비 단계')}>
                <li data-state={progress.stage === 'scene' ? 'complete' : 'current'}>
                  {progress.stage === 'scene' ? '✓' : '1'} {t('그림·자료 준비')}
                </li>
                <li data-state={progress.stage === 'scene' ? 'current' : 'pending'}>
                  2 {t('장면 구성')}
                </li>
              </ol>
            )}
            <div
              className="loading-progress"
              role="progressbar"
              data-indeterminate={working}
              aria-label={t(
                progress.stage === 'scene'
                  ? '장면 구성'
                  : progress.stage === 'engine'
                    ? '전투 자료 준비'
                    : '그림 준비',
              )}
              aria-valuemin={working ? undefined : 0}
              aria-valuemax={working ? undefined : progress.total}
              aria-valuenow={working ? undefined : progress.completed}
              aria-valuetext={
                working
                  ? t(
                      progress.stage === 'scene'
                        ? '그림 준비 완료 · 전투 화면 구성 중'
                        : '그림 준비 완료 · 전투 자료 준비 중',
                    )
                  : t('{0} / {1}개 그림 준비', {
                      0: progress.completed,
                      1: progress.total,
                    })
              }
            >
              <i
                style={{
                  width: working
                    ? undefined
                    : `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="loading-count" aria-hidden="true">
              {working
                ? t(
                    progress.stage === 'scene'
                      ? '그림 준비 완료 · 전투 화면 구성 중'
                      : '그림 준비 완료 · 전투 자료 준비 중',
                  )
                : t('{0} / {1}개 그림 준비', { 0: progress.completed, 1: progress.total })}
            </div>
            <small className="loading-hint">
              {slow
                ? t(
                    working
                      ? '받은 자료로 화면을 준비하고 있습니다. 준비가 끝날 때까지 전투는 시작되지 않습니다.'
                      : '처음 실행하거나 연결이 느리면 조금 더 걸릴 수 있습니다.',
                  )
                : t('처음 받은 그림은 다음 화면에서도 재사용합니다.')}
            </small>
          </>
        )}
        {error && (
          <div className="loading-actions">
            <button className="primary" onClick={onRetry}>
              {t('다시 시도')}
            </button>
            <button onClick={() => window.location.reload()}>{t('새로고침')}</button>
            {onContinue && <button onClick={onContinue}>{t('기본 화면으로 계속')}</button>}
          </div>
        )}
      </div>
    </section>
  );
}
