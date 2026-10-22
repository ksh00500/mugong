import { expect, it } from 'vitest';
import { makeItem, makeWeapon } from '../src/domain/content';
import { command, emptyGame, startRun } from '../src/domain/game';
import { canPlace, compactBags, firstSpace, hasWeapon } from '../src/domain/inventory';
import type { BoundFighter } from '../src/domain/model';
import { isGameSave } from '../src/platform/save-validation';

function fixture() {
  const state = emptyGame();
  startRun(state, '가방 검증', 123);
  const r = state.run!,
    f = r.fighter as BoundFighter;
  f.arts = [{ id: 'samja', level: 1, combo: 0, gauge: 0, defenseCd: 0 }];
  f.bindings = { samja: f.items[0].id };
  r.phase = 'loot';
  r.enemies = [];
  return { state, r, f };
}
it('전투 중 기존 호환 무기의 연결은 바꾸되 이동·정리·사용·일반 가방 무기 연결은 막는다', () => {
  const { state, r, f } = fixture();
  r.phase = 'combat';
  f.items.push({ ...makeWeapon('sword', 'better', 'weapon'), x: 2 });
  expect(command(state, { type: 'bind', art: 'samja', item: 'better' })).toBe(true);
  expect(hasWeapon(f, 'samja')).toBe(true);
  expect(f.bindings?.samja).toBe('better');
  expect(command(state, { type: 'moveItem', id: 'better', place: 'ground' })).toBe(false);
  expect(command(state, { type: 'arrangeItems' })).toBe(false);
  expect(command(state, { type: 'use', id: f.items[1].id })).toBe(false);
  f.items.push(makeWeapon('dao', 'wrong', 'weapon'), makeWeapon('sword', 'general', 'general'));
  expect(command(state, { type: 'bind', art: 'samja', item: 'wrong' })).toBe(false);
  expect(command(state, { type: 'bind', art: 'samja', item: 'general' })).toBe(false);
});
it('자동 정리는 연결·회전·착용 장비·창고를 보존하고 전리품과 정리판의 중첩을 하나씩 수납한다', () => {
  const { state, f } = fixture();
  Object.assign(f.items[0], { x: 1, y: 6, rotated: true });
  f.items[1].x = 9;
  f.items[1].y = 7;
  const robe = makeItem('robe', 'wearing', 'equipped');
  f.items.push(robe);
  f.items.push(
    { ...makeItem('medicine', 'loot', 'ground'), count: 3 },
    makeItem('ore', 'ground', 'ground'),
  );
  state.family.warehouse.push(makeItem('charm', 'warehouse', 'warehouse'));
  const bindings = structuredClone(f.bindings),
    warehouse = structuredClone(state.family.warehouse);
  const quantity = f.items.reduce((sum, item) => sum + item.count, 0);
  expect(command(state, { type: 'arrangeItems' })).toBe(true);
  expect(f.items.some((item) => item.place === 'ground')).toBe(false);
  expect(f.items.reduce((sum, item) => sum + item.count, 0)).toBe(quantity);
  expect(f.items.filter((item) => item.kind === 'medicine').map((item) => item.count)).toEqual([
    1, 1, 1, 1,
  ]);
  expect(f.items[0].rotated).toBe(true);
  expect(f.bindings).toEqual(bindings);
  expect(f.items.find((item) => item.id === 'wearing')).toEqual(robe);
  expect(state.family.warehouse).toEqual(warehouse);
  for (const item of f.items.filter((item) => item.place === 'weapon' || item.place === 'general'))
    expect(canPlace(f.items, item, item.place, item.x, item.y)).toBe(true);
  expect(isGameSave(state)).toBe(true);
  const after = structuredClone(state);
  command(state, { type: 'arrangeItems' });
  expect(state).toEqual(after);
});
it('한 칸만 남은 가방에는 한 개만 수납하고 남은 중첩과 수량을 보존한다', () => {
  const { state, f } = fixture();
  f.items = [
    f.items[0],
    ...Array.from({ length: 79 }, (_, n) => ({
      ...makeItem('ore', `ore-${n}`, 'general'),
      x: n % 10,
      y: Math.floor(n / 10),
    })),
  ];
  f.items.push({ ...makeItem('medicine', 'many', 'ground'), count: 10 });
  command(state, { type: 'arrangeItems' });
  expect(f.items.find((item) => item.id === 'many')?.count).toBe(9);
  expect(f.items.find((item) => item.id === 'many')?.place).toBe('ground');
  expect(
    f.items.filter((item) => item.kind === 'medicine').reduce((n, item) => n + item.count, 0),
  ).toBe(10);
  expect(isGameSave(state)).toBe(true);
});
it('서로 다른 크기·방향의 기존 배치를 정리해도 겹침이나 손실을 만들지 않는다', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const items = [] as ReturnType<typeof makeItem>[];
    for (let n = 0; n < 30; n++) {
      const item = makeItem(
        (['robe', 'boots', 'manual', 'ore'] as const)[(seed + n * 7) % 4],
        `item-${n}`,
        'general',
      );
      item.rotated = (seed + n) % 3 === 0;
      const space = firstSpace(items, item, 'general');
      if (space) items.push({ ...item, ...space });
    }
    const ids = items.map((item) => item.id);
    compactBags(items);
    expect(items.map((item) => item.id)).toEqual(ids);
    for (const item of items) expect(canPlace(items, item, 'general', item.x, item.y)).toBe(true);
  }
});
