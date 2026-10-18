import { t, useLanguage, LANGUAGES, setLanguage, isLanguagePreference } from '../platform/i18n';
import { Modal } from './shared';
import { useEffect, useState } from 'react';
import { useAudio, setAudioPreferences, setMuted, sound } from '../platform/audio';

export type UiPreferences = {
  largeHud: boolean;
  highContrast: boolean;
};

export function Settings({
  preferences,
  onChange,
  onClose,
}: {
  preferences: UiPreferences;
  onChange: (next: UiPreferences) => void;
  onClose: () => void;
}) {
  const { locale, preference } = useLanguage();
  const [fullscreen, setFullscreen] = useState(!!document.fullscreenElement);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'display' | 'audio'>('display');
  const audio = useAudio();
  const channels = [
    ['master', '전체 음량'],
    ['music', '배경음악'],
    ['effects', '효과음'],
    ['ambient', '환경음'],
  ] as const;
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  return (
    <Modal title={t('화면 설정')} onClose={onClose} className="settings-dialog">
      <div
        className="settings-tabs"
        role="tablist"
        aria-label={t('설정 분류')}
        onKeyDown={(event) => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next =
            event.key === 'Home'
              ? 'display'
              : event.key === 'End'
                ? 'audio'
                : tab === 'display'
                  ? 'audio'
                  : 'display';
          setTab(next);
          document.getElementById(`${next}-tab`)?.focus();
        }}
      >
        <button
          role="tab"
          id="display-tab"
          aria-controls="display-settings"
          aria-selected={tab === 'display'}
          tabIndex={tab === 'display' ? 0 : -1}
          onClick={() => setTab('display')}
        >
          {t('화면')}
        </button>
        <button
          role="tab"
          id="audio-tab"
          aria-controls="audio-settings"
          aria-selected={tab === 'audio'}
          tabIndex={tab === 'audio' ? 0 : -1}
          onClick={() => setTab('audio')}
        >
          {t('소리')}
        </button>
      </div>
      <div
        id="display-settings"
        role="tabpanel"
        aria-labelledby="display-tab"
        hidden={tab !== 'display'}
        className="screen-settings glance-settings"
      >
        <p data-setting="language">{t('언어와 화면 설정은 이 브라우저에 저장됩니다.')}</p>
        <div className="language-setting" data-setting="language">
          <label htmlFor="game-language">
            {t('언어')} {locale !== 'en' && <span lang="en">/ Language</span>}
          </label>
          <select
            id="game-language"
            value={preference}
            onChange={(event) => {
              if (isLanguagePreference(event.target.value)) setLanguage(event.target.value);
            }}
          >
            <option value="auto">
              {t('자동 감지 · {0}', {
                0: LANGUAGES.find((language) => language.code === locale)!.label,
              })}
            </option>
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code} lang={language.code}>
                {language.label}
              </option>
            ))}
          </select>
          <small>{t('언어를 선택하면 바로 적용됩니다.')}</small>
        </div>
        {document.fullscreenEnabled && (
          <button
            data-setting="display"
            title={t('브라우저 영역을 숨기고 게임 화면을 넓힙니다.')}
            onClick={async () => {
              try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else await document.documentElement.requestFullscreen();
                setNotice('');
              } catch {
                setNotice(
                  '전체 화면 전환을 지원하지 않는 창입니다. 일반 화면으로 계속 사용할 수 있습니다.',
                );
              }
            }}
          >
            <span>
              <b>{fullscreen ? t('전체 화면 나가기') : t('전체 화면으로 전환')}</b>
              <small>{t('브라우저 영역을 숨기고 게임 화면을 넓힙니다.')}</small>
            </span>
            <span aria-hidden="true">⛶</span>
          </button>
        )}
        <button
          data-setting="display"
          title={t('체력·웨이브·무공 표시를 키웁니다.')}
          role="switch"
          aria-checked={preferences.largeHud}
          onClick={() => onChange({ ...preferences, largeHud: !preferences.largeHud })}
        >
          <span>
            <b>{t('전투 HUD 큰 글씨')}</b>
            <small>{t('체력·웨이브·무공 표시를 키웁니다.')}</small>
          </span>
          <i aria-hidden="true" />
        </button>
        {notice && (
          <p role="status" data-setting="display">
            {t(notice)}
          </p>
        )}
        <button
          data-setting="display"
          title={t('전투 HUD의 바탕과 경계선을 더 분명하게 표시합니다.')}
          role="switch"
          aria-checked={preferences.highContrast}
          onClick={() => onChange({ ...preferences, highContrast: !preferences.highContrast })}
        >
          <span>
            <b>{t('높은 대비')}</b>
            <small>{t('전투 HUD의 바탕과 경계선을 더 분명하게 표시합니다.')}</small>
          </span>
          <i aria-hidden="true" />
        </button>
      </div>
      <div
        id="audio-settings"
        role="tabpanel"
        aria-labelledby="audio-tab"
        hidden={tab !== 'audio'}
        className="audio-settings"
      >
        <p>{t('경쾌한 효과음 · 잔잔한 배경음악')}</p>
        <button role="switch" aria-checked={audio.muted} onClick={() => setMuted(!audio.muted)}>
          <b>{t('모든 소리 끄기')}</b>
          <span>{audio.muted ? t('켜짐') : t('꺼짐')}</span>
        </button>
        {channels.map(([key, label]) => (
          <label className="audio-channel" key={key} htmlFor={`audio-${key}`}>
            <span>
              {t(label)}
              <output>{Math.round(audio[key] * 100)}%</output>
            </span>
            <input
              id={`audio-${key}`}
              type="range"
              min="0"
              max="100"
              step="5"
              value={Math.round(audio[key] * 100)}
              onChange={(event) => setAudioPreferences({ [key]: Number(event.target.value) / 100 })}
              onPointerUp={() => {
                if (key === 'effects' || key === 'master') sound('confirm');
              }}
              onKeyUp={() => {
                if (key === 'effects' || key === 'master') sound('confirm');
              }}
            />
          </label>
        ))}
        <small role="status">
          {audio.status === 'unavailable'
            ? t('소리를 시작하지 못했습니다. 다음 입력에서 다시 시도합니다.')
            : t('소리 설정은 이 브라우저에 저장됩니다.')}
        </small>
      </div>
    </Modal>
  );
}
