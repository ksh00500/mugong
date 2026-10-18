import { maximumHp } from './content';
import type { Fighter } from './model';

export const MEDIC = { price: 12, recovery: 45 } as const;
/** The physician and the command use the same actual maximum, including growth/equipment. */
export function healingOffer(fighter: Fighter, gold: number) {
  const maximum = maximumHp(fighter);
  const amount = Math.min(MEDIC.recovery, Math.max(0, maximum - fighter.hp));
  return { maximum, amount, price: MEDIC.price, available: amount > 0 && gold >= MEDIC.price };
}
