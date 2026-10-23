import { characterStats } from './character';
import { weaponPower, equipmentBonus } from './inventory';
import { supportStats } from './support';
import { BALANCE } from './balance';
import { DEFENSE_RULES } from './techniques';
import type { BoundFighter } from './model';

/** Shared owned-fighter values; standard PvP/trial presets keep their separate rules. */
export function fighterAttackPower(f: BoundFighter) {
  return 14 + characterStats(f).strength * 0.1 + weaponPower(f) + equipmentBonus(f, 'charm');
}
export function fighterMoveSpeed(f: BoundFighter) {
  return (
    (265 + Math.min(80, characterStats(f).agility) + equipmentBonus(f, 'boots') * 8) *
    supportStats(f).movementFactor
  );
}
export function fighterDamageTaken(f: BoundFighter, amount: number) {
  return (
    Math.max(1, amount * BALANCE.armourMinimumDamageFactor, amount - equipmentBonus(f, 'robe')) *
    (f.guard > 0 ? DEFENSE_RULES.guardDamageFactor : 1) *
    ((f.fortify ?? 0) > 0 ? 0.65 : 1) *
    supportStats(f).incomingDamageFactor
  );
}
