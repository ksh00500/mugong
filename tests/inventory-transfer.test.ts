import { expect, it } from 'vitest';
import { command, emptyGame, startRun } from '../src/domain/game';
import { makeItem, makeWeapon } from '../src/domain/content';
import { quickTransferPlan } from '../src/domain/inventory-transfer';

it('창고 중첩을 나눠 수납하고 되돌려도 물품 총량을 보존한다', () => {
  const state = emptyGame();
  startRun(state, '검증', 1);
  state.run!.wave = 20;
  state.run!.phase = 'loot';
  state.run!.offers = [];
  command(state, { type: 'next' });
  const fighter = state.family.roster[0];
  fighter.items = [];
  state.family.warehouse = [{ ...makeItem('medicine', 'stack', 'warehouse'), count: 4 }];
  const plan = quickTransferPlan(state.family.warehouse[0], fighter.items, false)!;
  expect(command(state, plan)).toBe(true);
  expect(state.family.warehouse[0].count).toBe(3);
  expect(fighter.items[0].place).toBe('general');
  expect(command(state, quickTransferPlan(fighter.items[0], fighter.items, false)!)).toBe(true);
  expect(fighter.items).toHaveLength(0);
  expect(state.family.warehouse[0].count).toBe(4);
});
it('실제 점유 칸·회전·가방 종류에 맞추고 공간 부족은 변경하지 않는다', () => {
  const filled = Array.from({ length: 80 }, (_, n) => ({
    ...makeItem('medicine', `fill-${n}`, 'general'),
    x: n % 10,
    y: Math.floor(n / 10),
  }));
  const item = makeItem('medicine', 'new', 'warehouse');
  expect(quickTransferPlan(item, filled, false)).toBeNull();
  expect(item.place).toBe('warehouse');
  expect(filled).toHaveLength(80);
  expect(
    quickTransferPlan(makeWeapon('sword', 'sword', 'warehouse'), filled, false, true),
  ).toMatchObject({
    place: 'weapon',
    rotated: true,
  });
});
it('강호에서는 창고 이동을 막고 획득 물품과 가방 사이를 오간다', () => {
  const state = emptyGame();
  startRun(state, '검증', 1);
  const run = state.run!,
    fighter = run.fighter;
  run.phase = 'loot';
  run.offers = [];
  const item = makeItem('medicine', 'item', 'general');
  fighter.items = [item];
  expect(
    quickTransferPlan(makeItem('medicine', 'warehouse', 'warehouse'), fighter.items, true),
  ).toBeNull();
  expect(command(state, quickTransferPlan(item, fighter.items, true)!)).toBe(true);
  expect(item.place).toBe('ground');
  expect(command(state, quickTransferPlan(item, fighter.items, true)!)).toBe(true);
  expect(item.place).toBe('general');
  run.phase = 'combat';
  expect(command(state, quickTransferPlan(item, fighter.items, true)!)).toBe(false);
  expect(item.place).toBe('general');
});
