import { maximumHp } from './content';
import type { Fighter } from './model';
import { balanceStage, ECONOMY } from './balance';

export const MEDIC = { price: 12, recovery: 45 } as const;
/** The physician and the command use the same actual maximum, including growth/equipment. */
export function healingOffer(fighter: Fighter, gold: number, wave = 4) {
  const maximum = maximumHp(fighter);
  const amount = Math.min(MEDIC.recovery, Math.max(0, maximum - fighter.hp));
  const price = ECONOMY.medicPrices[balanceStage(Math.floor((wave - 1) / 5))];
  return { maximum, amount, price, available: amount > 0 && gold >= price };
}
