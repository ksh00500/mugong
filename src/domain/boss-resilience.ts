import type { Enemy } from './model';

/** Named bosses and legacy chief/captain saves share permanent control immunity.
 * Damage effects (poison, blossom, life drain) remain effective. */
export function isBossEnemy(e: Pick<Enemy, 'bossId' | 'kind'>) {
  return !!e.bossId || e.kind === 'chief' || e.kind === 'captain';
}

/** Discard obsolete control from resumed runs without resetting an attack. */
export function clearBossControl(e: Enemy) {
  if (!isBossEnemy(e)) return;
  e.staggerTime = 0;
  e.confused = 0;
}
