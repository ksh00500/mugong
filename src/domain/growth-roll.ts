import type { GrowthRates } from './model';

// Integer tenths keep the budget exact before converting to displayed multipliers.
export const GROWTH_ROLL = {
  minimum: 8,
  maximum: 20,
  totalMinimum: 45,
  totalMaximum: 55,
  totalMean: 50,
  totalSigma: 2,
  individualSigma: 2.2,
} as const;

type Weighted<T> = { value: T; cumulative: number };
function table<T>(entries: { value: T; weight: number }[]): Weighted<T>[] {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cumulative = 0;
  return entries.map(entry => ({ value: entry.value, cumulative: (cumulative += entry.weight / total) }));
}
function choose<T>(choices: Weighted<T>[], random: () => number): T {
  const roll = random();
  let low = 0, high = choices.length - 1;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (roll < choices[mid].cumulative) high = mid;
    else low = mid + 1;
  }
  return choices[low].value;
}

const totals = table(Array.from({ length: GROWTH_ROLL.totalMaximum - GROWTH_ROLL.totalMinimum + 1 }, (_, index) => {
  const value = GROWTH_ROLL.totalMinimum + index;
  return { value, weight: Math.exp(-0.5 * ((value - GROWTH_ROLL.totalMean) / GROWTH_ROLL.totalSigma) ** 2) };
}));
const allocations = new Map<number, Weighted<number[]>[]>();
for (let total = GROWTH_ROLL.totalMinimum; total <= GROWTH_ROLL.totalMaximum; total++) {
  const entries: { value: number[]; weight: number }[] = [];
  for (let a = GROWTH_ROLL.minimum; a <= GROWTH_ROLL.maximum; a++)
    for (let b = GROWTH_ROLL.minimum; b <= GROWTH_ROLL.maximum; b++)
      for (let c = GROWTH_ROLL.minimum; c <= GROWTH_ROLL.maximum; c++) {
        const d = total - a - b - c;
        if (d < GROWTH_ROLL.minimum || d > GROWTH_ROLL.maximum) continue;
        const value = [a, b, c, d];
        const distance = value.reduce((sum, n) => sum + ((n - total / 4) / GROWTH_ROLL.individualSigma) ** 2, 0);
        entries.push({ value, weight: Math.exp(-0.5 * distance) });
      }
  allocations.set(total, table(entries));
}

// Discrete, bounded Gaussian weights. Conditioning on the budget makes strong
// individual rolls cost other stats without favouring any one of the four stats.
export function rollGrowth(random: () => number = Math.random): GrowthRates {
  const total = choose(totals, random);
  const [constitution, strength, agility, inner] = choose(allocations.get(total)!, random).map(n => n / 10);
  return { constitution, strength, agility, inner };
}
