import { useEffect, useState } from 'react';
import { t } from '../platform/i18n';
import { exportOriginalSave, readRecoveryCopy } from '../platform/storage';
import { gameStore } from '../platform/store';

export function SaveRecovery({ busy, onRecovered }: { busy: boolean; onRecovered?: () => void }) {
  const [available, setAvailable] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    void readRecoveryCopy().then(
      (copy) => {
        if (active) setAvailable(!!copy);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="save-recovery">
      <button
        disabled={busy}
        onClick={async () => {
          try {
            await exportOriginalSave();
            setNotice('저장 원본을 내보냈습니다.');
          } catch {
            setNotice('원본을 내보내지 못했습니다. 저장 공간에 접근할 수 없습니다.');
          }
        }}
      >
        {t('저장 원본 내보내기')}
      </button>
      {available && (
        <button
          disabled={busy}
          onClick={async () => {
            await gameStore.recover();
            if (!gameStore.error) onRecovered?.();
          }}
        >
          {t('최신 검증 사본으로 복구')}
        </button>
      )}
      {available && (
        <small>{t('마지막 저장과 같은 검증 사본입니다. 이전 진행으로 되돌리지 않습니다.')}</small>
      )}
      {notice && <p role="status">{t(notice)}</p>}
    </div>
  );
}
