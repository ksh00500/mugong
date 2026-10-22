import type { BossMotionClock } from './boss-motion';
import type { MotionAction } from './directional-motion';

/** Select the authored hit cycle using only the simulation clock. During the
 * follow-through after hit N, keep N's hand; switch on the next re-load. */
export function bossMotionCycle(
  motion: BossMotionClock,
  action: MotionAction,
  progress: number,
  strike: { duration: number; contacts: readonly number[] },
) {
  const last = Math.max(0, strike.contacts.length - 1);
  if (action === 'recover') return last;
  if (motion.contact >= 0) return motion.contact;
  if (action !== 'strike') return 0;
  const elapsed = Math.max(0, Math.min(1, progress)) * strike.duration;
  if (motion.phase === 'load') {
    const next = strike.contacts.findIndex((time) => time > elapsed);
    return next < 0 ? last : next;
  }
  const next = strike.contacts.findIndex((time) => time > elapsed);
  return next < 0 ? last : Math.max(0, next - 1);
}
