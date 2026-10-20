import { pendingChoices } from './domain/character';
import { AugmentChoices } from './ui/AugmentChoices';
import { t, useLanguage, translatedError } from './platform/i18n';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { gameStore } from './platform/store';
import { setMuted, useAudio, unlockAudio, setAudioScene, sound } from './platform/audio';
import { Hud } from './ui/Hud';
import { WaveReady } from './ui/WaveReady';
import { Choices } from './ui/Choices';
import { Inventory, Warehouse } from './ui/Inventory';
import { Lobby } from './ui/Lobby';
import { Modal } from './ui/shared';
import { Settings, type UiPreferences } from './ui/Settings';
import { Field } from './ui/Field';
import { LoadingScreen } from './ui/LoadingScreen';
import { SaveRecovery } from './ui/SaveRecovery';
import { RestMarket } from './ui/RestMarket';
import { PrepStop } from './ui/PrepStop';
import { JourneySummary, DeathSummary } from './ui/JourneySummary';
import type { JourneyResult } from './domain/model';
import { UI_BOOT_IMAGES, prepareImages, preloadFonts, type ImageProgress } from './platform/assets';

function readUiPreferences(): UiPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem('mugong-ui-v1') ?? '{}');
    return { largeHud: stored.largeHud === true, highContrast: stored.highContrast === true };
  } catch {
    return { largeHud: false, highContrast: false };
  }
}
export default function App() {
  const { locale } = useLanguage();
  const [uiAttempt, setUiAttempt] = useState(0);
  const [uiStatus, setUiStatus] = useState<'loading' | 'ready' | 'error' | 'fallback'>('loading');
  const [uiProgress, setUiProgress] = useState<ImageProgress>({
    completed: 0,
    total: Object.keys(UI_BOOT_IMAGES).length,
  });
  const [fieldReady, setFieldReady] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [completed, setCompleted] = useState<JourneyResult | null>(null);
  const previousRun = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setUiStatus('loading');
    void prepareImages(UI_BOOT_IMAGES, (progress) => {
      if (!cancelled) setUiProgress(progress);
    }).then(
      () => {
        if (!cancelled) setUiStatus('ready');
      },
      () => {
        if (!cancelled) setUiStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [uiAttempt]);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('무공 · 강호에 나서다');
    preloadFonts(locale);
  }, [locale]);
  const view = useSyncExternalStore(gameStore.subscribe, gameStore.getSnapshot);
  const [warehouse, setWarehouse] = useState(false),
    [leaving, setLeaving] = useState(false);
  const { muted } = useAudio();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiPreferences, setUiPreferences] = useState(readUiPreferences);
  useEffect(() => {
    try {
      localStorage.setItem('mugong-ui-v1', JSON.stringify(uiPreferences));
    } catch {
      // The preference still works for this session if storage is unavailable.
    }
  }, [uiPreferences]);
  useEffect(() => {
    void gameStore.load();
    const timer = window.setInterval(() => gameStore.checkExpiry(), 30000);
    const hide = () => {
      if (document.hidden && gameStore.ready) {
        gameStore.pause(true);
      }
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);
  const r = view.state.run;
  useEffect(() => {
    const latest = view.state.family.journeys?.[0];
    if (previousRun.current && !r) {
      if (view.busy || view.error) return;
      if (latest?.id === previousRun.current && latest.outcome === 'victory') setCompleted(latest);
    }
    previousRun.current = r?.id ?? null;
    if (r?.phase !== 'prep') setMarketOpen(false);
  }, [r?.id, r?.phase, view.state.family.journeys, view.busy, view.error]);
  useEffect(() => {
    setAudioScene(
      view.error
        ? 'off'
        : view.screen === 'lobby'
          ? 'lobby'
          : view.paused || view.bagOpen || pendingChoices(r) || r?.phase !== 'combat'
            ? 'pause'
            : r.wave % 5 === 0
              ? 'boss'
              : 'combat',
    );
  }, [view.screen, view.paused, view.bagOpen, view.error, r?.phase, pendingChoices(r), r?.wave]);
  useEffect(() => {
    const unlock = (event: Event) => {
      if (event.isTrusted) unlockAudio();
    };
    const activate = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest('button');
      if (event.isTrusted && button && !button.disabled) sound('select');
    };
    document.addEventListener('pointerdown', unlock, { capture: true });
    document.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('click', activate);
    return () => {
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
      document.removeEventListener('click', activate);
      setAudioScene('off');
    };
  }, []);
  const trainedFighter = view.state.family.roster.find(
    (f) => f.id === view.state.family.training?.fighterId,
  );
  const leaveNext = () => {
    if (!r || view.busy || view.error || pendingChoices(r) || !['loot', 'prep'].includes(r.phase))
      return;
    const ground = r.fighter.items.filter((i) => i.place === 'ground');
    if (ground.length) {
      setLeaving(true);
      return;
    }
    void gameStore.dispatch({ type: 'next' });
  };
  return (
    <div
      className="app-shell"
      data-large-hud={uiPreferences.largeHud}
      data-high-contrast={uiPreferences.highContrast}
      data-locale={locale}
      data-art-fallback={uiStatus === 'fallback'}
    >
      {uiStatus === 'loading' || uiStatus === 'error' || (!view.ready && !view.error) ? (
        <LoadingScreen
          key={uiAttempt}
          kind="interface"
          progress={uiProgress}
          error={uiStatus === 'error'}
          onRetry={() => setUiAttempt((value) => value + 1)}
          onContinue={() => setUiStatus('fallback')}
        />
      ) : view.screen === 'lobby' ? (
        <Lobby
          view={view}
          openWarehouse={() => setWarehouse(true)}
          muted={muted}
          toggleSound={() => setMuted(!muted)}
          openSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <main className="field-shell">
          <div className="game-frame" data-region={r ? Math.floor((r.wave - 1) / 5) : 0}>
            <div className="game-backdrop" />
            <Field onReadyChange={setFieldReady} />
            {r && fieldReady && <Hud run={r} busy={view.busy} />}
            {fieldReady && r?.phase === 'loot' && !pendingChoices(r) && (
              <WaveReady
                run={r}
                busy={view.busy}
                hidden={view.bagOpen || view.paused || !!view.error}
                onBag={() => gameStore.openBag(true)}
                onNext={leaveNext}
              />
            )}
          </div>
          <div className="field-footer">
            <span>
              <kbd>WASD</kbd>
              {t(' 이동 ')}
              <i />
              {t(' 좌클릭 공격 ')}
              <i /> <kbd>Q/E</kbd>
              {t(' 무공 ')}
              <i /> <kbd>Space</kbd>
              {t(' 무공별 방어')}
            </span>
            <div>
              <button
                onClick={() => {
                  setMuted(!muted);
                }}
              >
                {muted ? t('소리 켜기') : t('소리 끄기')}
              </button>
              <span aria-live="polite">
                {view.busy || view.saving ? t('저장 중') : t('기기에 저장됨')}
              </span>
            </div>
          </div>
          {fieldReady && r && r.phase === 'prep' && !pendingChoices(r) && (
            <PrepStop
              run={r}
              busy={view.busy}
              hidden={view.bagOpen || view.paused || !!view.error}
              onMarket={() => setMarketOpen(true)}
              onNext={leaveNext}
            />
          )}
          {marketOpen && r?.phase === 'prep' && (
            <RestMarket run={r} busy={view.busy} onClose={() => setMarketOpen(false)} />
          )}
          {fieldReady && r?.phase === 'dead' && <DeathSummary run={r} busy={view.busy} />}
        </main>
      )}
      {view.bagOpen && !pendingChoices(r) && !view.state.family.training && (
        <Inventory view={view} onNext={leaveNext} />
      )}
      {leaving && r && (
        <Modal title={t('남은 물품 확인')} onClose={() => setLeaving(false)}>
          <div className="departure-confirm">
            <p>{t('아래 물품은 이번 공터에 남습니다.')}</p>
            <ul>
              {r.fighter.items
                .filter((i) => i.place === 'ground')
                .map((item) => (
                  <li key={item.id}>
                    {t(item.name)}
                    <span>×{item.count}</span>
                  </li>
                ))}
            </ul>
            <div>
              <button
                onClick={() => {
                  setLeaving(false);
                  gameStore.openBag(true);
                }}
              >
                {t('돌아가서 챙기기')}
              </button>
              <button
                className="primary"
                disabled={view.busy}
                onClick={async () => {
                  if (await gameStore.dispatch({ type: 'next' })) setLeaving(false);
                }}
              >
                {t('남은 물품 두고 진행')}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {warehouse && <Warehouse view={view} close={() => setWarehouse(false)} />}
      {fieldReady && view.screen === 'field' && r?.fighter.augmentOffers?.length ? (
        <AugmentChoices
          fighter={r.fighter}
          busy={view.busy}
          key={`${r.id}-augment-${r.fighter.augments?.length}`}
        />
      ) : null}
      {fieldReady &&
      view.screen === 'field' &&
      r?.offers.length &&
      !r.fighter.augmentOffers?.length ? (
        <Choices
          key={`run-${r.id}-${r.spent}`}
          fighter={r.fighter}
          offers={r.offers}
          busy={view.busy}
        />
      ) : null}
      {trainedFighter?.augmentOffers?.length ? (
        <AugmentChoices
          fighter={trainedFighter}
          busy={view.busy}
          key={`${trainedFighter.id}-augment-${trainedFighter.augments?.length}`}
        />
      ) : null}
      {trainedFighter &&
      view.state.family.training?.offers.length &&
      !trainedFighter.augmentOffers?.length ? (
        <Choices
          key={`family-${trainedFighter.id}-${trainedFighter.spent}`}
          fighter={trainedFighter}
          offers={view.state.family.training.offers}
          busy={view.busy}
        />
      ) : null}
      {view.paused &&
        fieldReady &&
        view.screen === 'field' &&
        !settingsOpen &&
        !view.bagOpen &&
        !pendingChoices(r) &&
        r?.phase !== 'dead' && (
          <Modal title={t('여정을 잠시 멈추다')}>
            <div className="pause-menu">
              <button
                className="primary"
                disabled={view.busy}
                onClick={() => gameStore.pause(false)}
              >
                {t('계속하기')}
              </button>
              <button disabled={view.busy} onClick={() => void gameStore.suspend()}>
                {t('저장하고 일시 종료')}
              </button>
              <button onClick={() => setSettingsOpen(true)}>{t('설정')}</button>
              <button
                onClick={() => {
                  setMuted(!muted);
                }}
              >
                {muted ? t('소리 켜기') : t('소리 끄기')}
              </button>
              <p>
                {t('강호에서 귀환하는 것이 아닙니다.')}
                <br />
                {t('이 무인의 여정을 다음에 이어갑니다.')}
              </p>
            </div>
          </Modal>
        )}
      {completed && <JourneySummary result={completed} onClose={() => setCompleted(null)} />}
      {settingsOpen && (
        <Settings
          preferences={uiPreferences}
          onChange={setUiPreferences}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {view.error && (
        <Modal title={t('저장 확인이 필요합니다')}>
          <div className="save-error" role="alert">
            <p>{translatedError(view.error)}</p>
            <p className="recovery-guidance">
              {t(
                view.ready
                  ? '현재 결과의 저장이 끝나지 않았습니다. 먼저 저장을 다시 시도하세요. 계속 실패하면 원본을 내보내 보관하세요.'
                  : '저장 기록을 열지 못했습니다. 먼저 다시 시도하세요. 계속 실패하면 원본을 보관한 뒤 검증 사본을 확인하세요.',
              )}
            </p>
            <button className="primary" disabled={view.busy} onClick={() => void gameStore.retry()}>
              {t('저장 다시 시도')}
            </button>
            <SaveRecovery busy={view.busy} />
          </div>
        </Modal>
      )}
    </div>
  );
}
