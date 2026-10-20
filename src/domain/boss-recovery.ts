import type { BossMove } from './campaign';
import type { MeleeMove } from './boss-kit';
import { meleeKit } from './boss-melee';
import type { Enemy } from './model';

/** Expensive committed actions earn a full, stationary punish window. Quick
 * pokes retain shorter recovery. Rage never erases the heavy-action floor. */
export function bossRecovery(spec: MeleeMove, move: BossMove, enraged = false) {
  const heavy =
    !spec.shot &&
    !spec.zone &&
    (!spec.mechanic || spec.mechanic === 'grab') &&
    (move === 'grab' ||
      move === 'slam' ||
      (spec.dash ?? 0) >= 150 ||
      spec.contacts.length > 1 ||
      (spec.shape === 'circle' && spec.damage > 0) ||
      (spec.damage >= 1.35 && spec.windup >= 0.9));
  const minimum =
    move === 'grab' ? 1.2 : move === 'slam' ? 1.05 : spec.contacts.length > 1 ? 0.95 : 0.85;
  const duration = heavy
    ? Math.max(minimum, spec.recovery * (enraged ? 0.95 : 1))
    : Math.max(0.3, spec.recovery * 0.88 * (enraged ? 0.85 : 1));
  return { heavy, duration };
}

/** Derived from the saved action/timer. No new save field or reset on reload.
 * A visible opening describes this boss, not safety from already flying shots. */
export function bossOpening(e: Enemy) {
  if (!e.bossId || e.state !== 'recover' || e.timer <= 0 || !e.move) return undefined;
  const spec = meleeKit(e)?.moves[e.move];
  if (!spec) return undefined;
  const recovery = bossRecovery(spec, e.move, (e.rageTime ?? 0) > 0);
  return recovery.heavy
    ? { remaining: e.timer, duration: Math.max(e.timer, recovery.duration) }
    : undefined;
}
