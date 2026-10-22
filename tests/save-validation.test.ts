import { expect, it } from 'vitest';
import { command, emptyGame, grantXp, startRun } from '../src/domain/game';
import { isGameSave } from '../src/platform/save-validation';

it('새 저장·전투·성장 선택·사망·귀환 저장 형식을 받아들인다', () => {
  const state = emptyGame();
  expect(isGameSave(state)).toBe(true);
  startRun(state, '검객', 123);
  expect(isGameSave(state)).toBe(true);
  grantXp(state.run!, 20);
  expect(isGameSave(state)).toBe(true);
  command(state, { type: 'choose', offer: state.run!.offers[0] });
  state.run!.phase = 'dead';
  state.run!.fighter.hp = 0;
  state.run!.fighter.items = [];
  expect(isGameSave(state)).toBe(true);
  command(state, { type: 'claim' });
  startRun(state, '귀환 검객', 456);
  state.run!.phase = 'loot';
  state.run!.wave = 20;
  command(state, { type: 'next' });
  expect(isGameSave(state)).toBe(true);
});

it('예전 선택적 필드가 없는 정상 저장도 보존해서 불러온다', () => {
  const state = emptyGame();
  startRun(state, '이전 검객', 123);
  delete state.run!.fighter.spent;
  expect(isGameSave(state)).toBe(true);
});

it.each([
  (state: ReturnType<typeof emptyGame>) => {
    (state.run!.fighter as unknown as Record<string, unknown>).arts = null;
  },
  (state: ReturnType<typeof emptyGame>) => {
    (state.run!.fighter as unknown as Record<string, unknown>).items = 'broken';
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.fighter.hp = NaN;
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.fighter.items[0].count = -1;
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.enemies[0].kind = 'missing-enemy' as never;
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.wave = 21;
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.offers = [{ art: 'missing-art', type: 'learn' } as never];
  },
  (state: ReturnType<typeof emptyGame>) => {
    state.run!.fighter.items.push({ ...state.run!.fighter.items[0] });
  },
])('손상된 중첩 필드를 거부하며 입력 객체를 고치거나 지우지 않는다 %#', (corrupt) => {
  const state = emptyGame();
  startRun(state, '남길 검객', 123);
  corrupt(state);
  const original = structuredClone(state);
  expect(isGameSave(state)).toBe(false);
  expect(state).toEqual(original);
});

it.each([null, false, 0, '', {}, { version: 2 }])(
  '유효하지 않은 최상위 형식을 거부한다 %#',
  (state) => {
    expect(isGameSave(state)).toBe(false);
  },
);

it.each(['max', 'unknown-upgrade', 'known-learn', 'duplicate', 'spent'])(
  '성장 후보와 무인의 경지가 모순되면 원본을 보존하고 거부한다 %s',
  (kind) => {
    const state = emptyGame();
    startRun(state, '원본', 123);
    const run = state.run!;
    run.fighter.level = 10;
    run.spent = 9;
    run.fighter.arts = [
      { id: 'huashan', level: kind === 'max' ? 5 : 1, combo: 0, gauge: 0, defenseCd: 0 },
    ];
    run.offers = [{ art: 'huashan', type: 'upgrade' }];
    if (kind === 'unknown-upgrade') run.offers[0].art = 'wudang';
    if (kind === 'known-learn') run.offers[0].type = 'learn';
    if (kind === 'duplicate') run.offers.push({ ...run.offers[0] });
    if (kind === 'spent') run.spent = 10;
    const original = structuredClone(state);
    expect(isGameSave(state)).toBe(false);
    expect(state).toEqual(original);
  },
);
