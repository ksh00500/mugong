import { describe, expect, it } from 'vitest';
import { makeItem, makeWeapon } from '../src/domain/content';
import { equipmentComparisons } from '../src/domain/equipment-comparison';
import { command, emptyGame, startRun } from '../src/domain/game';
import { makeLootItem } from '../src/domain/items';
import type { BoundFighter } from '../src/domain/model';
import { comparisonMessages } from '../src/platform/comparison-messages';

function fixture() {
  const state = emptyGame();
  startRun(state, '비교 검증', 123);
  const f = state.run!.fighter as BoundFighter;
  f.arts = ['samja', 'wudang', 'huashan', 'tianmo'].map((id) => ({
    id: id as 'samja',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [
    makeLootItem('weapon-sword-0', 'old', 'weapon'),
    { ...makeLootItem('weapon-sword-1', 'second', 'weapon'), x: 1 },
    { ...makeWeapon('dao', 'dao', 'weapon'), x: 3 },
  ];
  f.bindings = { samja: 'old', wudang: 'second', huashan: 'old', tianmo: 'dao' };
  return { state, f };
}
describe('교체될 장비와 비교', () => {
  it('현재 무공 기준으로 묶고 호환 무공만 비교하며 저장은 바꾸지 않는다', () => {
    const { f } = fixture();
    f.active = 1;
    const before = JSON.stringify(f);
    const rows = equipmentComparisons(f, makeLootItem('weapon-sword-2', 'new', 'ground'));
    expect(
      rows.map((row) => [row.arts, row.previous[0].id, row.current, row.next, row.delta]),
    ).toEqual([
      [['wudang'], 'second', 6, 9, 3],
      [['samja', 'huashan'], 'old', 3, 9, 6],
    ]);
    expect(JSON.stringify(f)).toBe(before);
  });
  it('현재 무기를 다시 선택해도 다른 연결 대상의 비교는 남는다', () => {
    const { f } = fixture();
    expect(equipmentComparisons(f, f.items[0]).map((row) => row.arts)).toEqual([['wudang']]);
    f.bindings = { samja: 'old', wudang: 'old', huashan: 'old' };
    expect(equipmentComparisons(f, f.items[0])).toEqual([]);
  });
  it('미연결·잘못된 종류·수납하지 않은 연결은 공격 0으로 비교한다', () => {
    const { f } = fixture();
    f.bindings = { samja: 'dao', wudang: 'second', huashan: 'missing' };
    f.items[1].place = 'general';
    const rows = equipmentComparisons(f, makeLootItem('weapon-sword-2', 'new', 'general'));
    expect(rows).toHaveLength(1);
    expect(rows[0].current).toBe(0);
    expect(rows[0].arts).toEqual(['samja', 'wudang', 'huashan']);
  });
  it('도포 교체의 증감과 실제 교체 후 보존이 일치한다', () => {
    const { state, f } = fixture();
    state.run!.phase = 'loot';
    state.run!.enemies = [];
    f.items.push(makeLootItem('gear-robe-0', 'robe', 'equipped'), {
      ...makeLootItem('gear-robe-2', 'new-robe', 'general'),
      x: 4,
    });
    const candidate = f.items.at(-1)!;
    expect(equipmentComparisons(f, candidate)[0]).toMatchObject({
      metric: '받는 피해 감소',
      current: 1,
      next: 3,
      delta: 2,
      percent: false,
    });
    expect(command(state, { type: 'moveItem', id: candidate.id, place: 'equipped' })).toBe(true);
    expect(f.items.find((item) => item.id === 'robe')?.place).toBe('general');
    expect(equipmentComparisons(f, candidate)).toEqual([]);
  });
  it('낮은 장신구·동급 장신구·빈 슬롯을 구분한다', () => {
    const { f } = fixture();
    f.items.push(makeLootItem('gear-charm-2', 'charm', 'equipped'));
    expect(equipmentComparisons(f, makeLootItem('gear-charm-0', 'new', 'ground'))[0].delta).toBe(
      -4,
    );
    expect(equipmentComparisons(f, makeLootItem('gear-charm-2', 'equal', 'ground'))[0].delta).toBe(
      0,
    );
    expect(
      equipmentComparisons(f, makeLootItem('gear-robe-0', 'empty', 'warehouse'))[0],
    ).toMatchObject({ current: 0, next: 1, delta: 1, previous: [] });
  });
  it('신발은 실제 기본 이동속도에 대한 증가율을 표시한다', () => {
    const { f } = fixture();
    f.items.push(makeLootItem('gear-boots-0', 'boots', 'equipped'));
    expect(equipmentComparisons(f, makeLootItem('gear-boots-2', 'new', 'ground'))[0]).toMatchObject(
      { metric: '이동 속도', current: 3, next: 9.1, delta: 6.1, percent: true },
    );
  });
  it('첫 무공 이전의 기본 검과 비교하되 비호환 종류·소모품은 비교하지 않는다', () => {
    const { f } = fixture();
    f.arts = [];
    expect(
      equipmentComparisons(f, makeLootItem('weapon-sword-2', 'new', 'ground'))[0].current,
    ).toBe(3);
    expect(equipmentComparisons(f, makeWeapon('staff', 'staff', 'ground'))).toEqual([]);
    expect(equipmentComparisons(f, makeItem('medicine', 'medicine', 'ground'))).toEqual([]);
  });
  it('비교 문구 모두 네 가지 번역을 갖는다', () => {
    for (const values of Object.values(comparisonMessages)) expect(values).toHaveLength(4);
  });
});
