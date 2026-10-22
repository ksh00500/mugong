import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { PvpClient } from './client';
import { PvpControls } from './controls';
import { PVP_PRESETS, PVP_RULES, pvpFighter } from './rules';
import type { ClientMessage, OnlineAccount, PresetId, MatchReceipt } from './model';
import { ArtGlyph, Meter, Modal } from '../ui/shared';
import { Icon } from '../ui/Icons';
import { HudArtwork } from '../ui/HudArtwork';
import { ARTS } from '../domain/content';
import { combatActionBlock } from '../domain/combat-actions';
import { t, useLanguage } from '../platform/i18n';
import { preloadFonts } from '../platform/assets';
export function Auth({
  client,
  raid = false,
}: {
  client: Pick<PvpClient, 'authenticate'>;
  raid?: boolean;
}) {
  const [kind, setKind] = useState<'login' | 'register'>('login'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [login, setLogin] = useState(''),
    [name, setName] = useState(''),
    [password, setPassword] = useState('');
  return (
    <section className="pvp-auth" aria-label={t('온라인 비무 계정')}>
      <span className="pvp-eyebrow">武 · {t('실시간 1:1')}</span>
      <h1>{t(raid ? '레이드에 들어서다' : '비무장에 들어서다')}</h1>
      <p>
        {t(
          raid
            ? '같은 온라인 계정으로 협동합니다. 로컬 여정과 자산은 그대로 보존됩니다.'
            : '친선 비무와 순위전. 로컬 여정과 자산은 그대로 보존됩니다.',
        )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await client.authenticate(kind, {
              login,
              password,
              ...(kind === 'register' ? { name } : {}),
            });
            setPassword('');
          } catch (e) {
            setError(e instanceof Error ? e.message : t('접속에 실패했습니다'));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{t(kind === 'login' ? '온라인 로그인' : '온라인 계정 만들기')}</h2>
        <label>
          {t('아이디')}
          <input
            name="username"
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_-]{3,20}"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            aria-describedby="pvp-login-help"
          />
        </label>
        <small id="pvp-login-help">{t('영문·숫자·밑줄 3~20자')}</small>
        {kind === 'register' && (
          <label>
            {t('표시 이름')}
            <input
              name="displayName"
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={16}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          {t('비밀번호')}
          <input
            name="password"
            type="password"
            autoComplete={kind === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={kind === 'register' ? 10 : 1}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {kind === 'register' && (
          <small>{t('10자 이상. 다른 서비스와 다른 비밀번호를 사용하세요.')}</small>
        )}
        {error && (
          <p className="pvp-error" role="alert">
            {t(error)}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {t(busy ? '접속 중' : raid ? '레이드 입장' : '비무장 입장')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setKind(kind === 'login' ? 'register' : 'login');
            setError('');
          }}
        >
          {t(kind === 'login' ? '새 온라인 계정 만들기' : '기존 계정으로 로그인')}
        </button>
      </form>
      <small>
        {t('온라인 계정은 이 서버에 저장됩니다. 로컬 무인·장비는 업로드하지 않습니다.')}
      </small>
    </section>
  );
}
function ArenaView({
  client,
  controls,
  ready,
  onRetry,
}: {
  client: PvpClient;
  controls: PvpControls;
  ready: (v: boolean) => void;
  onRetry: number;
}) {
  const root = useRef<HTMLDivElement>(null),
    [progress, setProgress] = useState(0),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false,
      cleanup: (() => void) | undefined;
    ready(false);
    setFailed(false);
    setProgress(0);
    import('./arena')
      .then(({ mountPvpArena }) => {
        if (cancelled || !root.current) return;
        cleanup = mountPvpArena(
          root.current,
          client,
          controls,
          () => {
            if (!cancelled) ready(true);
          },
          () => {
            if (!cancelled) {
              setFailed(true);
              ready(false);
            }
          },
          (v) => {
            if (!cancelled) setProgress(v);
          },
        );
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      ready(false);
      cleanup?.();
    };
  }, [client, controls, onRetry, ready]);
  return (
    <>
      <div className="pvp-canvas" ref={root} aria-label={t('실시간 비무 전장')} />
      {progress < 1 && !failed && (
        <div className="pvp-art-progress" role="status">
          {t('비무 그림 준비')} · {Math.round(progress * 100)}%
        </div>
      )}
      {failed && (
        <div className="pvp-art-progress" role="alert">
          {t('그림을 준비하지 못했습니다. 다시 준비를 눌러 주세요.')}
        </div>
      )}
    </>
  );
}
function Rules() {
  return (
    <div className="pvp-rule-text">
      <p>{t('서버 표준 무인 · HP 240 · 3판 2선승 · 라운드 90초')}</p>
      <p>{t('동시 쓰러짐은 무승부. 최대 5라운드 후 승수가 같으면 무승부입니다.')}</p>
      <p>
        {t('친선은 점수 변화 없음. 순위전은 계정 Elo 점수만 반영하며 경험치·물품 보상은 없습니다.')}
      </p>
      <p>{t('연결이 끊겨도 전투는 계속됩니다. 30초 안에 재접속하지 않으면 패배합니다.')}</p>
      <p>{t('가방·약·장비 교체 없음. 설정과 설명을 열어도 상대의 전투는 멈추지 않습니다.')}</p>
      <p>
        WASD · {t('이동')} / {t('좌클릭 공격')} / Q·E · {t('무공 전환')} / Space · {t('방어')} /{' '}
        {t('우클릭 궁극')}
      </p>
    </div>
  );
}
export function PvpApp() {
  const [client] = useState(() => new PvpClient()),
    v = useSyncExternalStore(client.subscribe, client.getSnapshot),
    { locale } = useLanguage();
  const [boot, setBoot] = useState(true),
    [bootError, setBootError] = useState(''),
    [preset, setPreset] = useState<PresetId>('sword'),
    [code, setCode] = useState('');
  const [rankings, setRankings] = useState<OnlineAccount[]>([]),
    [history, setHistory] = useState<{ id: string; state: string; receipt: MatchReceipt | null }[]>(
      [],
    );
  const [panel, setPanel] = useState<'rules' | 'exit' | null>(null),
    [artReady, setArtReady] = useState(false),
    [artAttempt, setArtAttempt] = useState(0);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const battleRef = useRef<HTMLDivElement>(null);
  const [controls] = useState(() => new PvpControls(client, () => !!panelRef.current));
  const room = v.room,
    m = room?.match,
    me = m?.players[v.seat],
    opponent = m?.players[(1 - v.seat) as 0 | 1],
    active = me?.fighter.arts[me.fighter.active];
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t('무공 · 실시간 비무');
    preloadFonts(locale);
  }, [locale]);
  useEffect(() => {
    if (v.connected) setBootError('');
  }, [v.connected]);
  useEffect(() => {
    let cancelled = false;
    controls.start();
    client
      .account()
      .then((a) => {
        if (!cancelled && a) client.connect();
      })
      .catch(() => {
        if (!cancelled) setBootError(t('비무 서버에 연결하지 못했습니다'));
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
    if (panel) controls.clear();
    else if (m?.phase === 'fighting') battleRef.current?.focus();
  }, [panel, m?.phase, controls]);
  const refresh = async () => {
    try {
      const r = await fetch('/api/pvp/rankings', { cache: 'no-store' });
      if (r.ok) setRankings((await r.json()).rankings);
      if (v.account) {
        const s = await fetch('/api/pvp/me', { cache: 'no-store' });
        if (s.ok) setHistory((await s.json()).history);
      }
    } catch {
      /* Visible connection state remains authoritative. */
    }
  };
  useEffect(() => {
    void refresh();
    if (room?.receipt) void client.account();
  }, [v.account?.id, room?.receipt?.id]);
  const send = (message: ClientMessage) => {
    client.clearError();
    controls.clear();
    client.send(message);
  };
  const closePanel = () => setPanel(null);
  const leave = () => {
    if (m && m.phase !== 'finished') setPanel('exit');
    else send({ type: 'leave' });
  };
  const roomReady = !!room && room.seats.every((p) => p?.connected),
    canAct = v.connected && m?.phase === 'fighting' && !panel;
  const disabledReason = (action: 'defense' | 'ultimate') => {
    if (!canAct || !me) return t('전투 중에 사용');
    const reason = combatActionBlock(me.fighter, action);
    if (reason === 'cooling') return t('재사용 {0}초', { 0: active!.defenseCd.toFixed(1) });
    return reason
      ? t(
          {
            untrained: '무공을 먼저 선택하세요',
            restrained: '행동 불가 상태',
            unarmed: '무장 필요',
            locked: '아직 개방되지 않았습니다',
            charging: '타격해서 게이지 충전',
            recovering: '공격 후 회복 중',
            full: '강화 예약 2/2',
          }[reason],
        )
      : '';
  };
  return (
    <div className="pvp-app" data-phase={m?.phase ?? (room ? 'waiting' : 'lobby')}>
      <header className="pvp-header">
        <a className="pvp-brand" href="/">
          武 <b>{t('무공')}</b>
        </a>
        <span>{t('비무장')}</span>
        <div className="pvp-header-actions">
          <a href="/raid/">{t('협동 레이드')}</a>
          <button onClick={() => setPanel('rules')}>{t('대전 규칙')}</button>
          {v.account && (
            <>
              <span className="pvp-account">
                {v.account.name} · {v.account.rating} Elo
              </span>
              <button
                disabled={!!room || !!v.queuedSince}
                onClick={() => {
                  void client.logout().catch((e) => setBootError(e.message));
                }}
              >
                {t('로그아웃')}
              </button>
            </>
          )}
        </div>
      </header>
      {(v.error || bootError) && (
        <div className="pvp-connection-error" role="alert">
          {t(v.error || bootError)}
          {!v.connected && v.account && <button onClick={client.connect}>{t('다시 연결')}</button>}
          {bootError && <button onClick={() => location.reload()}>{t('다시 시도')}</button>}
        </div>
      )}
      {boot ? (
        <main className="pvp-boot" role="status">
          {t('비무 서버 확인 중')}
        </main>
      ) : !v.account ? (
        <main className="pvp-auth-main">
          <Auth client={client} />
        </main>
      ) : !room ? (
        <main className="pvp-lobby">
          <section className="pvp-selection">
            <span className="pvp-eyebrow">{t('표준 무인 · 로컬 저장 보존')}</span>
            <h1>{t('실력으로 겨루다')}</h1>
            <p>
              {t('같은 체력과 정해진 무공으로 대전합니다. 보유 장비 차이는 반영하지 않습니다.')}
            </p>
            <fieldset disabled={!!v.queuedSince}>
              <legend>{t('출전 무인 선택')}</legend>
              <div className="pvp-presets">
                {Object.entries(PVP_PRESETS).map(([id, p]) => (
                  <button
                    type="button"
                    className={preset === id ? 'selected' : ''}
                    aria-pressed={preset === id}
                    key={id}
                    onClick={() => setPreset(id as PresetId)}
                  >
                    <img src={`/art/hero-roster-v1/portrait-${p.appearance}.webp`} alt="" />
                    <b>{t(p.name)}</b>
                    <span>{t(p.description)}</span>
                    <div>
                      {p.arts.map((art) => (
                        <ArtGlyph key={art} id={art} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </fieldset>
            {v.queuedSince ? (
              <div className="pvp-queue" role="status">
                <h2>{t('순위전 상대를 찾고 있습니다')}</h2>
                <b>
                  {Math.max(0, Math.floor((now - v.queuedSince) / 1000))}
                  {t('초')}
                </b>
                <p>{t('실제 플레이어와만 매칭합니다. 봇은 참가하지 않습니다.')}</p>
                <button onClick={() => send({ type: 'cancel' })}>{t('매칭 취소')}</button>
              </div>
            ) : (
              <div className="pvp-mode-actions">
                <section>
                  <h2>{t('친선 비무')}</h2>
                  <p>{t('방 코드로 초대 · 점수 변화 없음')}</p>
                  <button
                    className="primary"
                    disabled={!v.connected}
                    onClick={() => send({ type: 'create', preset })}
                  >
                    {t('친선 방 만들기')}
                  </button>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      send({ type: 'join', preset, code: code.trim().toUpperCase() });
                    }}
                  >
                    <label>
                      {t('방 코드')}
                      <input
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        pattern="[A-Z2-9]{6}"
                        required
                        autoComplete="off"
                      />
                    </label>
                    <button disabled={!v.connected}>{t('친선 방 참가')}</button>
                  </form>
                </section>
                <section>
                  <h2>{t('순위전')}</h2>
                  <p>{t('계정 점수로 매칭 · 승패는 서버에 저장')}</p>
                  <b className="pvp-rating">
                    {v.account.rating}
                    <small> Elo</small>
                  </b>
                  <button
                    className="primary"
                    disabled={!v.connected}
                    onClick={() => send({ type: 'queue', preset })}
                  >
                    {t('순위전 찾기')}
                  </button>
                </section>
              </div>
            )}
          </section>
          <aside className="pvp-records">
            <section>
              <div className="pvp-section-title">
                <h2>{t('비무 순위')}</h2>
                <button onClick={() => void refresh()}>{t('새로고침')}</button>
              </div>
              {!rankings.length ? (
                <p>{t('첫 순위전을 마치면 순위에 표시됩니다.')}</p>
              ) : (
                <ol>
                  {rankings.map((a, i) => (
                    <li key={a.id} data-self={a.id === v.account!.id}>
                      <span>{i + 1}</span>
                      <b>{a.name}</b>
                      <span>{a.rating}</span>
                      <small>
                        {a.wins}W {a.losses}L {a.draws}D
                      </small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <section>
              <h2>{t('최근 대전')}</h2>
              {!history.length ? (
                <p>{t('아직 대전 기록이 없습니다.')}</p>
              ) : (
                <ul className="pvp-history">
                  {history.slice(0, 8).map((h) => (
                    <li key={h.id}>
                      {h.receipt ? (
                        <>
                          <b>{t(h.receipt.mode === 'ranked' ? '순위전' : '친선 비무')}</b>
                          <span>
                            {h.receipt.names.join(' · ')}　{h.receipt.scores.join(' : ')}
                          </span>
                          <small>{t(h.receipt.winner === null ? '무승부' : '경기 종료')}</small>
                        </>
                      ) : (
                        <span>
                          {t(h.state === 'void' ? '서버 재시작 · 경기 무효' : '대전 진행 중')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </main>
      ) : (
        <main className="pvp-battle" ref={battleRef} tabIndex={-1}>
          <ArenaView client={client} controls={controls} ready={setArtReady} onRetry={artAttempt} />
          <div className="pvp-match-top">
            <section className="pvp-health ally">
              <b>{me?.fighter.name ?? room.seats[v.seat]?.name}</b>
              <span>{Math.ceil(me?.fighter.hp ?? 240)} / 240</span>
              <Meter
                value={me?.fighter.hp ?? 240}
                max={240}
                identity={`${m?.id}-${m?.round}-self`}
                label={t('내 경기 체력')}
              />
            </section>
            <section className="pvp-match-clock">
              <b>{t(room.mode === 'ranked' ? '순위전' : '친선 비무')}</b>
              <strong>{m ? `${m.wins[0]} : ${m.wins[1]}` : t('입장 대기')}</strong>
              <span>
                {m ? `${t('라운드')} ${m.round} · ${Math.ceil(m.roundTicks / 60)}s` : room.code}
              </span>
            </section>
            <section className="pvp-health opponent">
              <b>
                {opponent?.fighter.name ??
                  room.seats[(1 - v.seat) as 0 | 1]?.name ??
                  t('상대 기다리는 중')}
              </b>
              <span>{Math.ceil(opponent?.fighter.hp ?? 240)} / 240</span>
              <Meter
                value={opponent?.fighter.hp ?? 240}
                max={240}
                identity={`${m?.id}-${m?.round}-opponent`}
                label={t('상대 경기 체력')}
              />
            </section>
          </div>
          <div className="pvp-match-status" role="status">
            {!v.connected
              ? t('재접속 중 · 전투는 계속됩니다')
              : room.seats.some((p) => p && !p.connected)
                ? t('상대 연결 끊김 · 재접속 대기')
                : artReady
                  ? `${t('연결')} ${v.rtt}ms`
                  : t('비무 그림 준비')}
          </div>
          {!m && (
            <section className="pvp-ready-panel">
              <span className="pvp-eyebrow">{t('양쪽이 준비하면 시작합니다')}</span>
              <h1>
                {room.mode === 'friendly' ? t('친선 방 코드') : t('순위전 상대를 찾았습니다')}{' '}
                <strong data-testid="room-code">{room.mode === 'friendly' ? room.code : ''}</strong>
              </h1>
              <div className="pvp-ready-players">
                {room.seats.map((p, i) => (
                  <article key={i}>
                    {p ? (
                      <>
                        <img
                          src={`/art/hero-roster-v1/portrait-${PVP_PRESETS[p.preset].appearance}.webp`}
                          alt=""
                        />
                        <b>{p.name}</b>
                        <span>
                          {t(PVP_PRESETS[p.preset].name)} · {p.rating} Elo
                        </span>
                        <small>{t(p.ready ? '준비 완료' : '준비 중')}</small>
                      </>
                    ) : (
                      <span>{t('상대 기다리는 중')}</span>
                    )}
                  </article>
                ))}
              </div>
              <p>{t('서버 표준 무인 · HP 240 · 3판 2선승 · 라운드 90초')}</p>
              <div className="pvp-ready-actions">
                <button
                  disabled={!v.connected || !roomReady || !artReady || !!room.seats[v.seat]?.ready}
                  className="primary"
                  onClick={() => send({ type: 'ready' })}
                >
                  {t(room.seats[v.seat]?.ready ? '상대 준비 기다리는 중' : '대전 준비')}
                </button>
                {!artReady && (
                  <button onClick={() => setArtAttempt((n) => n + 1)}>{t('다시 준비')}</button>
                )}
                <button onClick={leave}>{t('나가기')}</button>
              </div>
            </section>
          )}
          {m?.phase === 'countdown' && (
            <div className="pvp-countdown" role="status">
              <b>{Math.ceil(m.phaseTicks / 60)}</b>
              <span>{t('비무 시작')}</span>
            </div>
          )}
          {m?.phase === 'interval' && (
            <div className="pvp-round-result" role="status">
              <h2>
                {t(
                  m.roundWinner === null
                    ? '무승부'
                    : m.roundWinner === v.seat
                      ? '라운드 승리'
                      : '라운드 패배',
                )}
              </h2>
              <p>
                {t('다음 라운드 준비')} · {Math.ceil(m.phaseTicks / 60)}s
              </p>
            </div>
          )}
          {m?.phase === 'finished' && (
            <section className="pvp-result" aria-label={t('비무 결과')}>
              <span className="pvp-eyebrow">
                {t(room.mode === 'ranked' ? '순위전' : '친선 비무')}
              </span>
              <h1>{t(m.winner === null ? '무승부' : m.winner === v.seat ? '승리' : '패배')}</h1>
              <strong>{m.wins.join(' : ')}</strong>
              <p>
                {t(
                  m.reason === 'disconnect'
                    ? '재접속 시간 초과'
                    : m.reason === 'surrender'
                      ? '항복으로 경기 종료'
                      : m.reason === 'abandoned'
                        ? '양쪽 연결 끊김 · 경기 무효'
                        : '경기가 종료되었습니다',
                )}
              </p>
              {room.receipt ? (
                <>
                  <p>
                    {room.mode === 'ranked' ? (
                      <>
                        {room.receipt.ratings[v.seat]} Elo{' '}
                        <b data-testid="rating-delta">
                          ({room.receipt.deltas[v.seat] >= 0 ? '+' : ''}
                          {room.receipt.deltas[v.seat]})
                        </b>
                      </>
                    ) : (
                      t('친선 경기 · 점수 변화 없음')
                    )}
                  </p>
                  <small>{t('서버에 결과 저장 완료')}</small>
                </>
              ) : (
                <p role="status">{t('경기 결과 저장 중. 완료 전에는 다시 출전할 수 없습니다.')}</p>
              )}
              <p>{t('로컬 무인·체력·장비는 그대로 보존되었습니다.')}</p>
              <div className="pvp-ready-actions">
                {room.mode === 'friendly' && (
                  <button
                    disabled={!room.receipt || !roomReady || !!room.seats[v.seat]?.ready}
                    onClick={() => send({ type: 'ready' })}
                  >
                    {t(room.seats[v.seat]?.ready ? '상대 준비 기다리는 중' : '한 판 더')}
                  </button>
                )}
                <button
                  className="primary"
                  disabled={!room.receipt}
                  onClick={() => send({ type: 'leave' })}
                >
                  {t('대기실로')}
                </button>
              </div>
            </section>
          )}
          {m && m.phase !== 'finished' && (
            <div className="pvp-combat-controls">
              <section className="pvp-art-fan">
                <HudArtwork shape="fan" />
                {me!.fighter.arts.map((a, i) => (
                  <button
                    key={a.id}
                    className={i === me!.fighter.active ? 'selected' : ''}
                    aria-pressed={i === me!.fighter.active}
                    aria-disabled={!canAct || me!.fighter.actionTime > 0}
                    onClick={() => {
                      if (canAct && me!.fighter.actionTime <= 0 && i !== me!.fighter.active)
                        controls.action(i < me!.fighter.active ? 'previous' : 'next');
                    }}
                    aria-label={t('{0} 전환', { 0: t(ARTS[a.id].name) })}
                  >
                    <ArtGlyph id={a.id} />
                    <b>{t(ARTS[a.id].short)}</b>
                    <small>Lv.{a.level}</small>
                  </button>
                ))}
                <div>
                  <button
                    disabled={!canAct}
                    aria-label={t('이전 무공')}
                    onClick={() => controls.action('previous')}
                  >
                    Q ‹
                  </button>
                  <b>{active ? t(ARTS[active.id].name) : ''}</b>
                  <button
                    disabled={!canAct}
                    aria-label={t('다음 무공')}
                    onClick={() => controls.action('next')}
                  >
                    › E
                  </button>
                </div>
              </section>
              <section className="pvp-ultimate">
                <button
                  aria-disabled={!!disabledReason('ultimate')}
                  aria-describedby="pvp-ultimate-reason"
                  onClick={() => controls.action('ultimate')}
                >
                  <b>{t('궁극 행동 사용')}</b>
                  <span>
                    {Math.floor(active?.gauge ?? 0)} / {active?.id === 'gaebang' ? 200 : 100}
                  </span>
                  <Meter
                    value={active?.gauge ?? 0}
                    max={active?.id === 'gaebang' ? 200 : 100}
                    kind="ultimate"
                  />
                </button>
                <small id="pvp-ultimate-reason">
                  {disabledReason('ultimate') || t('클릭 또는 우클릭으로 사용')}
                </small>
              </section>
              <section className="pvp-defense">
                <button
                  aria-disabled={!!disabledReason('defense')}
                  aria-describedby="pvp-defense-reason"
                  onClick={() => controls.action('defense')}
                >
                  <ArtGlyph id={active?.id} />
                  <b>{t('방어 행동 사용')}</b>
                  <kbd>Space</kbd>
                </button>
                <small id="pvp-defense-reason">{disabledReason('defense') || t('준비')}</small>
              </section>
            </div>
          )}
          <footer className="pvp-battle-footer">
            <span>{t('온라인 전투는 일시정지되지 않습니다')}</span>
            <button onClick={() => setPanel('rules')}>{t('대전 규칙')}</button>
            {m?.phase !== 'finished' && <button onClick={leave}>{t(m ? '항복' : '나가기')}</button>}
          </footer>
        </main>
      )}
      {panel && (
        <Modal title={t(panel === 'rules' ? '대전 규칙' : '항복 확인')} onClose={closePanel}>
          {panel === 'rules' ? (
            <Rules />
          ) : (
            <>
              <p>{t('항복하면 이번 경기에 패배합니다. 로컬 무인·장비 손실은 없습니다.')}</p>
              {room?.mode === 'ranked' && <p>{t('순위 점수에 패배가 반영됩니다.')}</p>}
              <div className="pvp-ready-actions">
                <button onClick={closePanel}>{t('계속 싸우기')}</button>
                <button
                  className="danger"
                  onClick={() => {
                    send({ type: 'surrender' });
                    closePanel();
                  }}
                >
                  {t('항복하기')}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
