import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { Icon, ItemArt } from '../ui/Icons';

type Screen = 'select' | 'raid' | 'biwu' | 'deathmatch' | 'combat' | 'rest' | 'result';
type ItemKind = 'sword' | 'medicine' | 'manual' | 'robe' | 'boots' | 'charm' | 'ore';
type SampleItem = {
  id: string;
  name: string;
  kind: ItemKind;
  effect: string;
  size: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  owner?: string;
};

const modes = [
  {
    id: 'raid',
    ordinal: '壹',
    title: '레이드',
    subtitle: '함께 산채를 돌파',
    summary: '5개 층 · 1~4인',
    reward: '성장 · 개인 전리품',
    danger: '사망 시 무인을 잃습니다',
    icon: 'compass',
  },
  {
    id: 'biwu',
    ordinal: '貳',
    title: '비무',
    subtitle: '실력을 겨루는 경기',
    summary: '시즌 순위 · 1대1',
    reward: '시즌 종료 보상',
    danger: '경기별 성장 보상 없음',
    icon: 'sword',
  },
  {
    id: 'deathmatch',
    ordinal: '參',
    title: '생사결',
    subtitle: '모든 것을 거는 대결',
    summary: '실제 무인 · 판돈',
    reward: '결착 시 전리품',
    danger: '사망·장비 손실 가능',
    icon: 'heart',
  },
] as const;

const initialBag: SampleItem[] = [
  {
    id: 'med-1',
    name: '금창약',
    kind: 'medicine',
    effect: '전투가 끝난 뒤 체력 35 회복',
    size: '1칸',
    x: 0,
    y: 0,
  },
  {
    id: 'med-2',
    name: '금창약',
    kind: 'medicine',
    effect: '전투가 끝난 뒤 체력 35 회복',
    size: '1칸',
    x: 1,
    y: 0,
  },
  { id: 'ore-1', name: '흑철석', kind: 'ore', effect: '장비 제작 재료', size: '1칸', x: 4, y: 1 },
];

const initialLoot: SampleItem[] = [
  {
    id: 'loot-1',
    name: '청운비급',
    kind: 'manual',
    effect: '무공 수련 재료 · 귀환 시 보유',
    size: '1칸',
  },
  {
    id: 'loot-2',
    name: '동료의 유품',
    kind: 'charm',
    effect: '생환하면 원 소유자의 창고로 자동 반환',
    size: '1칸',
    owner: '월영 세가',
  },
  { id: 'loot-3', name: '흑철석', kind: 'ore', effect: '장비 제작 재료', size: '1칸' },
];

function Action({
  children,
  onClick,
  tone = 'paper',
  disabled = false,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'paper' | 'jade' | 'danger';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`ns-action ${tone} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  aside,
}: {
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="ns-heading">
      <div>
        <span className="ns-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {aside && <span className="ns-heading-aside">{aside}</span>}
    </div>
  );
}

function FighterCard({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`ns-fighter ${compact ? 'compact' : ''}`} aria-label="예시 무인">
      <div className="ns-fighter-portrait" aria-hidden="true" />
      <div className="ns-fighter-body">
        <span className="ns-eyebrow">예시 무인</span>
        <h3>
          무명 <small>Lv.14</small>
        </h3>
        <div className="ns-hp">
          <span>체력</span>
          <b>103 / 120</b>
        </div>
        <div className="ns-hp-track">
          <i style={{ width: '86%' }} />
        </div>
        <div className="ns-fighter-facts">
          <span>
            남은 수명 <b>6일 21시간</b>
          </span>
          <span>
            무공 <b>2 / 4</b>
          </span>
        </div>
      </div>
    </section>
  );
}

function ModeSelect({ open }: { open: (screen: Screen) => void }) {
  return (
    <div className="ns-select-layout">
      <section className="ns-select-hero">
        <div className="ns-select-hero-copy">
          <span className="ns-eyebrow">강호를 완주한 뒤</span>
          <h1>
            이제 어디로
            <br />
            나설까요?
          </h1>
          <p>돌아온 무인의 무공과 장비로 다음 이야기를 이어갑니다.</p>
        </div>
        <div className="ns-hero-person" aria-hidden="true" />
        <div className="ns-hero-status">
          <span>예시 · 무명 Lv.14</span>
          <b>체력 103 / 120</b>
        </div>
      </section>
      <section className="ns-mode-panel">
        <SectionTitle eyebrow="출전 선택" title="나설 곳을 고르세요" aside="세 가지 길" />
        <div className="ns-mode-list">
          {modes.map((mode) => (
            <button
              type="button"
              className={`ns-mode-card ${mode.id}`}
              key={mode.id}
              onClick={() => open(mode.id)}
            >
              <span className="ns-mode-art">
                <Icon name={mode.icon} />
              </span>
              <span className="ns-mode-copy">
                <small>
                  {mode.ordinal} · {mode.subtitle}
                </small>
                <strong>{mode.title}</strong>
                <span>
                  {mode.summary} <i aria-hidden="true">·</i> {mode.reward}
                </span>
              </span>
              <span className="ns-mode-end">
                <em>{mode.danger}</em>
                <Icon name="arrow" />
              </span>
            </button>
          ))}
        </div>
        <p className="ns-panel-foot">모드를 선택하면 출전 조건과 손실 위험을 먼저 확인합니다.</p>
      </section>
    </div>
  );
}

function RaidPrep({
  partySize,
  setPartySize,
  enter,
}: {
  partySize: number;
  setPartySize: (count: number) => void;
  enter: () => void;
}) {
  return (
    <div className="ns-prep-grid">
      <div className="ns-prep-main">
        <SectionTitle eyebrow="산채 레이드" title="흑풍채로 출전" aside="5개 층 · 1~4인" />
        <div className="ns-route">
          <div className="ns-route-head">
            <span>진행 경로</span>
            <span>각 층 뒤 귀환 선택</span>
          </div>
          <div className="ns-route-steps">
            {['산문', '목책', '내원', '망루', '채주'].map((name, i) => (
              <div className={`ns-route-step ${i === 0 ? 'first' : ''}`} key={name}>
                <b>{i + 1}</b>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ns-party">
          <div className="ns-party-head">
            <strong>파티 구성</strong>
            <span>{partySize} / 4명</span>
          </div>
          <div className="ns-party-people">
            <span className="me">
              무명 <small>나 · 준비 가능</small>
            </span>
            {partySize > 1 && (
              <span>
                청하 <small>대기</small>
              </span>
            )}
            {partySize > 2 && (
              <span>
                태극 <small>대기</small>
              </span>
            )}
            {partySize > 3 && (
              <span>
                연화 <small>대기</small>
              </span>
            )}
          </div>
          <div className="ns-party-controls">
            <Action onClick={() => setPartySize(1)} tone={partySize === 1 ? 'jade' : 'paper'}>
              혼자 보기
            </Action>
            <Action onClick={() => setPartySize(3)} tone={partySize !== 1 ? 'jade' : 'paper'}>
              파티 보기
            </Action>
            <span>시안에서는 파티 구성을 예시로 전환합니다.</span>
          </div>
        </div>
      </div>
      <aside className="ns-prep-side">
        <FighterCard compact />
        <div className="ns-rule-card">
          <strong>출전 전에 확인</strong>
          <p>한 층을 넘을 때마다 남은 파티가 귀환 또는 다음 층을 선택합니다.</p>
          <div className="ns-rule-points">
            <span>
              <b>보상</b>개인 전리품
            </span>
            <span>
              <b>위험</b>사망 시 무인·장비 상실
            </span>
            <span>
              <b>유품</b>동료 생환 시 원 소유 세가로 반환
            </span>
          </div>
        </div>
        <Action tone="jade" className="ns-primary-wide" onClick={enter}>
          전투 HUD 시안 보기 <Icon name="arrow" />
        </Action>
      </aside>
    </div>
  );
}

function PvpPrep({
  lethal,
  wager,
  setWager,
  enter,
}: {
  lethal: boolean;
  wager: number;
  setWager: (amount: number) => void;
  enter: () => void;
}) {
  return (
    <div className="ns-prep-grid ns-pvp-grid">
      <div className="ns-prep-main">
        <SectionTitle
          eyebrow={lethal ? '생사결 준비' : '비무 준비'}
          title={lethal ? '돌아올 수 없는 승부' : '실력을 겨룰 시간'}
          aside={lethal ? '위험 경기' : '시즌 순위 경기'}
        />
        <div className={`ns-pvp-feature ${lethal ? 'lethal' : ''}`}>
          <div className="ns-pvp-feature-art">
            <Icon name={lethal ? 'sword' : 'record'} />
          </div>
          <div>
            <strong>{lethal ? '무인과 장비를 걸고 싸웁니다' : '실력만 겨루는 안전한 경기'}</strong>
            <p>
              {lethal
                ? '사망하면 무인과 착용·가방 물품을 잃습니다. 승자가 자비를 베풀면 생존하며 판돈만 정산합니다.'
                : '경기가 끝나도 체력·수명·가방은 그대로입니다. 경기마다 경험치나 물품을 지급하지 않습니다.'}
            </p>
          </div>
        </div>
        {lethal ? (
          <div className="ns-wager">
            <strong>판돈 선택</strong>
            <div className="ns-wager-choices">
              {[100, 500, 1000].map((amount) => (
                <button
                  type="button"
                  aria-pressed={wager === amount}
                  className={wager === amount ? 'chosen' : ''}
                  onClick={() => setWager(amount)}
                  key={amount}
                >
                  {amount.toLocaleString()} 냥
                </button>
              ))}
            </div>
            <span>양측 판돈 합계 {(wager * 2).toLocaleString()} 냥 · 시안 수치</span>
          </div>
        ) : (
          <div className="ns-season">
            <span>현재 시즌</span>
            <b>순위 측정 전</b>
            <small>보상은 시즌이 끝난 뒤 순위에 따라 지급됩니다.</small>
          </div>
        )}
      </div>
      <aside className="ns-prep-side">
        <FighterCard compact />
        <div className="ns-rule-card">
          <strong>{lethal ? '결착 전 선택' : '경기 방식'}</strong>
          <p>
            {lethal
              ? '실제 손실을 이해한 뒤에만 출전할 수 있습니다.'
              : '승패는 시즌 순위에 반영됩니다.'}
          </p>
          <div className="ns-rule-points">
            {lethal ? (
              <>
                <span>
                  <b>자비</b>상대 생존 · 판돈만 정산
                </span>
                <span>
                  <b>결착</b>패자 사망 · 장비 현장에 남음
                </span>
                <span>
                  <b>내 상태</b>실제 체력으로 출전
                </span>
              </>
            ) : (
              <>
                <span>
                  <b>무인</b>체력·수명·장비 유지
                </span>
                <span>
                  <b>성장</b>경기별 경험치·물품 없음
                </span>
                <span>
                  <b>보상</b>시즌 종료 후 순위에 따라 지급
                </span>
              </>
            )}
          </div>
        </div>
        <Action tone={lethal ? 'danger' : 'jade'} className="ns-primary-wide" onClick={enter}>
          {lethal ? '위험 확인 시안 보기' : '매칭 대기 시안 보기'} <Icon name="arrow" />
        </Action>
      </aside>
    </div>
  );
}

function CombatPreview({
  mode,
  goRest,
  goResult,
}: {
  mode: Screen;
  goRest: () => void;
  goResult: () => void;
}) {
  const raid = mode === 'raid';
  return (
    <div className="ns-combat">
      <div className="ns-combat-vignette" />
      <div className="ns-hud-left">
        <b>
          무명 <small>Lv.14</small>
        </b>
        <span>
          체력 <strong>103 / 120</strong>
        </span>
        <div className="ns-hp-track">
          <i style={{ width: '86%' }} />
        </div>
        {raid && <small>청하 92 / 110　·　태극 76 / 100</small>}
      </div>
      <div className="ns-hud-boss">
        <b>{raid ? '철갑 호위장' : mode === 'biwu' ? '비무 상대' : '생사결 상대'}</b>
        <div>
          <i />
        </div>
        <span>{raid ? '1층 · 산문' : '1 / 3 라운드'}</span>
      </div>
      <div className="ns-hud-right">
        {raid ? '레이드 · 3 / 4명' : mode === 'biwu' ? '비무 · 시즌 경기' : '생사결 · 위험 경기'}
        <small>전투 UI 배치 시안</small>
      </div>
      <div className="ns-combat-center">
        <span>넓은 전장과 작은 무인</span>
        <b>HUD 구성 확인</b>
      </div>
      <div className="ns-hud-bottom">
        <div className="ns-hud-fan">
          <span>Q　‹</span>
          <strong>일월검법</strong>
          <span>›　E</span>
          <small>마우스 올리기 · Shift 상세</small>
        </div>
        <div className="ns-hud-ultimate">
          <span>궁극기</span>
          <b>혼의 기운 68 / 100</b>
        </div>
        <div className="ns-hud-defense">
          <span>Space 회피</span>
          <b>반격 준비</b>
        </div>
      </div>
      <div className="ns-combat-next">
        <Action tone="jade" onClick={raid ? goRest : goResult}>
          {raid ? '1층 클리어 · 정비 시안 보기' : '경기 결과 시안 보기'}
        </Action>
      </div>
    </div>
  );
}

function BagGrid({
  label,
  cols,
  rows,
  items,
  onSelect,
  onDropItem,
  selectedId,
}: {
  label: string;
  cols: number;
  rows: number;
  items: SampleItem[];
  onSelect: (item: SampleItem) => void;
  onDropItem?: (id: string, cell: { x: number; y: number }) => void;
  selectedId?: string;
}) {
  return (
    <div className="ns-bag-area">
      <div className="ns-bag-title">
        <strong>{label}</strong>
        <span>
          {items.reduce((sum, item) => sum + (item.w ?? 1) * (item.h ?? 1), 0)} / {cols * rows}칸
        </span>
      </div>
      <div
        className="ns-bag-grid"
        style={{ '--cols': cols, '--rows': rows, '--ratio': cols / rows } as CSSProperties}
        onDragOver={onDropItem ? (event) => event.preventDefault() : undefined}
        onDrop={
          onDropItem
            ? (event) => {
                event.preventDefault();
                const bounds = event.currentTarget.getBoundingClientRect();
                onDropItem(event.dataTransfer.getData('text/plain'), {
                  x: Math.min(
                    cols - 1,
                    Math.floor(((event.clientX - bounds.left) / bounds.width) * cols),
                  ),
                  y: Math.min(
                    rows - 1,
                    Math.floor(((event.clientY - bounds.top) / bounds.height) * rows),
                  ),
                });
              }
            : undefined
        }
      >
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`ns-bag-item ${selectedId === item.id ? 'selected' : ''}`}
            style={
              {
                '--x': item.x ?? 0,
                '--y': item.y ?? 0,
                '--w': item.w ?? 1,
                '--h': item.h ?? 1,
              } as CSSProperties
            }
            title={item.name}
            aria-label={`${item.name}, ${item.size}`}
            onClick={() => onSelect(item)}
          >
            <ItemArt kind={item.kind} />
          </button>
        ))}
      </div>
    </div>
  );
}

function RaidRest({
  partySize,
  setPartySize,
  ready,
  setReady,
  goResult,
}: {
  partySize: number;
  setPartySize: (n: number) => void;
  ready: boolean;
  setReady: (v: boolean) => void;
  goResult: () => void;
}) {
  const [bag, setBag] = useState(initialBag);
  const [loot, setLoot] = useState(initialLoot);
  const [selected, setSelected] = useState<SampleItem>(initialLoot[0]);
  const [notice, setNotice] = useState(
    '전투가 끝났습니다. 전리품을 정리한 뒤 귀환하거나 다음 층을 준비하세요.',
  );
  const store = (id: string, target?: { x: number; y: number }) => {
    const item = loot.find((entry) => entry.id === id);
    if (!item) return;
    const used = new Set(bag.map((entry) => `${entry.x},${entry.y}`));
    let slot = target ? target.y * 10 + target.x : -1;
    if (target && used.has(`${target.x},${target.y}`)) {
      setNotice('이미 물품이 있는 칸입니다. 빈 칸에 놓아주세요.');
      return;
    }
    if (!target)
      for (let index = 0; index < 80; index++)
        if (!used.has(`${index % 10},${Math.floor(index / 10)}`)) {
          slot = index;
          break;
        }
    if (slot < 0) {
      setNotice('일반 가방에 빈 칸이 없습니다.');
      return;
    }
    const moved = { ...item, x: slot % 10, y: Math.floor(slot / 10) };
    setBag((before) => [...before, moved]);
    setLoot((before) => before.filter((entry) => entry.id !== id));
    setSelected(moved);
    setNotice(
      `${item.name}을 일반 가방에 수납했습니다.${item.owner ? ' 유품의 원 소유권은 유지됩니다.' : ''}`,
    );
  };
  const allyLeaves = () => {
    if (partySize <= 1) return;
    setPartySize(partySize - 1);
    setReady(false);
    setNotice(
      `파티가 ${partySize}명에서 ${partySize - 1}명으로 바뀌었습니다. 함께 귀환하거나 새 구성으로 다시 준비하세요.`,
    );
  };
  const selectedInLoot = loot.some((item) => item.id === selected.id);
  return (
    <div className="ns-rest">
      <div className="ns-rest-top">
        <div>
          <span className="ns-eyebrow">레이드 · 층 사이 정비</span>
          <h2>
            1층 돌파 <small>다음은 2층 · 목책</small>
          </h2>
        </div>
        <div className="ns-rest-party">
          <b>파티 {partySize}명</b>
          <span>무명 103　청하 92　태극 76</span>
          <button type="button" onClick={allyLeaves} disabled={partySize <= 1}>
            동료 귀환 상황 보기
          </button>
        </div>
      </div>
      <div className="ns-rest-main">
        <div className="ns-rest-fighter">
          <FighterCard compact />
          <div className="ns-rest-arts">
            <strong>무공</strong>
            <span>일월검법 Lv.3</span>
            <span>태극강검 Lv.1</span>
            <strong>착용 장비</strong>
            <span>청운검 · 수련복</span>
          </div>
        </div>
        <BagGrid
          label="무장 가방"
          cols={4}
          rows={7}
          items={[
            {
              id: 'weapon',
              name: '청운검',
              kind: 'sword',
              effect: '일월검법과 연결된 검',
              size: '1 × 3칸',
              x: 1,
              y: 0,
              h: 3,
            },
          ]}
          selectedId={selected.id}
          onSelect={setSelected}
        />
        <BagGrid
          label="일반 가방"
          cols={10}
          rows={8}
          items={bag}
          selectedId={selected.id}
          onSelect={setSelected}
          onDropItem={store}
        />
        <aside className="ns-selected">
          <span className="ns-eyebrow">선택한 물품</span>
          <div className="ns-selected-art">
            <ItemArt kind={selected.kind} />
          </div>
          <h3>{selected.name}</h3>
          <p>{selected.effect}</p>
          {selected.owner && (
            <div className="ns-owner">
              원 소유자 · {selected.owner}
              <br />
              생환 시 해당 세가 창고로 반환
            </div>
          )}
          <span className="ns-selected-size">크기 {selected.size}</span>
          {selectedInLoot && (
            <Action tone="jade" onClick={() => store(selected.id)}>
              일반 가방에 수납
            </Action>
          )}
        </aside>
      </div>
      <div className="ns-rest-bottom">
        <section>
          <div>
            <strong>개인 전리품과 유품</strong>
            <small>{loot.length}개 · 드래그 또는 선택 후 버튼으로 수납</small>
          </div>
          <div className="ns-loot-row">
            {loot.length ? (
              loot.map((item) => (
                <button
                  type="button"
                  draggable
                  key={item.id}
                  className={selected.id === item.id ? 'selected' : ''}
                  onClick={() => setSelected(item)}
                  onDragStart={(event: DragEvent<HTMLButtonElement>) =>
                    event.dataTransfer.setData('text/plain', item.id)
                  }
                >
                  <ItemArt kind={item.kind} />
                  <span>{item.name}</span>
                  {item.owner && <small>유품</small>}
                </button>
              ))
            ) : (
              <span className="ns-empty-loot">수납하지 않은 전리품이 없습니다.</span>
            )}
          </div>
        </section>
      </div>
      <div className="ns-rest-footer">
        <p role="status">{notice}</p>
        <div>
          <Action onClick={goResult}>함께 귀환하기</Action>
          <Action
            tone="jade"
            onClick={() => {
              setReady(!ready);
              setNotice(
                ready
                  ? '준비를 취소했습니다.'
                  : `${partySize}명 파티의 준비를 표시했습니다. 모두 준비해야 다음 층으로 갑니다.`,
              );
            }}
          >
            {ready ? '준비 취소' : `${partySize}명으로 다음 층 준비`}
          </Action>
        </div>
      </div>
    </div>
  );
}

function Result({ mode, back }: { mode: Screen; back: () => void }) {
  const raid = mode === 'raid';
  return (
    <div className="ns-result">
      <div className="ns-result-sheet">
        <span className="ns-eyebrow">결과 화면 시안</span>
        <h1>{raid ? '1층에서 귀환' : mode === 'biwu' ? '비무 종료' : '생사결 결과'}</h1>
        <p>
          {raid
            ? '남은 체력과 챙긴 물품, 돌려준 유품을 한 번에 확인합니다.'
            : mode === 'biwu'
              ? '승패와 순위 변화만 기록됩니다. 경기별 성장·물품 보상은 없습니다.'
              : '자비 또는 결착에 따른 무인·장비·판돈의 정산을 분명하게 보여줍니다.'}
        </p>
        <div className="ns-result-facts">
          <span>
            <small>무인</small>
            <b>무명 Lv.14</b>
          </span>
          <span>
            <small>체력</small>
            <b>{raid ? '103 / 120' : mode === 'biwu' ? '변경 없음' : '결과 확정 대기'}</b>
          </span>
          <span>
            <small>{raid ? '귀환' : '기록'}</small>
            <b>{raid ? '1 / 5층' : mode === 'biwu' ? '시즌 순위' : '정산 확인'}</b>
          </span>
        </div>
        <Action tone="jade" onClick={back}>
          출전 선택으로 돌아가기
        </Action>
      </div>
    </div>
  );
}

export function NextStageApp() {
  const [screen, setScreen] = useState<Screen>('select');
  const [mode, setMode] = useState<Screen>('raid');
  const [partySize, setPartySize] = useState(3);
  const [wager, setWager] = useState(100);
  const [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const dangerDialog = useRef<HTMLDialogElement>(null);
  const waitingDialog = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navigate = (next: Screen) => {
    setScreen(next);
    setWaiting(false);
  };
  useEffect(() => {
    mainRef.current?.focus();
  }, [screen]);
  useEffect(() => {
    const dialog = waitingDialog.current;
    if (!dialog) return;
    if (waiting && !dialog.open) dialog.showModal();
    if (!waiting && dialog.open) dialog.close();
  }, [waiting]);
  const openMode = (next: Screen) => {
    setMode(next);
    navigate(next);
  };
  return (
    <div className={`ns-app ns-screen-${screen}`}>
      <header className="ns-header">
        <div className="ns-brand">
          <span className="ns-seal">武</span>
          <b>무 공</b>
          <span className="ns-header-divider" />
          <span className="ns-work-label">다음 단계 UI 시안</span>
        </div>
        <div className="ns-header-side">
          <span className="ns-preview-badge">화면 시안 · 온라인 기능 미연결</span>
          <a href="/" className="ns-back-game">
            현재 게임으로 <Icon name="arrow" />
          </a>
        </div>
      </header>
      <nav className="ns-crumbs" aria-label="시안 화면 이동">
        <button
          type="button"
          aria-current={screen === 'select' ? 'page' : undefined}
          onClick={() => navigate('select')}
        >
          출전 선택
        </button>
        {screen !== 'select' && (
          <>
            <span aria-hidden="true">›</span>
            <button
              type="button"
              aria-current={['raid', 'biwu', 'deathmatch'].includes(screen) ? 'page' : undefined}
              onClick={() => navigate(mode)}
            >
              {mode === 'raid' ? '레이드 준비' : mode === 'biwu' ? '비무 준비' : '생사결 준비'}
            </button>
          </>
        )}
        {['combat', 'rest', 'result'].includes(screen) && (
          <>
            <span aria-hidden="true">›</span>
            <span aria-current="page">
              {screen === 'combat' ? '전투 HUD' : screen === 'rest' ? '층간 정비' : '결과'}
            </span>
          </>
        )}
      </nav>
      <main className="ns-content" ref={mainRef} tabIndex={-1}>
        {screen === 'select' && <ModeSelect open={openMode} />}
        {screen === 'raid' && (
          <RaidPrep
            partySize={partySize}
            setPartySize={setPartySize}
            enter={() => navigate('combat')}
          />
        )}
        {screen === 'biwu' && (
          <PvpPrep
            lethal={false}
            wager={wager}
            setWager={setWager}
            enter={() => setWaiting(true)}
          />
        )}
        {screen === 'deathmatch' && (
          <PvpPrep
            lethal
            wager={wager}
            setWager={setWager}
            enter={() => dangerDialog.current?.showModal()}
          />
        )}
        {screen === 'combat' && (
          <CombatPreview
            mode={mode}
            goRest={() => navigate('rest')}
            goResult={() => navigate('result')}
          />
        )}
        {screen === 'rest' && (
          <RaidRest
            partySize={partySize}
            setPartySize={setPartySize}
            ready={ready}
            setReady={setReady}
            goResult={() => navigate('result')}
          />
        )}
        {screen === 'result' && <Result mode={mode} back={() => navigate('select')} />}
      </main>
      <dialog className="ns-wait" ref={waitingDialog} onCancel={() => setWaiting(false)}>
        <div role="status">
          <b>매칭 대기 화면 시안</b>
          <span>온라인 상대를 찾는 기능은 아직 연결되지 않았습니다.</span>
          <div>
            <Action onClick={() => setWaiting(false)}>대기 취소</Action>
            <Action tone="jade" onClick={() => navigate('combat')}>
              전투 HUD 시안 보기
            </Action>
          </div>
        </div>
      </dialog>
      <dialog className="ns-danger-dialog" ref={dangerDialog}>
        <span className="ns-eyebrow">생사결 · 손실 확인</span>
        <h2>무인을 잃을 수 있습니다</h2>
        <p>
          사망하면 이 무인과 착용 장비·가방 물품이 현장에 남습니다. 상대가 자비를 베풀면 생존하며
          판돈만 정산합니다.
        </p>
        <div className="ns-dialog-facts">
          <span>무명 · Lv.14</span>
          <b>내 판돈 {wager.toLocaleString()} 냥</b>
        </div>
        <div className="ns-dialog-actions">
          <Action onClick={() => dangerDialog.current?.close()}>돌아가기</Action>
          <Action
            tone="danger"
            onClick={() => {
              dangerDialog.current?.close();
              setWaiting(true);
            }}
          >
            조건 확인 · 대기 화면 보기
          </Action>
        </div>
      </dialog>
    </div>
  );
}
