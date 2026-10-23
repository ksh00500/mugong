import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { RaidClient } from './client';
import { PvpControls } from '../pvp/controls';
import { Auth } from '../pvp/PvpApp';
import { PVP_PRESETS } from '../pvp/rules';
import type { PresetId } from '../pvp/model';
import { RAID_FLOORS, type RaidMessage, type RaidReceipt } from './model';
import { ARTS } from '../domain/content';
import { combatActionBlock } from '../domain/combat-actions';
import { ArtGlyph, Meter, Modal } from '../ui/shared';
import { t, useLanguage } from '../platform/i18n';
import { preloadFonts } from '../platform/assets';
import type { OnlineSave } from '../online/protocol';
import { PersonalManagement } from './PersonalManagement';
import { characterPortrait } from '../platform/character-art';
function RaidArena({
  client,
  controls,
  onReady,
  onFailure,
  attempt,
}: {
  client: RaidClient;
  controls: PvpControls;
  onReady: (v: boolean) => void;
  onFailure: (v: boolean) => void;
  attempt: number;
}) {
  const root = useRef<HTMLDivElement>(null),
    [progress, setProgress] = useState(0);
  useEffect(() => {
    let cancelled = false,
      dispose: (() => void) | undefined;
    onReady(false);
    onFailure(false);
    setProgress(0);
    Promise.all([import('../pvp/arena'), import('./art').then((m) => m.prepareRaidArtwork())])
      .then(([{ mountPvpArena }, art]) => {
        if (cancelled || !root.current) return;
        dispose = mountPvpArena(
          root.current,
          client,
          controls,
          () => {
            if (!cancelled) onReady(true);
          },
          () => {
            if (!cancelled) onFailure(true);
          },
          (v) => {
            if (!cancelled) setProgress(v);
          },
          art,
        );
      })
      .catch(() => {
        if (!cancelled) onFailure(true);
      });
    return () => {
      cancelled = true;
      onReady(false);
      dispose?.();
    };
  }, [client, controls, onReady, onFailure, attempt]);
  return (
    <>
      <div className="pvp-canvas" ref={root} aria-label={t('협동 레이드 전장')} />
      {progress < 1 && (
        <div className="pvp-art-progress" role="status">
          {t('레이드 그림 준비')} · {Math.round(progress * 100)}%
        </div>
      )}
    </>
  );
}
function Rules({ personal = false }: { personal?: boolean }) {
  return (
    <div className="pvp-rule-text">
      <p>
        {t(
          personal
            ? '개인 무인 1~4인 · 흑풍산채 5층 · 영구 사망'
            : '표준 무인 1~4인 · 흑풍산채 5층 · 아군 피해 없음',
        )}
      </p>
      <p>{t('보스 체력은 층 시작 인원으로 고정됩니다. 사망한 무인은 부활하지 않습니다.')}</p>
      <p>
        {t(
          '층 사이에 귀환하거나 전원 준비로 다음 층에 도전합니다. 인원이 바뀌면 준비가 취소됩니다.',
        )}
      </p>
      <p>
        {t(
          '전투는 일시정지되지 않습니다. 연결이 끊겨도 90초 동안 자리를 보존하며 무인은 위험에 노출됩니다.',
        )}
      </p>
      <p>
        {t(
          personal
            ? '개인 출전은 온라인 강호에서 키운 무인을 사용합니다. 수명 만료 시 자기 물품은 창고로 돌아갑니다.'
            : '표준 출전은 도전 기록만 저장합니다. 개인 무인·장비·경험치·유품 이전은 지원하지 않습니다.',
        )}
      </p>
      <p>
        WASD · {t('이동')} / {t('좌클릭 공격')} / Q·E · {t('무공 전환')} / Space · {t('방어')} /{' '}
        {t('우클릭 궁극')}
      </p>
    </div>
  );
}
export function RaidApp() {
  const [client] = useState(() => new RaidClient()),
    view = useSyncExternalStore(client.subscribe, client.getSnapshot),
    { locale } = useLanguage();
  const [boot, setBoot] = useState(true),
    [error, setError] = useState(''),
    [preset, setPreset] = useState<PresetId>('sword'),
    [code, setCode] = useState('');
  const [panel, setPanel] = useState<'rules' | 'leave' | null>(null),
    [artReady, setArtReady] = useState(false),
    [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<
    { run: string; state: string; floor: number; receipt: RaidReceipt | null }[]
  >([]);
  const [personal, setPersonal] = useState(false),
    [save, setSave] = useState<OnlineSave | null>(null),
    [fighterId, setFighterId] = useState('');
  const block = useRef(true),
    [controls] = useState(() => new PvpControls(client, () => block.current)),
    battle = useRef<HTMLElement>(null);
  const room = view.room,
    m = room?.match,
    me = m?.players[view.seat],
    status = m?.status[view.seat],
    active = me?.fighter.arts[me.fighter.active];
  const canAct = view.connected && m?.phase === 'fighting' && status === 'active' && !panel;
  block.current = !canAct;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('무공 · 협동 레이드');
    preloadFonts(locale);
  }, [locale]);
  useEffect(() => {
    let cancelled = false;
    controls.start();
    client
      .account()
      .then((a) => {
        if (!cancelled && a) client.connect();
      })
      .catch(() => {
        if (!cancelled) setError(t('비무 서버에 연결하지 못했습니다'));
      })
      .finally(() => {
        if (!cancelled) setBoot(false);
      });
    return () => {
      cancelled = true;
      controls.destroy();
      client.stop();
    };
  }, [client, controls]);
  useEffect(() => {
    if (!canAct) controls.clear();
    else battle.current?.focus();
  }, [canAct, controls]);
  useEffect(() => {
    if (!view.account) return;
    let cancelled = false;
    fetch('/api/pvp/raids', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error('history');
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setHistory(d.history);
      })
      .catch(() => {
        if (!cancelled) setError(t('레이드 기록을 불러오지 못했습니다'));
      });
    return () => {
      cancelled = true;
    };
  }, [view.account?.id, room?.receipt?.id]);
  useEffect(() => {
    if (!view.account || room) return;
    let active = true;
    fetch('/api/pvp/online', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((s: OnlineSave) => {
        if (active) {
          setSave(s);
          setFighterId((id) =>
            s.state.family.roster.some((f) => f.id === id)
              ? id
              : (s.state.family.roster[0]?.id ?? ''),
          );
        }
      })
      .catch(() => {
        if (active) setError(t('온라인 세가를 불러오지 못했습니다'));
      });
    return () => {
      active = false;
    };
  }, [view.account?.id, !!room]);
  const send = (message: RaidMessage) => {
    client.clearError();
    controls.clear();
    if (!client.send(message)) setError(t('연결을 확인한 뒤 다시 시도하세요'));
  };
  const command = (type: 'ready' | 'unready' | 'start' | 'return' | 'medicine') => {
    if (room) send({ type, revision: room.revision });
  };
  const readyMembers = room?.seats.filter(Boolean) ?? [],
    everyoneReady = readyMembers.length > 0 && readyMembers.every((p) => p!.ready && p!.connected);
  const reason = (action: 'defense' | 'ultimate') => {
    if (!canAct || !me) return t('전투 중에 사용');
    const r = combatActionBlock(me.fighter, action);
    return !r
      ? ''
      : r === 'cooling'
        ? t('재사용 {0}초', { 0: active!.defenseCd.toFixed(1) })
        : r === 'charging'
          ? t('타격해서 게이지 충전')
          : r === 'recovering'
            ? t('공격 후 회복 중')
            : t('지금은 사용할 수 없습니다');
  };
  const resultTitle =
    room?.receipt?.outcome === 'expired'
      ? t('수명 만료 · 장비 회수')
      : room?.receipt?.outcome === 'complete'
        ? t('산채 돌파')
        : room?.receipt?.outcome === 'returned'
          ? t('귀환 완료')
          : t('도전 종료');
  return (
    <div className="pvp-app raid-app" data-phase={m?.phase ?? (room ? 'waiting' : 'lobby')}>
      <header className="pvp-header">
        <a className="pvp-brand" href="/">
          武 <b>{t('무공')}</b>
        </a>
        <span>{t('협동 레이드')}</span>
        <div className="pvp-header-actions">
          <a href="/online/">{t('온라인 세가')}</a>
          <a href="/pvp/">{t('비무장')}</a>
          <button onClick={() => setPanel('rules')}>{t('레이드 규칙')}</button>
          {view.account && (
            <>
              <span className="pvp-account">{view.account.name}</span>
              <button
                disabled={!!room}
                onClick={() =>
                  void client.logout().catch(() => setError(t('접속 종료에 실패했습니다')))
                }
              >
                {t('로그아웃')}
              </button>
            </>
          )}
        </div>
      </header>
      {(error || view.error) && (
        <div className="pvp-connection-error" role="alert">
          {t(error || view.error)}
          <button
            onClick={() => {
              setError('');
              view.account ? client.connect() : location.reload();
            }}
          >
            {t('다시 시도')}
          </button>
        </div>
      )}
      {boot ? (
        <main className="pvp-boot" role="status">
          {t('비무 서버 확인 중')}
        </main>
      ) : !view.account ? (
        <main className="pvp-auth-main">
          <Auth client={client} raid />
        </main>
      ) : !room ? (
        <main className="pvp-lobby">
          <section className="pvp-selection">
            <span className="pvp-eyebrow">
              {personal ? t('개인 무인 · 서버 저장') : t('표준 무인 · 로컬 저장 보존')}
            </span>
            <h1>{t('함께 산채를 돌파')}</h1>
            <p>{t('표준 무인 1~4인 · 흑풍산채 5층 · 아군 피해 없음')}</p>
            <div className="raid-mode-picker">
              <button aria-pressed={!personal} onClick={() => setPersonal(false)}>
                {t('표준 체험')}
              </button>
              <button aria-pressed={personal} onClick={() => setPersonal(true)}>
                {t('개인 무인 출전')}
              </button>
            </div>
            {personal ? (
              <section className="raid-personal-selection">
                <p>
                  {t(
                    '온라인 강호 20웨이브를 완주한 무인으로 출전합니다. 사망 시 무인과 미수습 장비를 잃습니다. 로컬 무인은 이전하지 않습니다.',
                  )}
                </p>
                <a href="/online/">{t('온라인 무인 육성 · 가방 · 창고')}</a>
                {save?.state.run && <p>{t('진행 중인 강호를 먼저 마치세요.')}</p>}
                <label>
                  {t('출전할 개인 무인')}
                  <select value={fighterId} onChange={(e) => setFighterId(e.target.value)}>
                    <option value="">{t('무인 선택')}</option>
                    {save?.state.family.roster.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name} · Lv.{f.level} · HP {Math.ceil(f.hp)}
                      </option>
                    ))}
                  </select>
                </label>
                {!save?.state.family.roster.length && <p>{t('등록한 온라인 무인이 없습니다.')}</p>}
              </section>
            ) : (
              <>
                <p>
                  {t(
                    '표준 출전은 도전 기록만 저장합니다. 개인 무인·장비·경험치·유품 이전은 지원하지 않습니다.',
                  )}
                </p>
                <fieldset>
                  <legend>{t('출전 무인 선택')}</legend>
                  <div className="pvp-presets">
                    {Object.entries(PVP_PRESETS).map(([id, p]) => (
                      <button
                        key={id}
                        type="button"
                        className={preset === id ? 'selected' : ''}
                        aria-pressed={preset === id}
                        onClick={() => setPreset(id as PresetId)}
                      >
                        <img src={`/art/hero-roster-v1/portrait-${p.appearance}.webp`} alt="" />
                        <b>{t(p.name)}</b>
                        <span>{t(p.description)}</span>
                        <div>
                          {p.arts.map((a) => (
                            <ArtGlyph key={a} id={a} />
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            <div className="pvp-mode-actions">
              <section>
                <h2>{t('파티 만들기')}</h2>
                <p>{t('혼자 또는 최대 네 명이 함께 출전합니다.')}</p>
                <button
                  className="primary"
                  disabled={
                    !view.connected ||
                    (personal &&
                      (!fighterId ||
                        !!save?.locked ||
                        !!save?.state.run ||
                        !!save?.state.family.training))
                  }
                  onClick={() =>
                    send({ type: 'create', preset, ...(personal ? { fighterId } : {}) })
                  }
                >
                  {t('레이드 방 만들기')}
                </button>
              </section>
              <section>
                <h2>{t('파티 참가')}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send({
                      type: 'join',
                      preset,
                      code: code.trim().toUpperCase(),
                      ...(personal ? { fighterId } : {}),
                    });
                  }}
                >
                  <label>
                    {t('방 코드')}
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      maxLength={6}
                      pattern="[A-Z2-9]{6}"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    disabled={
                      !view.connected ||
                      (personal &&
                        (!fighterId ||
                          !!save?.locked ||
                          !!save?.state.run ||
                          !!save?.state.family.training))
                    }
                  >
                    {t('레이드 방 참가')}
                  </button>
                </form>
              </section>
            </div>
          </section>
          <aside className="pvp-records">
            <section>
              <h2>{t('흑풍산채 경로')}</h2>
              <ol className="raid-route">
                {RAID_FLOORS.map((f, i) => (
                  <li key={f.name}>
                    <b>
                      {i + 1} · {t(f.name)}
                    </b>
                    <small>{t(f.boss)}</small>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2>{t('최근 레이드')}</h2>
              <ul className="pvp-history">
                {!history.length && <li>{t('아직 레이드 기록이 없습니다.')}</li>}
                {history.slice(0, 8).map((h) => (
                  <li key={h.run}>
                    <b>
                      {h.receipt
                        ? t(
                            h.receipt.outcome === 'complete'
                              ? '산채 돌파'
                              : h.receipt.outcome === 'returned'
                                ? '귀환 완료'
                                : '도전 종료',
                          )
                        : t(h.state === 'void' ? '서버 재시작 · 경기 무효' : '대전 진행 중')}
                    </b>
                    <span>
                      {h.floor}/5 {t('완료 층')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </main>
      ) : (
        <main className="pvp-battle raid-battle" ref={battle} tabIndex={-1}>
          <RaidArena
            client={client}
            controls={controls}
            onReady={setArtReady}
            onFailure={setFailed}
            attempt={attempt}
          />
          <div className="raid-top">
            <section className="raid-personal">
              <b>{view.account.name}</b>
              <span>
                {Math.ceil(me?.fighter.hp ?? 240)} / {me?.maxHp ?? 240}
              </span>
              <Meter
                value={me?.fighter.hp ?? 240}
                max={me?.maxHp ?? 240}
                label={t('내 경기 체력')}
                identity={`${m?.id}-me`}
              />
              <div className="raid-party" aria-label={t('파티 체력')}>
                {room.seats.map((p, i) =>
                  p && i !== view.seat ? (
                    <div key={i}>
                      <span>
                        {p.name} ·{' '}
                        {t(
                          !p.connected
                            ? '연결 끊김'
                            : p.status === 'expired'
                              ? '수명 만료 · 장비 회수'
                              : p.status === 'dead'
                                ? '쓰러짐'
                                : p.status === 'returned'
                                  ? '귀환'
                                  : '참가 중',
                        )}
                      </span>
                      <Meter
                        value={m?.players[i].fighter.hp ?? 240}
                        max={m?.players[i].maxHp ?? 240}
                        label={t('{0} 체력', { 0: p.name })}
                        identity={`${m?.id}-${i}`}
                      />
                    </div>
                  ) : null,
                )}
              </div>
            </section>
            <section className="raid-boss-hud">
              <b>{m ? t(RAID_FLOORS[m.floor - 1].boss) : t('흑풍산채')}</b>
              <Meter
                value={m?.players[4].fighter.hp ?? 0}
                max={m?.players[4].maxHp ?? 1}
                label={t('레이드 보스 체력')}
                identity={`${m?.id}-${m?.floor}`}
              />
              <small>
                {m
                  ? `${m.floor}/5 · ${t(RAID_FLOORS[m.floor - 1].name)} · ${Math.ceil(m.floorTicks / 60)}s`
                  : t('입장 대기')}
              </small>
              {m?.phase === 'fighting' && (
                <span className="raid-threat">
                  {t(
                    m.boss.phase === 'windup'
                      ? {
                          cleave: '넓게 베기',
                          volley: '부채 사격',
                          guard: '정면 방어',
                          charge: '직선 돌진',
                          marks: '지면 표식',
                        }[m.boss.pattern]
                      : m.boss.phase === 'recover'
                        ? '반격 기회'
                        : '추격',
                  )}
                </span>
              )}
            </section>
          </div>
          {!room.match && (
            <section className="pvp-ready-panel raid-panel">
              <span className="pvp-eyebrow">
                {room.personal
                  ? t('개인 무인 · 영구 사망 · 서버 저장')
                  : t('표준 무인 · 로컬 저장 보존')}
              </span>
              <h1>{t('레이드 출전 준비')}</h1>
              <p>
                {t('방 코드')} <strong data-testid="raid-code">{room.code}</strong> ·{' '}
                {readyMembers.length}/4
              </p>
              <div className="raid-ready-grid">
                {room.seats.map((p, i) => (
                  <article key={i}>
                    {p ? (
                      <>
                        <img
                          src={
                            p.fighter
                              ? characterPortrait(p.fighter)
                              : `/art/hero-roster-v1/portrait-${PVP_PRESETS[p.preset].appearance}.webp`
                          }
                          alt=""
                        />
                        <b>{p.name}</b>
                        <small>{t(p.ready ? '대전 준비 완료' : '준비 중')}</small>
                      </>
                    ) : (
                      <small>{t('빈 자리')}</small>
                    )}
                  </article>
                ))}
              </div>
              {failed ? (
                <p role="alert">
                  {t('그림을 준비하지 못했습니다. 다시 준비를 눌러 주세요.')}
                  <button onClick={() => setAttempt((v) => v + 1)}>{t('다시 준비')}</button>
                </p>
              ) : (
                !artReady && <p role="status">{t('레이드 그림 준비')}</p>
              )}
              <div className="pvp-ready-actions">
                <button
                  disabled={!artReady || failed || !view.connected}
                  onClick={() => command(room.seats[view.seat]?.ready ? 'unready' : 'ready')}
                >
                  {t(room.seats[view.seat]?.ready ? '준비 취소' : '대전 준비')}
                </button>
                {view.seat === room.host && (
                  <button
                    className="primary"
                    disabled={!everyoneReady || !view.connected}
                    onClick={() => command('start')}
                  >
                    {t('산채 출발')}
                  </button>
                )}
                <button onClick={() => send({ type: 'leave' })}>{t('나가기')}</button>
              </div>
            </section>
          )}
          {m?.phase === 'countdown' && (
            <div className="pvp-countdown" role="status">
              {Math.ceil(m.phaseTicks / 60)}
            </div>
          )}
          {m?.phase === 'countdown' && m.floor > 1 && status === 'active' && (
            <div className="raid-countdown-actions">
              <button onClick={() => command('unready')}>{t('준비 취소')}</button>
              <button onClick={() => command('return')}>{t('지금 귀환')}</button>
            </div>
          )}
          {m?.phase === 'rest' && !room.receipt && status === 'active' && (
            <section className="pvp-ready-panel raid-panel">
              <h1>{t('층 클리어 · 정비')}</h1>
              <p>
                {m.cleared}/5 · {t('남은 인원')}{' '}
                {room.seats.filter((p, i) => p && m.status[i] === 'active').length} · {t('구성')}{' '}
                {room.revision}
              </p>
              <p>{t('다음 층은 남은 전원이 다시 준비해야 출발합니다.')}</p>
              <div className="raid-rest-members">
                {room.seats.map(
                  (p, i) =>
                    p && (
                      <div key={i}>
                        {p.name} ·{' '}
                        {t(
                          p.status === 'expired'
                            ? '수명 만료 · 장비 회수'
                            : p.status === 'dead'
                              ? '쓰러짐'
                              : p.status === 'returned'
                                ? '귀환'
                                : p.ready
                                  ? '대전 준비 완료'
                                  : '준비 중',
                        )}
                      </div>
                    ),
                )}
              </div>
              <div className="pvp-ready-actions">
                <button
                  disabled={
                    !view.connected ||
                    room.settling ||
                    (room.personal
                      ? !me?.fighter.items.some(
                          (i) => i.kind === 'medicine' && i.place === 'general',
                        )
                      : !m.medicine[view.seat]) ||
                    me!.fighter.hp >= me!.maxHp
                  }
                  onClick={() => command('medicine')}
                >
                  {t('회복약')}{' '}
                  {room.personal ? t('소지 약 사용') : `${m.medicine[view.seat]}/2 · +75`}
                </button>
                <button
                  disabled={!view.connected || room.settling || !artReady}
                  className="primary"
                  onClick={() => command(room.seats[view.seat]?.ready ? 'unready' : 'ready')}
                >
                  {t(room.seats[view.seat]?.ready ? '준비 취소' : '다음 층 준비')}
                </button>
                <button
                  disabled={!view.connected || room.settling}
                  onClick={() => command('return')}
                >
                  {t('지금 귀환')}
                </button>
              </div>
              {room.settling && <p role="status">{t('레이드 기록 저장 중')}</p>}
              {room.personal && <PersonalManagement client={client} />}
            </section>
          )}
          {(m?.phase === 'finished' ||
            (room.receipt && (status === 'returned' || status === 'expired'))) && (
            <section className="pvp-result raid-panel">
              <h1>{resultTitle}</h1>
              <p>
                {t('완료 층')} · {room.receipt?.floor ?? m?.cleared ?? 0}/5
              </p>
              <p>
                {room.personal
                  ? t('개인 무인·성장·장비와 귀환 결과를 서버에 저장했습니다.')
                  : t('로컬 무인·체력·장비는 그대로 보존되었습니다.')}
              </p>
              {room.personal && <a href="/online/">{t('온라인 세가 · 성장 · 장비 확인')}</a>}
              {room.receipt ? (
                <>
                  <p>
                    {t(
                      room.receipt.outcome === 'expired'
                        ? '수명 만료 · 장비 회수'
                        : room.receipt.outcome === 'dead'
                          ? '쓰러짐'
                          : room.receipt.outcome === 'time'
                            ? '시간 초과'
                            : room.receipt.outcome === 'abandoned'
                              ? '전원 연결 종료'
                              : room.receipt.outcome === 'complete'
                                ? '산채 돌파'
                                : '귀환 완료',
                    )}
                  </p>
                  <dl className="raid-receipt-stats">
                    <div>
                      <dt>{t('유효 피해')}</dt>
                      <dd>{room.receipt.damage}</dd>
                    </div>
                    <div>
                      <dt>{t('받은 피해')}</dt>
                      <dd>{room.receipt.taken}</dd>
                    </div>
                  </dl>
                  <small>{t('서버에 결과 저장 완료')}</small>
                  <button className="primary" onClick={() => send({ type: 'leave' })}>
                    {t('대기실로')}
                  </button>
                </>
              ) : (
                <p role="status">{t('레이드 기록 저장 중')}</p>
              )}
            </section>
          )}
          {m && m.phase !== 'finished' && status === 'dead' && (
            <section className="raid-spectator">
              <b>{t('쓰러짐 · 동료 관전 중')}</b>
              <small>{t('이번 도전에서는 부활하지 않습니다.')}</small>
              <button disabled={!room.receipt} onClick={() => send({ type: 'leave' })}>
                {t('기록 저장 후 나가기')}
              </button>
            </section>
          )}
          {m?.phase === 'fighting' && status === 'active' && (
            <div className="raid-controls">
              <section className="raid-arts">
                <button
                  disabled={!canAct}
                  aria-label={t('이전 무공')}
                  onClick={() => controls.action('previous')}
                >
                  Q ‹
                </button>
                <ArtGlyph id={active?.id} />
                <b>{active ? t(ARTS[active.id].name) : ''}</b>
                <button
                  disabled={!canAct}
                  aria-label={t('다음 무공')}
                  onClick={() => controls.action('next')}
                >
                  › E
                </button>
              </section>
              <section className="raid-ultimate">
                <button
                  aria-disabled={!!reason('ultimate')}
                  onClick={() => {
                    if (!reason('ultimate')) controls.action('ultimate');
                  }}
                >
                  <b>{t('궁극 행동 사용')}</b>
                  <span>
                    {Math.floor(active?.gauge ?? 0)} / {active?.id === 'gaebang' ? 200 : 100}
                  </span>
                  <Meter
                    kind="ultimate"
                    value={active?.gauge ?? 0}
                    max={active?.id === 'gaebang' ? 200 : 100}
                  />
                </button>
                <small>{reason('ultimate') || t('준비')}</small>
              </section>
              <section className="raid-defense">
                <button
                  aria-disabled={!!reason('defense')}
                  onClick={() => {
                    if (!reason('defense')) controls.action('defense');
                  }}
                >
                  {t('방어 행동 사용')} <kbd>Space</kbd>
                </button>
                <small>{reason('defense') || t('준비')}</small>
              </section>
            </div>
          )}
          <footer className="pvp-battle-footer">
            <span>
              {view.connected
                ? t('온라인 전투는 일시정지되지 않습니다')
                : t('연결 끊김 · 다시 접속 중')}
            </span>
            <button onClick={() => setPanel('rules')}>{t('레이드 규칙')}</button>
            {m && m.phase !== 'finished' && status === 'active' && (
              <button onClick={() => setPanel('leave')}>{t('출전 포기')}</button>
            )}
          </footer>
        </main>
      )}
      {panel && (
        <Modal
          title={t(panel === 'rules' ? '레이드 규칙' : '출전 포기 확인')}
          onClose={() => setPanel(null)}
        >
          {panel === 'rules' ? (
            <Rules personal={room?.personal ?? personal} />
          ) : (
            <>
              <p>
                {t(
                  '전투 중 포기하면 이번 무인은 쓰러짐으로 처리합니다. 층 사이에는 귀환을 이용하세요.',
                )}
              </p>
              <button onClick={() => setPanel(null)}>{t('계속 싸우기')}</button>
              <button
                className="danger"
                onClick={() => {
                  send({ type: 'leave' });
                  setPanel(null);
                }}
              >
                {t('포기하고 나가기')}
              </button>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
