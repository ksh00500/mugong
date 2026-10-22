import type { Enemy } from './model';

/** Named bosses and legacy chief/captain saves share permanent control immunity.
 * Damage effects (poison, blossom, life drain) remain effective. */
export function isBossEnemy(e: Pick<Enemy, 'bossId' | 'kind'>) {
  return !!e.bossId || e.kind === 'chief' || e.kind === 'captain';
}

/** A single actor-wide size, shared by rendering and the fixed body capsule. */
export const BOSS_SIZE = 1.2;
export const enemySize = (e: { bossId?: string; kind?: string }) =>
  e.bossId || e.kind === 'chief' || e.kind === 'captain' ? BOSS_SIZE : 1;

/** Existing combat states, not invented HP thresholds or extra invulnerability. */
export function bossCombatPhase(
  e: Pick<Enemy, 'rageTime' | 'guardTime' | 'armourTime' | 'pressure'>,
) {
  if ((e.rageTime ?? 0) > 0) return 'enraged';
  if ((e.guardTime ?? 0) > 0 || (e.armourTime ?? 0) > 0) return 'guard';
  if ((e.pressure?.warning ?? 0) > 0 || (e.pressure?.burst ?? 0) > 0) return 'pursuit';
  return 'combat';
}
export const BOSS_PHASE_LABELS = {
  combat: '교전',
  pursuit: '추격',
  guard: '수세',
  enraged: '격화',
} as const;

/** Discard obsolete control from resumed runs without resetting an attack. */
export function clearBossControl(e: Enemy) {
  if (!isBossEnemy(e)) return;
  e.staggerTime = 0;
  e.confused = 0;
}
