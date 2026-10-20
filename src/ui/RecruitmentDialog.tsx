import { TRAITS, TRAIT_IDS } from '../domain/character';
import { useEffect, useState } from 'react';
import { recruitmentView, RECRUIT_INTERVAL, RECRUIT_PRICE } from '../domain/recruitment';
import { gameStore, type View } from '../platform/store';
import { t, formatNumber } from '../platform/i18n';
import { Modal } from './shared';
import { characterPortrait } from '../platform/character-art';
import { APPEARANCES } from '../domain/appearances';
import { ABILITY_INFO, InfoPrefix, characterInfoIcon } from './CharacterInfo';

export function RecruitmentDialog({
  view,
  name,
  setName,
  onClose,
}: {
  view: View;
  name: string;
  setName: (name: string) => void;
  onClose: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [selected, setSelected] = useState('');
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const recruitment = recruitmentView(view.state.family, now);
  const seconds = Math.max(
    0,
    Math.ceil((recruitment.anchor + RECRUIT_INTERVAL - recruitment.observedAt) / 1000),
  );
  const countdown = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const candidate = recruitment.candidates.find((c) => c.id === selected);
  const disabled = view.busy || !!view.error;
  const begin = async (basic = false) => {
    if (
      await gameStore.dispatch(
        basic ? { type: 'startBasic', name } : { type: 'startRecruit', name, id: selected },
      )
    )
      onClose();
  };
  return (
    <Modal title={t('무인 모집')} onClose={onClose} className="recruitment-dialog">
      <div className="recruitment-content">
        <div className="recruitment-status">
          <strong>
            {t('모집권')} {recruitment.tickets} / 3
          </strong>
          <span>{recruitment.tickets < 3 ? `${t('다음 충전')} ${countdown}` : t('충전 완료')}</span>
          <span>
            {t('세가 자금')} {formatNumber(view.state.family.silver ?? 0)}
          </span>
        </div>
        {!recruitment.candidates.length ? (
          <div className="recruitment-empty">
            <p>{t('후보 세 명 중 한 명을 선택하세요.')}</p>
            <button
              className="primary"
              disabled={disabled || recruitment.tickets < 1}
              onClick={() => void gameStore.dispatch({ type: 'recruit' })}
            >
              {t('모집권 1장 사용')}
            </button>
            <button
              disabled={
                disabled ||
                recruitment.tickets >= 3 ||
                (view.state.family.silver ?? 0) < RECRUIT_PRICE
              }
              onClick={() => void gameStore.dispatch({ type: 'buyRecruitTicket' })}
            >
              {t('모집권 구매')} · {RECRUIT_PRICE}
            </button>
          </div>
        ) : (
          <div className="recruitment-candidates">
            {recruitment.candidates.map((entry, index) => (
              <div
                key={entry.id}
                className={`recruitment-candidate ${selected === entry.id ? 'selected' : ''}`}
              >
                <button
                  type="button"
                  className="recruitment-select"
                  aria-label={`${t('선택하기')} · ${t(entry.appearance === undefined ? '무인' : APPEARANCES[entry.appearance].name)} · ${t(TRAITS[entry.innate ?? TRAIT_IDS[entry.seed % TRAIT_IDS.length]][0])}`}
                  aria-pressed={selected === entry.id}
                  disabled={disabled}
                  onClick={() => setSelected(entry.id)}
                />
                <img
                  className="recruitment-portrait"
                  src={characterPortrait({
                    appearance: entry.appearance,
                    portrait: entry.portrait ?? (index as 0 | 1 | 2),
                  })}
                  alt=""
                  decoding="async"
                />
                <small className="recruitment-trait">
                  <InfoPrefix
                    icon={characterInfoIcon('trait')}
                    label={t(TRAITS[entry.innate ?? TRAIT_IDS[entry.seed % TRAIT_IDS.length]][0])}
                    description={t(
                      TRAITS[entry.innate ?? TRAIT_IDS[entry.seed % TRAIT_IDS.length]][1],
                    )}
                  >
                    {t(TRAITS[entry.innate ?? TRAIT_IDS[entry.seed % TRAIT_IDS.length]][0])}
                  </InfoPrefix>
                </small>
                <small>{t('레벨당 성장 배율')}</small>
                <dl>
                  {ABILITY_INFO.map(({ name: label, key, description }) => (
                    <div key={key}>
                      <dt>
                        <InfoPrefix
                          icon={characterInfoIcon(key)}
                          label={t(label)}
                          description={t(description)}
                        >
                          {t(label)}
                        </InfoPrefix>
                      </dt>
                      <dd>×{entry.growth[key].toFixed(1)}</dd>
                    </div>
                  ))}
                </dl>
                <span>{selected === entry.id ? t('선택됨') : t('선택하기')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="recruitment-footer">
        <label className="recruitment-name" htmlFor="fighter-name">
          {t('무인의 이름')}
          <input
            id="fighter-name"
            value={name}
            maxLength={12}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="recruitment-actions">
          {recruitment.tickets === 0 && !recruitment.candidates.length && (
            <button disabled={disabled || !name.trim()} onClick={() => void begin(true)}>
              {t('기본 무인으로 출전')}
            </button>
          )}
          <button
            className="primary"
            disabled={disabled || !candidate || !name.trim()}
            onClick={() => void begin()}
          >
            {t('강호에 나서기 →')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
