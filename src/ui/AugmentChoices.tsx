import { useEffect, useState } from 'react';
import { AUGMENTS, AUGMENT_LEVELS } from '../domain/character';
import type { Fighter } from '../domain/model';
import { gameStore } from '../platform/store';
import { t } from '../platform/i18n';
import { Modal } from './shared';
import { AugmentArtwork } from './CharacterArtwork';

export function AugmentChoices({fighter,busy}:{fighter:Fighter;busy:boolean}) {
  const [locked,setLocked]=useState(true);
  const [error,setError]=useState('');
  useEffect(() => {const timer=window.setTimeout(() => setLocked(false),400);return () => clearTimeout(timer);},[]);
  return <Modal title={t('성장 특성 선택')} className="character-augment">
    <p>{t('Lv.{0} · 이 무인에게 남는 성장', {0:AUGMENT_LEVELS[fighter.augments?.length ?? 0]})}</p>
    <div className="augment-cards">{fighter.augmentOffers?.map(id => <button key={id} disabled={locked||busy} onClick={async () => {
      if (!(await gameStore.dispatch({type:'chooseAugment',id}))) setError(gameStore.notice);
    }}><AugmentArtwork id={id} /><strong>{t(AUGMENTS[id][0])}</strong><span>{t(AUGMENTS[id][1])}</span><b>{t('선택하기 →')}</b></button>)}</div>
    <p role="status">{t(error || (busy ? '저장 중' : locked ? '잠시 후 선택 가능' : '무공과 별개로 적용됩니다.'))}</p>
  </Modal>;
}
