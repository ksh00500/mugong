import { pendingChoices } from '../domain/character';
import { t } from '../platform/i18n';
import { ARTS, isBoss, maximumHp, nextXp, xpThreshold } from '../domain/content';
import { bossById, regionName } from '../domain/campaign';
import { hasWeapon } from '../domain/inventory';
import { encounterHint } from '../domain/boss-encounters';
import { useRef, type CSSProperties } from 'react';
import { techniqueStats } from '../domain/techniques';
import { QuickDetails } from './QuickDetails';
import type { Run } from '../domain/model';
import { gameStore } from '../platform/store';
import { ArtGlyph, Meter } from './shared';
import { Icon } from './Icons';
import { characterPortrait } from '../platform/character-art';
import { HudArtwork } from './HudArtwork';
export function Hud({ run, busy }: { run: Run; busy: boolean }) {
  const scope = useRef<HTMLDivElement>(null);
  const f = run.fighter,
    art = f.arts[f.active],
    boss = run.enemies.find((e) => e.kind === 'chief' || e.kind === 'captain');
  const unlocked = !!art && art.level >= techniqueStats(art.id, art.level).ultimateLevel;
  const gaugeMax = art?.id === 'gaebang' ? 200 : 100;
  const canSwitch = !busy && f.actionTime <= 0 && !pendingChoices(run);
  const slots = f.arts.length
    ? f.arts.map((_, index) => {
        const offset = index - Math.floor(f.arts.length / 2);
        return { offset, index: (f.active + offset + f.arts.length) % f.arts.length };
      })
    : [{ offset: 0, index: -1 }];
  const defenseName = {
    huashan: '회피',
    wudang: '반격',
    tianmo: '혈기탈취',
    samja: '방어',
    tang: '독연보',
    shaolin: '금강체',
    gaebang: '취보',
    jegal: '기문보',
  };
  return (
    <div className="hud wuxia-hud" ref={scope}>
      <div className="hud-top">
        <section
          className={`player-panel ${f.hp / maximumHp(f) <= 0.25 ? 'critical-health' : ''}`}
          aria-label={t('무인 상태')}
        >
          <HudArtwork shape="player" />
          <div
            className={`hud-portrait ${f.portrait === undefined && f.appearance === undefined ? '' : 'portrait-variant'}`}
          >
            <img src={characterPortrait(f)} decoding="async" alt="" />
          </div>
          <div className="hud-vitals">
            <div className="player-name">
              <b title={f.name}>{f.name}</b>
              <span className="hud-level" key={f.level}>
                Lv.{f.level}
              </span>
            </div>
            <div className="hud-health">
              <div className="health-line">
                <small>{t(f.hp / maximumHp(f) <= 0.25 ? '체력 · 위험' : '체력')}</small>
                <span>
                  {Math.ceil(f.hp)} / {maximumHp(f)}
                </span>
              </div>
              <Meter value={f.hp} max={maximumHp(f)} identity={f.id} />
            </div>
            <div className="hud-experience">
              <div className="xp-line">
                <span>{t('경험치')}</span>
                <span>
                  {Math.floor(f.xp - xpThreshold(f.level))} /{' '}
                  {nextXp(f.level) - xpThreshold(f.level)}
                </span>
              </div>
              <Meter
                key={`${f.id}-${f.level}`}
                value={f.xp - xpThreshold(f.level)}
                max={nextXp(f.level) - xpThreshold(f.level)}
                kind="experience"
              />
            </div>
          </div>
        </section>
        <div className="boss-area">
          {isBoss(run.wave) && boss && run.phase === 'combat' ? (
            <section className="boss-panel">
              <HudArtwork shape="boss" />
              <b>
                {t(
                  bossById(boss.bossId)?.name ??
                    (boss.kind === 'chief'
                      ? boss.elite
                        ? t('검은 매 대두목')
                        : t('산채 두목')
                      : boss.elite
                        ? t('혈궁의 수문장')
                        : t('산문 궁수장')),
                )}
              </b>
              <div className="boss-health">
                <Meter
                  value={boss.hp}
                  max={boss.maxHp}
                  identity={`${run.id}-${boss.id}`}
                  label={t('보스 체력')}
                />
                <small>
                  {Math.ceil(boss.hp)} / {boss.maxHp}
                </small>
              </div>
            </section>
          ) : (
            <div className="region-label">
              <HudArtwork shape="ribbon" />
              <b>{t(regionName(run))}</b>
            </div>
          )}
        </div>
        <section className="progress-panel" aria-label={t('강호 진행')}>
          <div className="wave-ribbon">
            <HudArtwork shape="ribbon" />
            <small>{t('강호')}</small>
            <b>
              {run.wave}
              <span>{t(' / 20 웨이브')}</span>
            </b>
          </div>
          <div className="hud-actions">
            <button aria-label={`${t('가방')} Tab`} onClick={() => gameStore.openBag(true)}>
              <Icon name="bag" />
              {t(' 가방 ')}
              <kbd>Tab</kbd>
            </button>
            <button
              className="icon-button"
              aria-label={t('일시 정지')}
              onClick={() => gameStore.pause(true)}
            >
              <Icon name="pause" />
            </button>
          </div>
        </section>
      </div>
      <div className="field-caption">{run.phase === 'combat' ? t(encounterHint(run)) : ''}</div>
      <div className="hud-bottom">
        <section className="art-fan" aria-label={t('무공 전환')}>
          <HudArtwork shape="fan" />
          <div className="fan-heading">
            <HudArtwork shape="ink" />
            <button
              disabled={!canSwitch || f.arts.length < 2}
              aria-label={t('이전 무공')}
              onClick={() => void gameStore.dispatch({ type: 'switch', delta: -1 })}
            >
              <kbd>Q</kbd> ‹
            </button>
            <b
              className="fan-current-name"
              title={art ? t(ARTS[art.id].name) : t('미숙한 기본 공격')}
            >
              {art ? t(ARTS[art.id].name) : t('미숙한 기본 공격')}
            </b>
            <button
              disabled={!canSwitch || f.arts.length < 2}
              aria-label={t('다음 무공')}
              onClick={() => void gameStore.dispatch({ type: 'switch', delta: 1 })}
            >
              › <kbd>E</kbd>
            </button>
          </div>
          <div className="fan-cards" data-count={slots.length}>
            {slots.map(({ index, offset }) => {
              const a = f.arts[index];
              return (
                <button
                  key={a?.id ?? 'untrained'}
                  className={`fan-card ${offset === 0 ? 'selected' : ''}`}
                  style={
                    {
                      '--fan-x': `${50 + (slots.length === 4 ? offset + 0.5 : offset) * 21}%`,
                      '--fan-y': `${18 + Math.pow(slots.length === 4 ? offset + 0.5 : offset, 2) * 20}px`,
                    } as CSSProperties
                  }
                  disabled={!a || !canSwitch}
                  data-technique={a?.id}
                  data-level={a?.level}
                  aria-pressed={!!a && offset === 0}
                  aria-label={a ? t('{0} 전환', { 0: t(ARTS[a.id].name) }) : t('미숙한 기본 공격')}
                  onClick={() =>
                    void gameStore.dispatch({ type: 'switch', delta: index - f.active })
                  }
                >
                  <span className="fan-leaf">
                    <ArtGlyph id={a?.id} />
                  </span>
                  <span className="fan-card-name">{a ? t(ARTS[a.id].short) : '—'}</span>
                  <small>{a ? `Lv.${a.level}` : 'Lv.0'}</small>
                </button>
              );
            })}
          </div>
        </section>
        <section
          className={`ultimate-panel ${unlocked && art.gauge >= 100 ? 'ultimate-ready' : ''}`}
        >
          <HudArtwork shape="gauge" />
          <div className="ultimate-heading">
            <b>{t(art?.id === 'gaebang' ? '취기' : '궁극')}</b>
            <span>{unlocked ? `${Math.floor(art.gauge)} / ${gaugeMax}` : t('미개방')}</span>
          </div>
          <Meter
            key={art?.id ?? 'locked'}
            value={unlocked ? art.gauge : 0}
            max={gaugeMax}
            kind="ultimate"
          />
          <small>
            {unlocked
              ? art.gauge >= 100
                ? art.id === 'gaebang'
                  ? t('우클릭으로 강화 예약 · {0}/2', { 0: art.queuedBoosts ?? 0 })
                  : t('우클릭으로 궁극 행동')
                : t('현재 무공으로 적을 타격해 충전')
              : t('무공 Lv.{0} 개방', {
                  0: art ? techniqueStats(art.id, art.level).ultimateLevel : 5,
                })}
          </small>
        </section>
        <section className="defense-panel" aria-label={t('방어 행동')}>
          <header>
            <HudArtwork shape="ribbon" />
            <b>{art ? t(ARTS[art.id].defense.split(' · ')[0]) : t('방어 행동')}</b>
            <kbd>Space</kbd>
          </header>
          <div className="defense-cooldowns">
            {f.arts.map((a, index) => {
              const max = techniqueStats(a.id, a.level, f).defenseCooldown;
              const available = hasWeapon(f, a.id);
              return (
                <div
                  key={a.id}
                  className={`defense-slot ${index === f.active ? 'active' : ''}`}
                  data-art={a.id}
                  data-state={!available ? 'unarmed' : a.defenseCd > 0 ? 'cooling' : 'ready'}
                  title={t(ARTS[a.id].defense)}
                >
                  <div
                    className="cooldown-dial"
                    role="img"
                    aria-label={`${t(defenseName[a.id])} · ${!available ? t('무장 필요') : a.defenseCd > 0 ? t('{0}초', { 0: a.defenseCd.toFixed(1) }) : t('준비')}`}
                    style={
                      {
                        '--cooldown-turn': `${Math.min(1, a.defenseCd / max) * 360}deg`,
                      } as CSSProperties
                    }
                  >
                    <HudArtwork shape="medallion" />
                    <ArtGlyph id={a.id} />
                    <b aria-hidden="true">
                      {a.defenseCd > 0 ? a.defenseCd.toFixed(1) : available ? '✓' : '—'}
                    </b>
                  </div>
                  <span>{t(defenseName[a.id])}</span>
                </div>
              );
            })}
            {!art && <span className="defense-empty">{t('첫 레벨에서 무공을 선택합니다')}</span>}
          </div>
          {art && (
            <small className="defense-state">
              {!hasWeapon(f, art.id)
                ? t('무장 필요')
                : art.defenseCd > 0
                  ? t('{0}초', { 0: art.defenseCd.toFixed(1) })
                  : t('준비')}
            </small>
          )}
        </section>
      </div>
      <QuickDetails scope={scope} fighter={f} />
    </div>
  );
}
