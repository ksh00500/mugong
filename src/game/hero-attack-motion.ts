import { STRIKE_TIMING } from '../domain/combat';
import type { MotionAction } from './directional-motion';

// Render clock only: the blade crosses the aim at the simulation's contact.
// Half a stroke on either side gives anticipation without delaying the hit.
export const HERO_STROKE_HALF = 0.05;
export function heroAttackMotion(elapsed: number): { action: MotionAction; progress: number } {
  const start = STRIKE_TIMING.contact - HERO_STROKE_HALF;
  const end = STRIKE_TIMING.contact + HERO_STROKE_HALF;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  if (elapsed < start) return { action: 'windup', progress: clamp(elapsed / start) };
  if (elapsed < end)
    return { action: 'strike', progress: clamp((elapsed - start) / (end - start)) };
  return {
    action: 'recover',
    progress: clamp((elapsed - end) / (STRIKE_TIMING.duration - end)),
  };
}

/** Continuous weight transfer on the attack clock, including attacks that miss.
 * Waiting for an impact cue used to jump the body from -3 to +8 at contact.
 */
export function heroCutWeight(elapsed: number) {
  const start = STRIKE_TIMING.contact - HERO_STROKE_HALF;
  const end = STRIKE_TIMING.contact + HERO_STROKE_HALF;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const smooth = (n: number) => {
    const t = clamp(n);
    return t * t * (3 - 2 * t);
  };
  if (elapsed < start) {
    const pull = smooth(elapsed / start);
    return { lunge: -2 * pull, turn: -0.025 * pull };
  }
  if (elapsed < STRIKE_TIMING.contact) {
    const drive = smooth((elapsed - start) / HERO_STROKE_HALF);
    return { lunge: -2 + 8 * drive, turn: -0.025 + 0.06 * drive };
  }
  if (elapsed < end) {
    const follow = smooth((elapsed - STRIKE_TIMING.contact) / HERO_STROKE_HALF);
    return { lunge: 6 + 2 * follow, turn: 0.035 + 0.01 * follow };
  }
  const settle = 1 - smooth((elapsed - end) / (STRIKE_TIMING.duration - end));
  return { lunge: 8 * settle, turn: 0.045 * settle };
}
