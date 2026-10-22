import { AUGMENTS, TRAITS, characterStats } from '../domain/character';
import type { Fighter } from '../domain/model';
import { t, useLanguage } from '../platform/i18n';
import { gameStore } from '../platform/store';
import { eligibleOffers } from '../domain/game';
import { AugmentArtwork } from './CharacterArtwork';
import { Icon } from './Icons';
import { ABILITY_INFO, InfoPrefix, characterInfoIcon } from './CharacterInfo';

export function CharacterProfile({ fighter }: { fighter: Fighter }) {
  const { locale } = useLanguage();
  if (fighter.progressionVersion !== 2) return null;
  const stats = characterStats(fighter);
  const trait = fighter.innate ? TRAITS[fighter.innate] : undefined;
  return (
    <section className="character-profile" aria-label={t('기본 능력')}>
      <dl>
        {ABILITY_INFO.map(({ name, key, abbreviation, description }) => (
          <div key={key}>
            <dt>
              <InfoPrefix
                icon={characterInfoIcon(key)}
                label={t(name)}
                description={t(description)}
              >
                {locale === 'en' ? abbreviation : t(name)}
              </InfoPrefix>
            </dt>
            <dd>{stats[key].toFixed(1)}</dd>
          </div>
        ))}
      </dl>
      <div className="character-profile-attributes">
        <div className="character-profile-trait">
          <InfoPrefix
            icon={characterInfoIcon('trait')}
            label={t(trait?.[0] ?? '특성 없음')}
            description={t(trait?.[1] ?? '타고난 특성이 없는 무인입니다.')}
          >
            {t(trait?.[0] ?? '특성 없음')}
          </InfoPrefix>
        </div>
        {!!fighter.augments?.length && (
          <div className="character-augment-names">
            {fighter.augments.map((id) => (
              <span key={id}>
                <InfoPrefix
                  artwork={<AugmentArtwork id={id} />}
                  label={t(AUGMENTS[id][0])}
                  description={t(AUGMENTS[id][1])}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function CharacterTraining({ fighter }: { fighter: Fighter }) {
  if (fighter.progressionVersion !== 2) return null;
  return (
    <div className="character-training-row">
      <InfoPrefix
        artwork={<Icon name="record" />}
        label={t('수련')}
        description={t('무공 수련은 웨이브 완료로 얻습니다. 보스 완료 시 3을 얻습니다.')}
      />
      <button
        type="button"
        className="character-training"
        disabled={gameStore.busy || !eligibleOffers(fighter).length}
        onClick={() => void gameStore.dispatch({ type: 'openTraining' })}
      >
        {t('수련')} {fighter.trainingPoints ?? 0} →
      </button>
    </div>
  );
}
