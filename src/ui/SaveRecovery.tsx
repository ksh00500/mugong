import { useEffect, useState } from 'react';
import { t } from '../platform/i18n';
import { exportOriginalSave, readRecoveryCopy } from '../platform/storage';
import { gameStore } from '../platform/store';

export function SaveRecovery({ busy, onRecovered }: { busy: boolean; onRecovered?: () => void }) {
  const [copyState, setCopyState] = useState<'checking' | 'available' | 'unavailable' | 'error'>(
    'checking',
  );
  const [working, setWorking] = useState(false);
  const available = copyState === 'available';
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (gameStore.online) return;
    let active = true;
    void readRecoveryCopy().then(
      (copy) => {
        if (active) setCopyState(copy ? 'available' : 'unavailable');
      },
      () => {
        if (active) setCopyState('error');
      },
    );
    return () => {
      active = false;
    };
  }, []);
  if (gameStore.online)
    return (
      <p role="status">
        {t('서버의 마지막 확정 결과를 다시 확인합니다. 로컬 저장은 사용하지 않습니다.')}
      </p>
    );
  return (
    <div className="save-recovery">
      <ol className="recovery-steps">
        <li>
          <b>{t('원본 보관')}</b>
          <small>
            {t(
              '복구 전에 현재 저장 원본을 파일로 보관할 수 있습니다. 내보내기는 원본을 바꾸지 않습니다.',
            )}
          </small>
          <button
            disabled={busy || working}
            onClick={async () => {
              setWorking(true);
              try {
                await exportOriginalSave();
                setNotice('저장 원본을 내보냈습니다.');
              } catch {
                setNotice('원본을 내보내지 못했습니다. 저장 공간에 접근할 수 없습니다.');
              } finally {
                setWorking(false);
              }
            }}
          >
            {t('저장 원본 내보내기')}
          </button>
        </li>
        <li>
          <b>{t('검증 사본 확인')}</b>
          {available && (
            <button
              disabled={busy || working}
              onClick={async () => {
                setWorking(true);
                try {
                  await gameStore.recover();
                  if (!gameStore.error) onRecovered?.();
                } finally {
                  setWorking(false);
                }
              }}
            >
              {t('최신 검증 사본으로 복구')}
            </button>
          )}
          {available && (
            <small>
              {t('마지막 저장과 같은 검증 사본입니다. 이전 진행으로 되돌리지 않습니다.')}
            </small>
          )}
          {!available && (
            <small role="status">
              {t(
                copyState === 'checking'
                  ? '마지막 저장과 같은 검증 사본을 확인하고 있습니다.'
                  : copyState === 'error'
                    ? '저장 공간에 접근하지 못해 검증 사본을 확인할 수 없습니다. 원본 내보내기를 먼저 시도하세요.'
                    : '복구 가능한 최신 검증 사본이 없습니다. 이전 진행으로 되돌리지 않습니다.',
              )}
            </small>
          )}
        </li>
      </ol>
      {notice && <p role="status">{t(notice)}</p>}
    </div>
  );
}
