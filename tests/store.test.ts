import { beforeEach, expect, it, vi } from 'vitest';
import { emptyGame, spawnWave } from '../src/domain/game';
import type { GameState } from '../src/domain/model';
const disk = vi.hoisted(() => ({
  saved: null as GameState | null,
  fail: false,
  delay: 0,
  writes: [] as GameState[],
  active: 0,
  maxActive: 0,
}));
vi.mock('../src/platform/session', () => ({ claimSession: async () => true }));
vi.mock('../src/platform/storage', () => ({
  readSave: async () => structuredClone(disk.saved),
  writeSave: async (state: GameState) => {
    disk.active++;
    disk.maxActive = Math.max(disk.maxActive, disk.active);
    if (disk.delay) await new Promise((resolve) => setTimeout(resolve, disk.delay));
    disk.active--;
    if (disk.fail) throw new Error('quota');
    disk.saved = structuredClone(state);
    disk.writes.push(structuredClone(state));
  },
}));
import { GameStore } from '../src/platform/store';
import { makeWeapon } from '../src/domain/content';
import type { BoundFighter } from '../src/domain/model';
import { signatureCast } from '../src/domain/boss-encounters';
import { waystationApproach } from '../src/domain/waystation';
beforeEach(() => {
  disk.saved = null;
  disk.fail = false;
  disk.delay = 0;
  disk.writes = [];
  disk.active = 0;
  disk.maxActive = 0;
  vi.stubGlobal('document', { hidden: false });
});
for (const wave of [4, 9, 14, 19])
  it(`${wave}: event reward requires a nearby conversation and is committed once`, async () => {
    const store = new GameStore();
    await store.load();
    await store.dispatch({ type: 'start', name: '기연 저장' });
    const r = store.state.run!;
    r.wave = wave;
    spawnWave(r);
    r.offers = [];
    r.fighter.augmentOffers = [];
    r.gold = 100;
    store.rendererReady = true;
    expect(await store.dispatch({ type: 'restEvent', choice: 'accept' })).toBe(false);
    Object.assign(r.fighter, waystationApproach('fortune', r));
    store.interactWaystation();
    expect(store.waystationDialogue).toBe('fortune');
    expect(await store.dispatch({ type: 'restEvent', choice: 'accept' })).toBe(true);
    expect(disk.saved!.run!.restEvents).toHaveLength(1);
    const id = r.fighter.items.at(-1)!.id;
    store.closeWaystation();
    const restored = new GameStore();
    await restored.load();
    expect(restored.state.run!.fighter.items.filter((i) => i.id === id)).toHaveLength(1);
    restored.rendererReady = true;
    restored.interactWaystation();
    expect(await restored.dispatch({ type: 'restEvent', choice: 'accept' })).toBe(false);
  });
it('walkable rest requires proximity, freezes during a conversation and clears transient UI at departure', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '쉼터 거리' });
  const r = store.state.run!;
  r.wave = 4;
  spawnWave(r);
  r.offers = [];
  r.fighter.augmentOffers = [];
  store.rendererReady = true;
  store.interactWaystation();
  expect(store.waystationDialogue).toBeNull();
  r.gold = 100;
  r.fighter.hp = 60;
  expect(await store.dispatch({ type: 'next' })).toBe(false);
  expect(await store.dispatch({ type: 'heal' })).toBe(false);
  expect(r.wave).toBe(4);
  expect(r.gold).toBe(100);
  expect(r.fighter.hp).toBe(60);
  r.fighter.x = 490;
  r.fighter.y = 580;
  store.interactWaystation();
  expect(store.waystationDialogue).toBe('physician');
  expect(await store.dispatch({ type: 'heal' })).toBe(true);
  expect(r.fighter.hp).toBe(105);
  expect(r.gold).toBe(88);
  store.advance({ dx: 1, dy: 0, aim: 0, attack: true, ultimate: false, defense: false }, 1 / 60, 0);
  expect(r.fighter.x).toBe(490);
  expect(r.elapsed).toBe(0);
  store.closeWaystation();
  store.approachWaystation('merchant');
  expect(store.waystationTarget).toBe('merchant');
  store.advance(
    { dx: 1, dy: 0, aim: 0, attack: false, ultimate: false, defense: false },
    1 / 60,
    0,
  );
  expect(store.waystationTarget).toBeNull();
  expect(r.fighter.x).toBeGreaterThan(490);
  r.fighter.x = 1510;
  r.fighter.y = 715;
  store.interactWaystation();
  expect(store.waystationDialogue).toBe('exit');
  await store.dispatch({ type: 'next' });
  expect(store.waystationDialogue).toBeNull();
  expect(store.waystationTarget).toBeNull();
  expect(r.wave).toBe(5);
  expect(disk.saved?.run?.wave).toBe(5);
});
it('클리어 성장 선택 동안 가방을 열지 않고 마지막 선택 저장 후에만 연다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '중첩 검사' });
  const r = store.state.run!;
  r.phase = 'loot';
  r.fighter.level = 2;
  r.fighter.spent = r.spent = 0;
  r.offers = [{ art: 'samja', type: 'learn' }];
  await store.persist();
  const reload = new GameStore();
  await reload.load();
  expect(reload.bagOpen).toBe(false);
  await reload.dispatch({ type: 'choose', offer: reload.state.run!.offers[0] });
  expect(reload.state.run!.offers.length).toBeGreaterThan(0);
  expect(reload.bagOpen).toBe(false);
  await reload.dispatch({ type: 'choose', offer: reload.state.run!.offers[0] });
  expect(reload.state.run!.offers).toEqual([]);
  expect(reload.bagOpen).toBe(true);
});
it('체력 교환은 일반 저장 간격과 관계없이 양쪽 HP를 같은 중요 저장에 기록한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '교환 검증' });
  const r = store.state.run!,
    f = r.fighter,
    e = r.enemies[0];
  r.offers = [];
  r.zones = [];
  r.enemies = [e];
  Object.assign(e, {
    bossId: '8-4',
    x: 900,
    y: 500,
    hp: 200,
    maxHp: 1000,
    xp: 0,
    timer: 100,
    skillClock: 0,
  });
  Object.assign(f, { x: 1000, y: 500, hp: 60, invulnerable: 0 });
  signatureCast(r, e);
  r.encounterObjects![0].warning = 0;
  r.encounterObjects![0].pulse = 0.001;
  store.rendererReady = true;
  disk.delay = 20;
  store.advance(
    { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    1 / 60,
    0,
  );
  expect(r.exchangeSeq).toBe(1);
  expect(store.busy).toBe(true);
  await vi.waitFor(() => expect(disk.saved?.run?.exchangeSeq).toBe(1));
  expect(disk.saved?.run?.fighter.hp).toBe(24);
  expect(disk.saved?.run?.enemies[0].hp).toBe(500);
  expect(store.busy).toBe(false);
  expect(disk.maxActive).toBe(1);
});

it('전투 중 연결은 열린 가방에서만 가능하고 완료 결과를 저장한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '연결' });
  const f = store.state.run!.fighter as BoundFighter;
  f.arts = [{ id: 'samja', level: 1, gauge: 0, combo: 0, defenseCd: 0 }];
  f.items.push({ ...makeWeapon('sword', 'new-sword', 'weapon'), x: 2 });
  expect(await store.dispatch({ type: 'bind', art: 'samja', item: 'new-sword' })).toBe(false);
  store.openBag(true);
  await store.persist();
  expect(await store.dispatch({ type: 'bind', art: 'samja', item: 'new-sword' })).toBe(true);
  expect((disk.saved?.run?.fighter as BoundFighter).bindings?.samja).toBe('new-sword');
  expect(store.notice).toBe('무기를 연결했습니다.');
});

it('전투 종료 결과 저장 후 가방을 자동으로 열고 다시 읽어도 전리품 화면을 유지한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '전리품' });
  store.rendererReady = true;
  store.state.run!.enemies.forEach((enemy) => {
    enemy.hp = 0;
    enemy.xp = 0;
  });
  disk.delay = 20;
  store.advance(
    { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    1 / 60,
    10,
  );
  expect(store.state.run!.phase).toBe('loot');
  expect(store.bagOpen).toBe(false);
  await vi.waitFor(() => expect(store.bagOpen).toBe(true));
  expect(disk.saved?.run?.phase).toBe('loot');
  const reload = new GameStore();
  await reload.load();
  expect(reload.bagOpen).toBe(true);
});

it('전투 종료 저장 실패에는 가방을 열지 않고 재시도 성공 후 같은 전리품을 보여준다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '복구' });
  store.rendererReady = true;
  store.state.run!.enemies.forEach((enemy) => {
    enemy.hp = 0;
  });
  disk.fail = true;
  store.advance(
    { dx: 0, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    1 / 60,
    10,
  );
  await vi.waitFor(() => expect(store.error).toContain('quota'));
  expect(store.bagOpen).toBe(false);
  const items = structuredClone(store.state.run!.fighter.items);
  disk.fail = false;
  await store.retry();
  expect(store.bagOpen).toBe(true);
  expect(disk.saved?.run?.fighter.items).toEqual(items);
});
it('저장 실패 후 입력을 차단하고 재시도에서 같은 결과를 한 번 저장한다', async () => {
  const store = new GameStore();
  await store.load();
  disk.fail = true;
  expect(await store.dispatch({ type: 'start', name: '청하연', seed: 123 })).toBe(false);
  const id = store.state.run!.id;
  expect(store.error).toContain('quota');
  expect(await store.dispatch({ type: 'start', name: '두 번째' })).toBe(false);
  const position = store.state.run!.fighter.x;
  store.advance(
    { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    1 / 60,
    3000,
  );
  expect(store.state.run!.fighter.x).toBe(position);
  disk.fail = false;
  await store.retry();
  expect(store.error).toBe('');
  expect(disk.saved?.run?.id).toBe(id);
  expect(disk.saved?.family.runs).toBe(1);
});
it('빠른 중복 출전 요청 중 저장이 끝나기 전 두 번째 요청은 거부한다', async () => {
  const store = new GameStore();
  await store.load();
  const first = store.dispatch({ type: 'start', name: '한 명' });
  expect(await store.dispatch({ type: 'start', name: '두 명' })).toBe(false);
  await first;
  expect(store.state.family.runs).toBe(1);
});
it('전투 화면 준비 전에는 게임 시간이 흐르지 않고 준비 후에만 이동한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '로딩검객' });
  const x = store.state.run!.fighter.x;
  const input = { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false };
  store.advance(input, 1 / 60, 100);
  expect(store.state.run!.fighter.x).toBe(x);
  store.rendererReady = true;
  store.advance(input, 1 / 60, 200);
  expect(store.state.run!.fighter.x).toBeGreaterThan(x);
  expect(disk.saved).not.toHaveProperty('rendererReady');
});
it('로비에서 물품을 옮겨도 가방은 열린 상태를 유지한다', async () => {
  const initial = emptyGame();
  const { startRun } = await import('../src/domain/game');
  startRun(initial, '귀환자', 123);
  const f = initial.run!.fighter;
  initial.run = null;
  initial.family.roster.push(f);
  initial.selectedId = f.id;
  disk.saved = initial;
  const store = new GameStore();
  await store.load();
  store.openBag(true);
  await store.persist();
  expect(await store.dispatch({ type: 'moveItem', id: f.items[0].id, place: 'warehouse' })).toBe(
    true,
  );
  expect(store.bagOpen).toBe(true);
});
it('획득 물품이 있어도 가방을 닫고 물품을 유지한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '무명' });
  store.state.run!.phase = 'loot';
  await store.dispatch({
    type: 'moveItem',
    id: store.state.run!.fighter.items[0].id,
    place: 'ground',
  });
  store.openBag(true);
  await store.persist();
  store.openBag(false);
  expect(store.bagOpen).toBe(false);
  expect(store.state.run!.fighter.items[0].place).toBe('ground');
});

it('느린 자동 저장 중에도 이동과 무공 전환을 받아들이고 최신 기록을 순서대로 저장한다', async () => {
  const store = new GameStore();
  await store.load();
  await store.dispatch({ type: 'start', name: '연속 입력' });
  const run = store.state.run!;
  run.offers = [];
  run.fighter.arts = ['huashan', 'wudang'].map((id) => ({
    id: id as 'huashan' | 'wudang',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  run.enemies.forEach((enemy) => (enemy.timer = 100));
  store.rendererReady = true;
  disk.delay = 25;
  const checkpoint = store.persist(false);
  await Promise.resolve();
  expect(store.getSnapshot().saving).toBe(true);
  expect(store.busy).toBe(false);
  const x = run.fighter.x;
  store.advance(
    { dx: 1, dy: 0, aim: 0, attack: false, defense: false, ultimate: false },
    1 / 60,
    0,
  );
  expect(run.fighter.x).toBeGreaterThan(x);
  const changed = store.dispatch({ type: 'switch', delta: 1 });
  expect(run.fighter.active).toBe(1);
  await Promise.all([checkpoint, changed]);
  expect(disk.saved?.run?.fighter.active).toBe(1);
  expect(disk.saved?.run?.fighter.x).toBe(run.fighter.x);
  expect(disk.maxActive).toBe(1);
  expect(store.getSnapshot().saving).toBe(false);
});
