import { expect, it } from 'vitest';
import { emptyGame, startRun, spawnWave } from '../src/domain/game';
import { decodeCurrentSave } from '../src/platform/save-migrations';
import { isGameSave } from '../src/platform/save-validation';

function legacy() {
  const state = emptyGame();
  startRun(state, '기존 무인', 123);
  state.run!.regionRoute = ['혈마전', '독무곡', '설산', '청하현'];
  const run = state.run! as typeof state.run & { altarUsed: boolean };
  run.altarUsed = true;
  run.gold = 75;
  run.zones = [
    {
      id: 0,
      x: 1250,
      y: 520,
      radius: 45,
      warning: 0,
      life: 10000,
      pulse: 0,
      kind: 'altar',
    } as never,
    { id: 1, x: 500, y: 450, radius: 85, warning: 1, life: 6, pulse: 0, kind: 'poison' },
  ];
  return state;
}

it('제단이 있는 기존 저장은 해당 구역과 플래그만 제거하고 진행·금화·원본을 보존한다', () => {
  const raw = legacy(),
    original = structuredClone(raw);
  expect(isGameSave(raw)).toBe(false);
  const decoded = decodeCurrentSave(raw)!;
  expect(isGameSave(decoded)).toBe(true);
  expect(decoded.run!.zones?.map((zone) => zone.kind)).toEqual(['poison']);
  expect(decoded.run).not.toHaveProperty('altarUsed');
  expect(decoded.run!.gold).toBe(75);
  expect(decoded.run!.fighter).toMatchObject(raw.run!.fighter);
  expect(decoded.run!.enemies).toEqual(raw.run!.enemies);
  expect(decoded.run!.wave).toBe(raw.run!.wave);
  expect(raw).toEqual(original);
});

it.each(['invalid-zone', 'negative-zone-id', 'invalid-flag', 'invalid-fighter', 'excess-zones'])(
  '제단 제거로 손상된 저장을 정상 처리하지 않는다: %s',
  (kind) => {
    const raw = legacy();
    if (kind === 'invalid-zone') raw.run!.zones![0].radius = NaN;
    if (kind === 'negative-zone-id') raw.run!.zones![0].id = -1;
    if (kind === 'invalid-flag') (raw.run as any).altarUsed = 'invalid';
    if (kind === 'invalid-fighter') raw.run!.fighter.hp = NaN;
    if (kind === 'excess-zones')
      raw.run!.zones = Array.from({ length: 9 }, () => raw.run!.zones![0]);
    expect(decodeCurrentSave(raw)).toBeNull();
  },
);
it('이전 선택적 플래그가 명시적 undefined인 정상 저장도 읽는다', () => {
  const raw = legacy();
  (raw.run as any).altarUsed = undefined;
  expect(decodeCurrentSave(raw)?.run).not.toHaveProperty('altarUsed');
  expect(decodeCurrentSave(raw)?.run?.gold).toBe(75);
});

it('혈마전의 일반 웨이브와 보스 웨이브 어디에도 제단을 생성하지 않는다', () => {
  const state = emptyGame();
  startRun(state, '혈마전 검증', 123);
  state.run!.regionRoute = ['혈마전', '혈마전', '혈마전', '혈마전'];
  for (let wave = 1; wave <= 20; wave++) {
    state.run!.wave = wave;
    spawnWave(state.run!);
    expect(state.run).not.toHaveProperty('altarUsed');
    expect(state.run!.zones).toEqual([]);
  }
});
