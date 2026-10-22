import type { BoundFighter } from './model';
import { hasWeapon } from './inventory';
import { techniqueStats } from './techniques';

export type CombatAction = 'defense' | 'ultimate';
export type CombatActionBlock =
  | 'untrained'
  | 'restrained'
  | 'unarmed'
  | 'cooling'
  | 'locked'
  | 'charging'
  | 'recovering'
  | 'full';

// Used by the simulation and HUD so a ready indicator follows the actual rules.
export function combatActionBlock(f: BoundFighter, action: CombatAction): CombatActionBlock | null {
  const art = f.arts[f.active];
  if (!art) return 'untrained';
  if ((f.freezeTime ?? 0) > 0 || (f.capturedTime ?? 0) > 0) return 'restrained';
  if (!hasWeapon(f, art.id)) return 'unarmed';
  if (action === 'defense') return art.defenseCd > 0 ? 'cooling' : null;
  if (art.level < techniqueStats(art.id, art.level).ultimateLevel) return 'locked';
  if (art.gauge < 100) return 'charging';
  if (f.cooldown > 0 && art.id !== 'huashan') return 'recovering';
  if (art.id === 'gaebang' && (art.queuedBoosts ?? 0) >= 2) return 'full';
  return null;
}
