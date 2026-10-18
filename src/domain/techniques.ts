import { characterStats } from './character';
import type { ArtId, Fighter } from './model';
import { supportStats } from './support';

export const DEFENSE_RULES = {
  evadeDuration: 0.28,
  guardDamageFactor: 0.3,
  leechRatio: 0.25,
} as const;

/** Shared combat values for the simulation and descriptions. */
export function techniqueStats(id?: ArtId, level = 0, fighter?: Pick<Fighter, 'arts' | 'hp'> & Partial<Fighter>) {
  const support = supportStats(
    fighter ?? { hp: 120, arts: id ? [{ id, level, gauge: 0, combo: 0, defenseCd: 0 }] : [] },
  );
  const inner = fighter ? characterStats({ ...fighter, level: fighter.level ?? 0 }).inner : 0;
  const innerFactor = 1 + inner / 250;
  return {
    multiplier: (!id ? 1 : 1 + level * (id === 'samja' ? 0.15 : 0.27)) * support.attackDamageFactor,
    attackInterval:
      (id === 'huashan'
        ? 0.4
        : id === 'tianmo'
          ? 0.5
          : id === 'samja' && level >= 7
            ? 0.32
            : 0.43) * support.attackIntervalFactor,
    defenseCooldown: 2.8 * support.defenseCooldownFactor,
    guardDuration:
      id === 'wudang'
        ? 0.32
        : id === 'samja'
          ? 0.45
          : id === 'shaolin'
            ? level >= 5
              ? 1.5
              : 0.8
            : id === 'jegal'
              ? 0.6
              : 0,
    counterDamage: (25 + level * 8) * innerFactor,
    counterGauge: 12 * support.gaugeFactor,
    leechDamage: (25 + level * 7) * innerFactor,
    ultimateLevel: id === 'gaebang' ? 1 : id === 'samja' ? 8 : 5,
    ultimateDamage: (id === 'tianmo' ? 110 : id === 'tang' ? 24 : id === 'jegal' ? 36 : 80) * innerFactor,
    ultimateRadius: id === 'wudang' ? 290 : id === 'tianmo' ? 235 : 230,
  };
}
