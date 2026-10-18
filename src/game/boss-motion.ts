import type { MotionAction } from './directional-motion';

export type BossMotionClock = {
  move: string;
  phase: 'prepare' | 'load' | 'contact' | 'follow' | 'return' | 'ready' | 'hold';
  pose: number;
  contact: number;
};

/** All boss moves consume the simulation's own timing, including each combo hit.
 * Rendering never advances this clock or writes combat/save state. */
export function bossMotionClock(
  move: string,
  action: MotionAction,
  progress: number,
  strike: { duration: number; contacts: readonly number[] },
  holding = false,
): BossMotionClock | undefined {
  const p = Math.max(0, Math.min(1, progress));
  let pose: number,
    contact = -1;
  if (holding) return { move, phase: 'hold', pose: move === 'grab' ? 3 : 2, contact };
  if (action === 'windup') pose = p < 0.45 ? 0 : 1;
  else if (action === 'strike') {
    const elapsed = p * strike.duration;
    contact = strike.contacts.findIndex((t) => elapsed >= t - 0.035 && elapsed <= t + 0.06);
    if (contact >= 0) pose = 2;
    else {
      const previous = strike.contacts.filter((t) => t < elapsed).at(-1);
      const next = strike.contacts.find((t) => t > elapsed);
      // Re-load before each subsequent hit; never hide the second/third swing.
      pose =
        previous === undefined ? 1 : elapsed - previous < 0.18 ? 3 : next !== undefined ? 1 : 4;
    }
  } else if (action === 'recover') {
    // Late contacts can occupy the whole strike tail. Keep follow-through at
    // the start of recovery so that pose is visible without delaying damage.
    pose = p < 0.18 ? 3 : p < 0.58 ? 4 : 5;
  } else return undefined;
  return {
    move,
    pose,
    contact,
    phase: (['prepare', 'load', 'contact', 'follow', 'return', 'ready'] as const)[pose],
  };
}
