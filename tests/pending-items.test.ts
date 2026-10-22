import { expect, it } from 'vitest';
import { emptyGame, startRun, command } from '../src/domain/game';
import { makeItem, makeWeapon } from '../src/domain/content';
import { migratePendingItems } from '../src/domain/pending-items';
import { activeWeapon, weaponPower } from '../src/domain/inventory';
import type { BoundFighter } from '../src/domain/model';
import { isGameSave } from '../src/platform/save-validation';
import { BOSSES, REGIONS } from '../src/domain/campaign';
import { bossReward } from '../src/domain/boss-loot';
import { HELD_WEAPON_IMAGES } from '../src/platform/assets';
import { dedicatedItemArt } from '../src/platform/item-art';

it('보스가 주는 전용 무기도 손에 표시할 그림이 준비된다', () => {
  let checked = 0;
  for (const boss of BOSSES) {
    const id = `${REGIONS.findIndex((region) => region.name === boss.region)}-${boss.phase}`;
    const item = bossReward(id, 'preview');
    if (item?.kind !== 'sword') continue;
    checked++;
    const art = dedicatedItemArt(item)!;
    expect(HELD_WEAPON_IMAGES[`held-${art.id}`]).toBe(art.src);
  }
  expect(checked).toBe(10);
});

it('이전 정리판 저장의 ID·수량·능력·연결을 보존하고 획득 물품으로만 옮긴다', () => {
  const state = emptyGame();
  startRun(state, '이전 저장', 1);
  const f = state.run!.fighter as BoundFighter;
  const legacy = { ...makeItem('medicine', 'old-pending', 'ground'), count: 7 };
  Object.assign(legacy, { place: 'board' });
  f.items.push(legacy);
  state.family.roster.push({ ...structuredClone(f), id: 'returned' });
  expect(isGameSave(state)).toBe(true);
  const before = structuredClone(state);
  migratePendingItems(state);
  expect(state.run!.fighter.items.at(-1)).toEqual({
    ...before.run!.fighter.items.at(-1),
    place: 'ground',
  });
  expect(state.family.roster[0].items.at(-1)?.place).toBe('ground');
  const migrated = structuredClone(state);
  migratePendingItems(state);
  expect(state).toEqual(migrated);
});
it('표시 무기와 공격력은 같은 현재 무공의 호환 연결을 사용한다', () => {
  const state = emptyGame();
  startRun(state, '무기', 1);
  const f = state.run!.fighter as BoundFighter;
  f.arts = ['shaolin', 'gaebang', 'samja'].map((id) => ({
    id: id as 'shaolin',
    level: 1,
    gauge: 0,
    combo: 0,
    defenseCd: 0,
  }));
  f.items = [
    makeWeapon('gauntlet', 'fist', 'weapon'),
    { ...makeWeapon('staff', 'staff', 'weapon'), x: 2 },
  ];
  f.bindings = { shaolin: 'fist', gaebang: 'staff', samja: 'fist' };
  expect(activeWeapon(f)?.weaponStyle).toBe('gauntlet');
  expect(weaponPower(f)).toBe(f.items[0].power);
  f.active = 1;
  expect(activeWeapon(f)?.id).toBe('staff');
  f.active = 2;
  expect(activeWeapon(f)).toBeUndefined();
  expect(weaponPower(f)).toBe(0);
});
it('획득 물품에서 지정한 물품만 폐기하고 전투 중에는 폐기하지 않는다', () => {
  const state = emptyGame();
  startRun(state, '폐기', 1);
  const r = state.run!;
  r.fighter.items.push(makeItem('ore', 'a', 'ground'), makeItem('ore', 'b', 'ground'));
  expect(command(state, { type: 'discardItem', id: 'a' })).toBe(false);
  r.phase = 'loot';
  expect(command(state, { type: 'discardItem', id: 'a' })).toBe(true);
  expect(r.fighter.items.some((i) => i.id === 'b')).toBe(true);
  expect(command(state, { type: 'discardItem', id: r.fighter.items[0].id })).toBe(false);
});
