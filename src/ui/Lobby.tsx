import { RecruitmentDialog } from './RecruitmentDialog';
import { CombatReview } from './CombatReview';
import { t, gameTitle, warriorUnit, formatNumber } from '../platform/i18n';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { QuickDetails } from './QuickDetails';
import { ARTS, maximumHp } from '../domain/content';
import type { View } from '../platform/store';
import { gameStore } from '../platform/store';
import { unlockAudio } from '../platform/audio';
import { ArtGlyph, lifespan, Meter, Modal } from './shared';
import { Icon, ItemArt } from './Icons';
import { PaintedSprite } from './PaintedSprite';
import { characterPortrait, characterLobbyFigure } from '../platform/character-art';
import { APPEARANCES } from '../domain/appearances';
import { warmCombat } from '../platform/game-loader';

export function Lobby({
  view,
  openWarehouse,
  muted,
  toggleSound,
  openSettings,
}: {
  view: View;
  openWarehouse: () => void;
  muted: boolean;
  toggleSound: () => void;
  openSettings: () => void;
}) {
  const detailsScope = useRef<HTMLElement>(null);
  const [creating, setCreating] = useState(false),
    [name, setName] = useState(t('무명'));
  const [records, setRecords] = useState(false),
    [guide, setGuide] = useState(false);
  const [rosterPage, setRosterPage] = useState(0);
  const [nameEdited, setNameEdited] = useState(false);
  const family = view.state.family;
  const rosterIndex = Math.min(rosterPage, Math.max(0, family.roster.length - 1));
  const fighter = family.roster.find((f) => f.id === view.state.selectedId) ?? family.roster[0];
  const run = view.state.run;
  const lobbyFigure = characterLobbyFigure(run?.fighter ?? fighter);
  const available = !!fighter && !run;
  const supplies = family.warehouse.reduce((n, item) => n + item.count, 0);
  const begin = () => {
    warmCombat();
    unlockAudio();
    if (!nameEdited) setName(t('무명'));
    setCreating(true);
  };
  useEffect(() => {
    const selected = family.roster.findIndex((entry) => entry.id === view.state.selectedId);
    if (selected >= 0) setRosterPage(selected);
  }, [family.roster, view.state.selectedId]);
  const showRoster = (index: number) => {
    const next = family.roster[index];
    if (!next) return;
    setRosterPage(index);
    if (next.id !== fighter?.id) void gameStore.dispatch({ type: 'select', id: next.id });
  };

  return (
    <main className="lobby home-scene home-v3" ref={detailsScope}>
      <header className="home-header">
        <div className="home-brand">
          <PaintedSprite index={12} className="home-brand-mark" />
          <div>
            <b>{gameTitle()}</b>
          </div>
        </div>
        <nav className="home-nav" aria-label={t('세가 메뉴')}>
          <button
            className="active"
            aria-current="page"
            onClick={() => {
              setRecords(false);
              setGuide(false);
            }}
          >
            <Icon name="sword" />
            {t('출전')}
          </button>
          <button
            disabled={!available || view.busy}
            title={
              run
                ? t('진행 중인 강호에서 가방을 확인하세요')
                : !fighter
                  ? t('강호를 완주하면 무인의 가방을 관리할 수 있습니다')
                  : t('선택한 무인의 무장과 가방')
            }
            onClick={() => gameStore.openBag(true)}
          >
            <Icon name="bag" />
            {t('가방')}
          </button>
          <button onClick={openWarehouse}>
            <Icon name="warehouse" />
            {t('창고')}
          </button>
          <button onClick={() => setRecords(true)}>
            <Icon name="record" />
            {t('기록')}
          </button>
        </nav>
        <div className="home-header-end">
          <button
            className="home-round-button"
            aria-label={muted ? t('소리 켜기') : t('소리 끄기')}
            aria-pressed={!muted}
            onClick={() => {
              unlockAudio();
              toggleSound();
            }}
          >
            <Icon name={muted ? 'muted' : 'sound'} />
          </button>
          <button className="home-round-button" aria-label={t('설정')} onClick={openSettings}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <div className="home-stage">
        <section className="home-departure" aria-label={t('출전 준비')}>
          <div className="home-section-label">
            <span />
            {t('江湖 · 강호')}
          </div>
          <h1>{t(run ? '여정을 이어가세요' : '강호에 나서세요')}</h1>
          {run ? (
            <div className="home-run-card">
              <div className="home-run-heading">
                <span className="home-live-dot" />
                <b>{run.fighter.name}</b>
                <span>Lv.{run.fighter.level}</span>
              </div>
              <div className="home-run-progress">
                <strong>
                  {run.wave}
                  <small>{t(' / 20 웨이브')}</small>
                </strong>
              </div>
              <div
                className="home-wave-track"
                role="img"
                aria-label={t('강호 {0}웨이브 진행 중', { 0: run.wave })}
              >
                <i style={{ width: `${(run.wave / 20) * 100}%` }} />
              </div>
              <div className="health-line">
                <span>{t('남은 체력')}</span>
                <b>
                  {Math.ceil(run.fighter.hp)} / {maximumHp(run.fighter)}
                </b>
              </div>
              <Meter
                value={run.fighter.hp}
                max={maximumHp(run.fighter)}
                identity={run.fighter.id}
              />
            </div>
          ) : (
            <div className="home-start-facts">
              <span>{t('Lv.0 시작')}</span>
              <i aria-hidden="true">→</i>
              <span>{t('20웨이브')}</span>
            </div>
          )}
          <button
            className="primary home-launch"
            aria-describedby={!family.roster.length && !run ? 'empty-roster-guidance' : undefined}
            onMouseEnter={warmCombat}
            onFocus={warmCombat}
            disabled={view.busy || !!family.training}
            aria-label={
              run ? t('강호 이어하기 {0} / 20 →', { 0: run.wave }) : t('새 무인으로 출전 →')
            }
            onClick={
              run
                ? () => {
                    unlockAudio();
                    gameStore.resume();
                  }
                : begin
            }
          >
            <Icon name="sword" />
            <span>
              <b>{run ? t('강호 이어하기') : t('새 무인으로 출전')}</b>
            </span>
            <Icon name="arrow" />
          </button>
        </section>

        <section className="home-hero" aria-label={t('무인 초상')}>
          <span className="home-hero-script" aria-hidden="true">
            武
          </span>
          <div className="home-hero-ring" />
          <div className="home-hero-ground" />
          <img
            className="home-hero-image"
            src={lobbyFigure.src}
            width={lobbyFigure.width}
            height={lobbyFigure.height}
            style={
              {
                '--lobby-art-width': `${lobbyFigure.width}px`,
                '--lobby-art-height': `${lobbyFigure.height}px`,
              } as CSSProperties
            }
            decoding="async"
            alt={t(
              (run?.fighter ?? fighter)?.appearance === undefined
                ? '흰 도포와 붉은 허리띠를 한 검객'
                : APPEARANCES[(run?.fighter ?? fighter)!.appearance!].name,
            )}
            fetchPriority="high"
          />
        </section>

        <aside className="roster-panel panel home-roster" aria-label={t('무인 명부')}>
          <header>
            <div>
              <h2>{t('무인 명부')}</h2>
            </div>
            <span className="home-count">
              {formatNumber(family.roster.length)}
              <small>{warriorUnit(family.roster.length)}</small>
            </span>
          </header>
          {!family.roster.length ? (
            <div className="home-empty-roster">
              <div className="home-empty-emblem">
                <Icon name="record" />
              </div>
              <div className="home-empty-copy" id="empty-roster-guidance">
                <b>{t(run ? '여정을 이어 완주해 보세요.' : '새 무인으로 첫 여정을 시작하세요.')}</b>
                <p>{t('20웨이브를 완주하면 무공·가방을 지닌 채 귀환합니다.')}</p>
                <small>{t('귀환한 무인은 7일 동안 명부·가방·창고에서 관리합니다.')}</small>
                <button onClick={() => setGuide(true)}>{t('귀환·보존 규칙 보기')}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="roster-list home-roster-list">
                {family.roster.slice(rosterIndex, rosterIndex + 1).map((f) => (
                  <button
                    key={f.id}
                    disabled={!!run || view.busy}
                    onClick={() => void gameStore.dispatch({ type: 'select', id: f.id })}
                    aria-pressed={fighter?.id === f.id}
                    className={fighter?.id === f.id ? 'selected' : ''}
                  >
                    <span className="home-roster-avatar" aria-hidden="true">
                      {f.portrait === undefined && f.appearance === undefined ? (
                        f.name.charAt(0)
                      ) : (
                        <img src={characterPortrait(f)} alt="" width={48} height={48} />
                      )}
                    </span>
                    <span>
                      <b title={f.name}>{f.name}</b>
                      <small>Lv.{f.level}</small>
                    </span>
                    <em>{lifespan(f.expiresAt)}</em>
                  </button>
                ))}
              </div>
              {family.roster.length > 1 && (
                <div className="roster-pagination">
                  <button
                    aria-label={t('명부 이전 무인')}
                    disabled={rosterIndex === 0}
                    onClick={() => showRoster(rosterIndex - 1)}
                  >
                    ‹
                  </button>
                  <span>
                    {rosterIndex + 1} / {family.roster.length}
                  </span>
                  <button
                    aria-label={t('명부 다음 무인')}
                    disabled={rosterIndex + 1 >= family.roster.length}
                    onClick={() => showRoster(rosterIndex + 1)}
                  >
                    ›
                  </button>
                </div>
              )}
              {fighter && (
                <div className="home-fighter-detail">
                  <div className="health-line">
                    <span>{t('남은 체력')}</span>
                    <b>
                      {Math.ceil(fighter.hp)} / {maximumHp(fighter)}
                    </b>
                  </div>
                  <Meter value={fighter.hp} max={maximumHp(fighter)} identity={fighter.id} />
                  <div className="home-art-list">
                    {fighter.arts.map((a) => (
                      <div
                        key={a.id}
                        data-technique={a.id}
                        data-level={a.level}
                        tabIndex={0}
                        role="group"
                        aria-label={t('{0} 설명', { 0: t(ARTS[a.id].name) })}
                      >
                        <ArtGlyph id={a.id} />
                        <b>Lv.{a.level}</b>
                      </div>
                    ))}
                  </div>
                  <button
                    className="home-bag-link"
                    disabled={!!run || view.busy}
                    onClick={() => gameStore.openBag(true)}
                    aria-label={t('무장과 가방 살펴보기')}
                  >
                    <Icon name="bag" />
                    {t('가방')}
                    <Icon name="arrow" />
                  </button>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <section className="home-dock" aria-label={t('세가 관리')}>
        <button
          className="home-dock-card home-guide-card"
          onClick={() => setGuide(true)}
          aria-label={t('강호 입문 안내')}
          title={t('강호 입문 안내')}
        >
          <span className="home-dock-icon">
            <Icon name="compass" />
          </span>
          <span aria-hidden="true">?</span>
        </button>
      </section>
      <footer className="home-footer">
        <span className="home-save-status" role="status">
          <i className={view.error ? 'failed' : ''} />
          {view.error
            ? t('저장 확인 필요')
            : view.busy || view.saving
              ? t('기록을 남기는 중…')
              : t('저장됨')}
        </span>
      </footer>

      {creating && (
        <RecruitmentDialog
          view={view}
          name={name}
          setName={(value) => {
            setNameEdited(true);
            setName(value);
          }}
          onClose={() => setCreating(false)}
        />
      )}
      {records && (
        <Modal
          title={t('세가의 기록')}
          onClose={() => setRecords(false)}
          className="journey-records"
        >
          <div className="home-records">
            <span className="eyebrow">{t('무명세가의 발자취')}</span>
            <h3>{t('강호가 기억하는 이름들')}</h3>
            <div className="home-record-grid">
              {[
                [t('출전'), family.runs, '旅'],
                [t('강호 완주'), family.victories, '成'],
                [t('강호 전사'), family.deaths, '殞'],
                [t('수명 만료'), family.retired, '歸'],
              ].map(([label, value, mark]) => (
                <div key={label}>
                  <span>{mark}</span>
                  <small>{label}</small>
                  <b>{typeof value === 'number' ? formatNumber(value) : value}</b>
                </div>
              ))}
            </div>
            <div className="home-record-summary">
              <span>
                {t('현재 명부 ')}
                <b>
                  {formatNumber(family.roster.length)} {warriorUnit(family.roster.length)}
                </b>
              </span>
              <span>
                {t('보관 물품 ')}
                <b>
                  {formatNumber(supplies)}
                  {t('개')}
                </b>
              </span>
            </div>
            {!family.runs && <p>{t('첫 출전부터 세가의 기록이 쌓입니다.')}</p>}
            {!!family.silver && <p>{t('세가 자금 {0}전', { 0: family.silver })}</p>}
            {family.journeys?.[0] && (
              <p>
                {t('최근 여정')} · {family.journeys[0].name} · Lv.{family.journeys[0].level} ·{' '}
                {t(family.journeys[0].outcome === 'victory' ? '강호 완주' : '강호 전사')}
              </p>
            )}
            {!!family.journeys?.length && (
              <div className="journey-history">
                {family.journeys.map((journey) => (
                  <details key={journey.id}>
                    <summary>
                      {journey.name} · {journey.wave}
                      {t('웨이브')} · {t(journey.outcome === 'dead' ? '강호 전사' : '강호 완주')}
                    </summary>
                    <CombatReview report={journey.combatReport} />
                  </details>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
      {guide && (
        <Modal title={t('강호 입문 안내')} onClose={() => setGuide(false)}>
          <div className="home-guide">
            <div className="home-guide-intro">
              <Icon name="compass" />
              <p>
                {t('강호는 새로운 무인을 만드는 여정입니다.')}
                <br />
                {t('20웨이브를 완주하면 체력·무공·물품을 유지해 귀환합니다.')}
              </p>
            </div>
            <dl>
              <dt>
                <kbd>WASD</kbd>
              </dt>
              <dd>{t('이동')}</dd>
              <dt>{t('좌클릭')}</dt>
              <dd>{t('바라보는 방향으로 기본 공격')}</dd>
              <dt>{t('우클릭')}</dt>
              <dd>{t('궁극 행동 · 무공 성장 후 개방')}</dd>
              <dt>
                <kbd>Q</kbd> / <kbd>E</kbd>
              </dt>
              <dd>{t('보유 무공 전환')}</dd>
              <dt>
                <kbd>Space</kbd>
              </dt>
              <dd>{t('현재 무공의 회피·반격·방어')}</dd>
              <dt>
                <kbd>Tab</kbd> / <kbd>I</kbd>
              </dt>
              <dd>{t('가방 · 전투 중에는 정보만 확인')}</dd>
              <dt>
                <kbd>Esc</kbd>
              </dt>
              <dd>{t('일시 정지 · 저장하고 다음에 이어하기')}</dd>
            </dl>
            <div className="home-guide-rules">
              <p>
                {t(
                  '전사하면 해당 무인과 여정의 물품은 사라집니다. 세가 창고와 기존 자금은 유지됩니다.',
                )}
              </p>
              <p>{t('귀환한 무인은 7일 동안 명부·가방·창고에서 관리합니다.')}</p>
              <p>{t('수명이 끝나면 무인의 물품은 세가 창고로 옮겨집니다.')}</p>
              <p>
                <b>{t('레벨이 오르면')}</b>
                {t('새 무공을 배우거나 보유 무공을 성장시킵니다.')}
              </p>
              <p>
                <b>{t('전투가 끝나면')}</b>
                {t('획득 물품을 수납·착용·사용하고 가방을 정리합니다.')}
              </p>
              <p>
                <b>{t('세가로 돌아오면')}</b>
                {t('가방과 창고를 연결해 물품을 관리합니다.')}
              </p>
            </div>
          </div>
        </Modal>
      )}
      <QuickDetails scope={detailsScope} fighter={fighter} />
    </main>
  );
}
