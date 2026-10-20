import { afterEach, expect, it } from 'vitest';
import { emptyGame, startRun } from '../src/domain/game';
import { makeLootItem } from '../src/domain/items';
import { BOSS_KITS } from '../src/domain/boss-melee';
import { techniqueStats } from '../src/domain/techniques';
import {
  activeConditions,
  bossBriefing,
  displayValue,
  itemQuantity,
} from '../src/platform/ui-copy';
import { techniqueCopy, itemEffect } from '../src/platform/game-copy';
import { setLanguage } from '../src/platform/i18n';

afterEach(() => setLanguage('ko'));
function fighter() {
  const state = emptyGame();
  startRun(state, 'UI test', 123);
  return state.run!.fighter;
}
it('shows only live conditions, prioritizes loss of control, and preserves combat timers', () => {
  const f = Object.assign(fighter(), {
    capturedTime: 0.26,
    freezeTime: 1.4,
    poisonTime: 3.45,
    bleedTime: 0,
    burnTime: -0.1,
    slowTime: 0.2,
    coldTime: 2.1,
    coldStacks: 3,
  });
  const before = structuredClone(f);
  expect(activeConditions(f).map((c) => c.id)).toEqual([
    'capturedTime',
    'freezeTime',
    'poisonTime',
    'slowTime',
    'coldTime',
  ]);
  expect(activeConditions(f)[0].remaining).toBe(0.26);
  expect(activeConditions(f).at(-1)?.stacks).toBe(3);
  expect(f).toEqual(before);
  f.coldTime = 0;
  expect(activeConditions(f).some((c) => c.id === 'coldTime')).toBe(false);
});
it('distinguishes stored rows and stack totals', () => {
  const items = [
    makeLootItem('medicine-small', 'm', 'warehouse'),
    makeLootItem('material-0', 'o', 'warehouse'),
  ];
  items[1].count = 5;
  expect(itemQuantity(items)).toBe('2종 · 총 6개');
  setLanguage('en');
  expect(itemQuantity(items)).toBe('Stacks: 2 · Items: 6');
});
it('derives two distinct briefing entries from each of the forty shipped boss kits', () => {
  expect(Object.keys(BOSS_KITS)).toHaveLength(40);
  for (const [id, kit] of Object.entries(BOSS_KITS)) {
    const entries = bossBriefing(id);
    expect(entries, id).toHaveLength(2);
    expect(new Set(entries.map((e) => e.label)).size, id).toBe(2);
    for (const entry of entries) expect(kit.sequence, id).toContain(entry.move);
  }
  expect(bossBriefing('unknown')).toEqual([]);
});
it('rounds display values while leaving equipment and technique calculations exact', () => {
  const f = fighter();
  const item = makeLootItem('weapon-sword-1', 's', 'weapon', 83);
  item.power = 1.23456;
  const before = structuredClone(item);
  expect(itemEffect(item, f)).toBe('공격 +1.2');
  expect(item).toEqual(before);
  const stats = techniqueStats('huashan', 7, f);
  const copy = techniqueCopy('huashan', 7, f);
  expect(copy.attack).toContain(`${displayValue(stats.attackInterval, 2)}초`);
  expect(techniqueStats('huashan', 7, f)).toEqual(stats);
});
