import { describe, expect, it } from 'vitest';
import { rollGrowth } from '../src/domain/growth-roll';
import { emptyGame, command } from '../src/domain/game';
import { isGameSave } from '../src/platform/save-validation';

function seeded(seed: number) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000);
}

describe('recruit growth distribution', () => {
  it('limits the rounded total and clusters both budgets and individual stats around the centre', () => {
    const random = seeded(812493);
    const totals = Array(11).fill(0), bins = Array(13).fill(0), sums = [0, 0, 0, 0];
    const count = 100000;
    for (let i = 0; i < count; i++) {
      const rates = Object.values(rollGrowth(random));
      const tenths = rates.map(value => Math.round(value * 10));
      const total = tenths.reduce((a, b) => a + b, 0);
      if (total < 45 || total > 55 || tenths.some(n => n < 8 || n > 20))
        throw new Error(`invalid growth: ${rates}`);
      totals[total - 45]++;
      tenths.forEach((n, at) => { bins[n - 8]++; sums[at] += n / 10; });
    }
    const meanTotal = totals.reduce((sum, n, i) => sum + n * (45 + i) / 10, 0) / count;
    expect(meanTotal).toBeCloseTo(5, 2);
    expect(totals[5]).toBeGreaterThan(totals[0] * 15);
    expect(totals[5]).toBeGreaterThan(totals[10] * 15);
    expect(totals.slice(3, 8).reduce((a, b) => a + b, 0) / count).toBeGreaterThan(0.78);
    expect(bins[4] + bins[5]).toBeGreaterThan(bins[0] * 5);
    expect(bins[12]).toBeGreaterThan(0);
    expect(bins[12] / (count * 4)).toBeLessThan(0.001);
    for (const sum of sums) expect(sum / count).toBeCloseTo(1.25, 2);
  });

  it('can roll the extremes and saves a x2.0 warrior without invalidating old budgets', () => {
    const values = [1 - Number.EPSILON, 1 - Number.EPSILON];
    const extreme = rollGrowth(() => values.shift()!);
    expect(extreme.constitution).toBe(2);
    expect(Object.values(extreme).reduce((a, b) => a + b, 0)).toBeCloseTo(5.5, 8);
    const state = emptyGame();
    command(state, { type: 'recruit' }, 1000);
    const candidate = state.family.recruitment!.candidates[0];
    candidate.growth = extreme;
    expect(isGameSave(state)).toBe(true);
    command(state, { type: 'startRecruit', id: candidate.id, name: '극단 검증' });
    expect(state.run!.fighter.growth).toEqual(extreme);
    expect(isGameSave(state)).toBe(true);
    state.run!.fighter.growth = { constitution: 1.6, strength: 1.6, agility: 1.6, inner: 1.6 };
    expect(isGameSave(state)).toBe(true);
  });
});
