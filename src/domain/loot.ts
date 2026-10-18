import { ART_WEAPONS, isBoss } from './content';
import { bossDefinition, regionName, REGIONS } from './campaign';
import { bossReward } from './boss-loot';
import { makeLootItem, WEAPON_STYLES } from './items';
import type { Item, Run } from './model';

export const REGION_DROP_WEIGHTS = [
  [4, 3, 1, 1],
  [2, 1, 1, 4],
  [7, 1, 1, 2],
  [1, 4, 3, 1],
  [3, 5, 1, 1],
  [2, 1, 6, 1],
  [1, 1, 1, 7],
  [4, 1, 2, 3],
  [5, 2, 1, 3],
  [3, 1, 1, 6],
] as const; // weapon, robe, boots, charm
function weighted(weights: readonly number[], random: () => number) {
  let value = random() * weights.reduce((sum, weight) => sum + weight, 0);
  for (let i = 0; i < weights.length; i++) {
    value -= weights[i];
    if (value < 0) return i;
  }
  return weights.length - 1;
}
export function regionIndex(run: Pick<Run, 'wave' | 'regionRoute'>) {
  return Math.max(
    0,
    REGIONS.findIndex((region) => region.name === regionName(run)),
  );
}
export function lootTier(wave: number, random: () => number) {
  const stage = Math.floor((wave - 1) / 5),
    value = random();
  return stage === 0
    ? value < 0.8
      ? 0
      : 1
    : stage === 1
      ? value < 0.65
        ? 1
        : 0
      : stage === 2
        ? value < 0.25
          ? 2
          : 1
        : value < 0.6
          ? 2
          : 1;
}
function regionStyle(index: number) {
  return (
    ['sword', 'dart', 'sword', 'sword', 'gauntlet', 'staff', 'sword', 'dao', 'dao', 'fan'] as const
  )[index];
}
/** Only called on combat → loot. The caller owns/persists the seeded RNG. */
export function rollWaveLoot(run: Run, random: () => number): Item[] {
  const region = regionIndex(run),
    stage = Math.floor((run.wave - 1) / 5);
  let sequence = 0;
  const items: Item[] = [];
  const add = (templateId: string, quality = 100) => {
    const item = makeLootItem(
      templateId,
      `${run.id}-loot-${run.wave}-${sequence++}`,
      'ground',
      quality,
    );
    items.push(item);
    return item;
  };
  const medicine =
    isBoss(run.wave) && stage >= 2
      ? 'medicine-large'
      : region === 3
        ? 'medicine-snow'
        : stage >= 2
          ? 'medicine-medium'
          : 'medicine-small';
  // Recovery is guaranteed once per encounter; no chance-only survival supplies.
  add(medicine);
  const material = add(`material-${region}`);
  material.count = 1 + (random() < 0.35 ? 1 : 0);
  if (isBoss(run.wave)) {
    const style = ART_WEAPONS[run.fighter.arts[run.fighter.active]?.id ?? 'samja'];
    add(`weapon-${style}-${stage >= 2 ? 2 : 1}`, 90 + Math.floor(random() * 21));
    add('manual-training');
    const boss = bossDefinition(run);
    const reward =
      boss &&
      bossReward(boss.id, `${run.id}-signature-${run.wave}`, 90 + Math.floor(random() * 21));
    if (reward) items.push(reward);
    // Legacy four-region runs still get their defensive equipment reward.
    else add(`gear-robe-${Math.min(2, stage)}`);
  } else if (run.wave % 5 === 3 || random() < 0.55) {
    const type = weighted(REGION_DROP_WEIGHTS[region], random);
    const tier = lootTier(run.wave, random);
    if (tier === 2 && random() < 0.35)
      add(`regional-gear-${region}`, 85 + Math.floor(random() * 26));
    else if (type === 0) {
      const style =
        random() < 0.7
          ? regionStyle(region)
          : WEAPON_STYLES[Math.floor(random() * WEAPON_STYLES.length)];
      add(`weapon-${style}-${tier}`, 80 + Math.floor(random() * 31));
    } else
      add(
        `gear-${(['robe', 'boots', 'charm'] as const)[type - 1]}-${tier}`,
        85 + Math.floor(random() * 26),
      );
  }
  return items;
}
export function merchantSupplies(run: Run) {
  const stage = Math.floor((run.wave - 1) / 5),
    region = regionIndex(run);
  const style = ART_WEAPONS[run.fighter.arts[run.fighter.active]?.id ?? 'samja'];
  return [
    {
      templateId:
        region === 3 ? 'medicine-snow' : stage >= 2 ? 'medicine-medium' : 'medicine-small',
      stock: Math.max(0, Math.min(3, run.merchantStock)),
      price: stage >= 2 || region === 3 ? 12 : 8,
    },
    { templateId: `weapon-${style}-${stage >= 2 ? 2 : 1}`, stock: 1, price: stage >= 2 ? 32 : 20 },
    { templateId: `regional-gear-${region}`, stock: 1, price: 26 },
  ];
}
