import { useEffect, useState } from 'react';
import { t, gameTitle } from '../platform/i18n';
import type { ImageProgress } from '../platform/assets';

export function LoadingScreen({
  kind,
  progress,
  error = false,
  onRetry,
  onContinue,
}: {
  kind: 'interface' | 'combat';
  progress: ImageProgress;
  error?: boolean;
  onRetry?: () => void;
  onContinue?: () => void;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 5000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section className="loading-screen asset-loading" data-error={error} aria-busy={!error}>
      <div className="loading-card">
        <span className="loading-brand">{gameTitle()}</span>
        <h2>
          {error
            ? t('화면을 준비하지 못했습니다')
            : progress.stage === 'scene'
              ? t('전투 화면을 구성하고 있습니다.')
              : kind === 'combat'
                ? t('강호를 준비하고 있습니다')
                : t('세가를 준비하고 있습니다')}
        </h2>
        <p role={error ? 'alert' : 'status'}>
          {error
            ? t('연결을 확인한 뒤 다시 시도하세요. 저장된 여정은 유지됩니다.')
            : kind === 'combat'
              ? t('준비가 끝나면 전투가 시작됩니다.')
              : t('그림과 저장된 기록을 불러옵니다.')}
        </p>
        {!error && (
          <>
            <div
              className="loading-progress"
              role="progressbar"
              aria-label={t('그림 준비')}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.completed}
              aria-valuetext={
                progress.stage === 'scene'
                  ? t('그림 준비 완료')
                  : t('{0} / {1}개 그림 준비', {
                      0: progress.completed,
                      1: progress.total,
                    })
              }
            >
              <i
                style={{
                  width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <div className="loading-count" aria-hidden="true">
              {progress.stage === 'scene'
                ? t('그림 준비 완료')
                : t('{0} / {1}개 그림 준비', { 0: progress.completed, 1: progress.total })}
            </div>
            <small className="loading-hint">
              {slow
                ? t('처음 실행하거나 연결이 느리면 조금 더 걸릴 수 있습니다.')
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
