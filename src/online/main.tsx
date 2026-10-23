import { createRoot } from 'react-dom/client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import App from '../App';
import { t, useLanguage } from '../platform/i18n';
import { PvpClient } from '../pvp/client';
import { Auth } from '../pvp/PvpApp';
import { RecoveryBoundary } from '../ui/RecoveryBoundary';
import '../ui.css';
import '../pvp/pvp.css';
import './online.css';
function OnlineApp() {
  useLanguage();
  const [client] = useState(() => new PvpClient());
  const view = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const [ready, setReady] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    client
      .account()
      .catch(() => {
        if (active) setError(t('온라인 서버에 연결하지 못했습니다'));
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      client.stop();
    };
  }, [client]);
  return (
    <>
      <header className="online-banner">
        <b>{t('온라인 세가')}</b>
        <span>{t('서버 저장 · 20웨이브 육성 · 영구 사망')}</span>
        <nav aria-label={t('온라인 메뉴')}>
          <a href="/raid/">{t('개인 레이드')}</a>
          <a href="/pvp/">{t('비무')}</a>
          <a href="/">{t('로컬 강호')}</a>
          {view.account && (
            <button
              onClick={() =>
                void client
                  .logout()
                  .then(() => location.reload())
                  .catch(() => setError(t('접속 종료에 실패했습니다')))
              }
            >
              {t('로그아웃')}
            </button>
          )}
        </nav>
      </header>
      {!ready ? (
        <p role="status">{t('온라인 세가 확인 중')}</p>
      ) : !view.account ? (
        <main className="pvp-app pvp-auth-main">
          {error && <p role="alert">{error}</p>}
          <Auth client={client} personal />
        </main>
      ) : (
        <App />
      )}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <RecoveryBoundary>
    <OnlineApp />
  </RecoveryBoundary>,
);
