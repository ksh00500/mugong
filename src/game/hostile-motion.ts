import type { Enemy } from '../domain/model';
import { enemyAttack } from '../domain/combat';
import { meleeKit } from '../domain/boss-melee';
import { sampleRig, type MotionAction, type RigPose } from './directional-motion';

export type HostileMotion =
  | 'slash'
  | 'thrust'
  | 'shoot'
  | 'throw'
  | 'cast'
  | 'dash'
  | 'pulse'
  | 'summon'
  | 'sweep'
  | 'slam'
  | 'stance'
  | 'grab'
  | 'bell';
/** Resolve the current attack, including a boss changing moves within one encounter. */
export function hostileMotion(enemy: Enemy): HostileMotion {
  const profile = enemyAttack(enemy);
  if (profile.melee?.motion) return profile.melee.motion;
  if (profile.move === 'hazard') return 'throw';
  if (profile.move === 'fan') {
    if (!enemy.bossId && ['bowman', 'crossbow'].includes(enemy.role ?? '')) return 'shoot';
    if (!enemy.bossId && ['needle', 'slinger', 'ringblade'].includes(enemy.role ?? ''))
      return 'throw';
    return 'cast';
  }
  if (profile.move === 'ring') return 'cast';
  if (profile.move === 'combo') return meleeKit(enemy)?.weapon === 'gauntlet' ? 'thrust' : 'slash';
  if (profile.move) return profile.move;
  return profile.ranged
    ? 'shoot'
    : profile.dash
      ? 'dash'
      : enemy.kind === 'spear'
        ? 'thrust'
        : 'slash';
}

type Track = {
  lean: number;
  arm: number;
  twist: number;
  reach: number;
  handLift: number;
  crouch: number;
};
const tracks: Record<HostileMotion, [Track, Track, Track]> = {
  sweep: [
    { lean: -0.03, arm: -0.1, twist: -0.075, reach: -0.02, handLift: 0.02, crouch: 0.02 },
    { lean: 0.025, arm: 0.15, twist: 0.09, reach: 0.075, handLift: 0.02, crouch: 0.01 },
    { lean: 0, arm: 0.035, twist: 0.025, reach: 0.01, handLift: 0, crouch: 0 },
  ],
  slam: [
    { lean: -0.025, arm: -0.025, twist: 0, reach: -0.015, handLift: 0.12, crouch: 0.04 },
    { lean: 0.075, arm: 0.035, twist: 0, reach: 0.055, handLift: -0.07, crouch: 0.075 },
    { lean: 0.01, arm: 0, twist: 0, reach: 0, handLift: 0, crouch: 0.025 },
  ],
  stance: [
    { lean: -0.01, arm: 0.04, twist: 0, reach: -0.025, handLift: 0.04, crouch: 0.035 },
    { lean: 0, arm: 0.065, twist: 0, reach: -0.015, handLift: 0.05, crouch: 0.035 },
    { lean: 0, arm: 0.02, twist: 0, reach: 0, handLift: 0.015, crouch: 0.01 },
  ],
  grab: [
    { lean: -0.025, arm: -0.03, twist: -0.012, reach: -0.06, handLift: 0.025, crouch: 0.025 },
    { lean: 0.065, arm: 0.07, twist: 0.015, reach: 0.12, handLift: 0.025, crouch: 0.025 },
    { lean: 0.01, arm: 0.02, twist: 0, reach: 0.015, handLift: 0, crouch: 0 },
  ],
  bell: [
    { lean: -0.025, arm: -0.045, twist: -0.025, reach: -0.015, handLift: 0.09, crouch: 0.01 },
    { lean: 0.045, arm: 0.075, twist: 0.03, reach: 0.07, handLift: -0.025, crouch: 0.02 },
    { lean: 0, arm: 0.015, twist: 0, reach: 0, handLift: 0, crouch: 0 },
  ],
  slash: [
    { lean: -0.035, arm: -0.09, twist: -0.045, reach: -0.025, handLift: 0.035, crouch: 0.014 },
    { lean: 0.065, arm: 0.11, twist: 0.05, reach: 0.045, handLift: -0.015, crouch: 0 },
    { lean: 0.018, arm: 0.025, twist: 0.015, reach: 0.012, handLift: 0, crouch: 0 },
  ],
  thrust: [
    { lean: -0.04, arm: -0.025, twist: -0.008, reach: -0.075, handLift: 0, crouch: 0.018 },
    { lean: 0.075, arm: 0.025, twist: 0.012, reach: 0.105, handLift: 0, crouch: 0.012 },
    { lean: 0.018, arm: 0.008, twist: 0.004, reach: 0.025, handLift: 0, crouch: 0 },
  ],
  shoot: [
    { lean: -0.015, arm: -0.055, twist: -0.026, reach: 0.035, handLift: 0.018, crouch: 0 },
    { lean: 0.02, arm: 0.025, twist: 0.018, reach: 0.06, handLift: 0.018, crouch: 0 },
    { lean: 0, arm: 0.006, twist: 0.006, reach: 0.012, handLift: 0.006, crouch: 0 },
  ],
  throw: [
    { lean: -0.035, arm: -0.025, twist: -0.025, reach: -0.035, handLift: 0.105, crouch: 0.012 },
    { lean: 0.055, arm: 0.035, twist: 0.025, reach: 0.09, handLift: 0.045, crouch: 0 },
    { lean: 0.015, arm: 0.012, twist: 0.008, reach: 0.025, handLift: 0.012, crouch: 0 },
  ],
  cast: [
    { lean: -0.012, arm: 0.03, twist: -0.012, reach: -0.015, handLift: 0.055, crouch: 0.006 },
    { lean: 0.035, arm: 0.07, twist: 0.012, reach: 0.07, handLift: 0.025, crouch: 0 },
    { lean: 0.01, arm: 0.018, twist: 0.004, reach: 0.018, handLift: 0.01, crouch: 0 },
  ],
  dash: [
    { lean: -0.055, arm: -0.045, twist: -0.02, reach: -0.04, handLift: 0.008, crouch: 0.045 },
    { lean: 0.105, arm: 0.04, twist: 0.015, reach: 0.065, handLift: 0.015, crouch: 0.018 },
    { lean: 0.025, arm: 0.01, twist: 0.004, reach: 0.015, handLift: 0, crouch: 0.006 },
  ],
  pulse: [
    { lean: -0.02, arm: -0.025, twist: 0, reach: -0.02, handLift: 0.07, crouch: 0.065 },
    { lean: 0.04, arm: 0.055, twist: 0, reach: 0.035, handLift: -0.025, crouch: 0.018 },
    { lean: 0.015, arm: 0.018, twist: 0, reach: 0.01, handLift: 0, crouch: 0.006 },
  ],
  summon: [
    { lean: -0.012, arm: 0.045, twist: -0.008, reach: 0, handLift: 0.085, crouch: 0.008 },
    { lean: 0.02, arm: 0.095, twist: 0.008, reach: 0.025, handLift: 0.06, crouch: 0 },
    { lean: 0.006, arm: 0.025, twist: 0.002, reach: 0.008, handLift: 0.018, crouch: 0 },
  ],
};
const ease = (n: number) => {
  const p = Math.max(0, Math.min(1, n));
  return p * p * (3 - 2 * p);
};
const neutral: Track = { lean: 0, arm: 0, twist: 0, reach: 0, handLift: 0, crouch: 0 };
const blend = (a: Track, b: Track, t: number): Track =>
  t === 0
    ? a
    : t === 1
      ? b
      : (Object.fromEntries(
          Object.keys(a).map((k) => [
            k,
            a[k as keyof Track] + (b[k as keyof Track] - a[k as keyof Track]) * t,
          ]),
        ) as Track);

/** Presentation only. No simulation state, movement, HP or timers are mutated. */
export function sampleHostileRig(
  enemy: Enemy,
  action: MotionAction,
  progress: number,
  gait: number,
  time: number,
  reduced = false,
): RigPose {
  let p = Math.max(0, Math.min(1, progress));
  const profile = enemyAttack(enemy);
  if (action === 'strike' && profile.melee) {
    // Match the visual contact to each saved combat contact, including slow slams.
    const spec = profile.melee,
      elapsed = p * spec.duration;
    const found = spec.contacts.findIndex(
      (contact, i) =>
        elapsed <
        (spec.contacts[i + 1] === undefined ? spec.duration : spec.contacts[i + 1] - 0.12),
    );
    const index = found < 0 ? spec.contacts.length - 1 : found;
    const start = index === 0 ? 0 : spec.contacts[index] - 0.12;
    const end =
      spec.contacts[index + 1] === undefined ? spec.duration : spec.contacts[index + 1] - 0.12;
    const contact = spec.contacts[index];
    p =
      elapsed <= contact
        ? 0.24 * Math.max(0, (elapsed - start) / (contact - start))
        : 0.24 + 0.76 * Math.min(1, (elapsed - contact) / (end - contact));
  }
  const pose = sampleRig(action, p, gait, time, reduced);
  if (action === 'hurt') {
    const reaction = reduced ? 0.55 : Math.sin(p * Math.PI);
    pose.lean = -0.07 * reaction;
    pose.arm = -0.025 * reaction;
    pose.handLift = -0.018 * reaction;
    pose.crouch = 0.025 * reaction;
    pose.twist = 0.025 * reaction;
    return pose;
  }
  if (!['windup', 'strike', 'recover'].includes(action)) return pose;
  const [ready, contact, finish] = tracks[hostileMotion(enemy)];
  // Finish drawing back before the shared aim-lock deadline; hold the stance
  // through that deadline rather than snapping a weak pose at release time.
  const windup = enemyAttack(enemy).windup;
  const lock = Math.min(0.4, windup * 0.45);
  const readyProgress = Math.min(1, p / (1 - lock / windup));
  const track = reduced
    ? action === 'windup'
      ? ready
      : action === 'strike'
        ? contact
        : finish
    : action === 'windup'
      ? blend(neutral, ready, ease(readyProgress))
      : action === 'strike'
        ? p < 0.24
          ? blend(ready, contact, ease(p / 0.24))
          : blend(contact, finish, ease((p - 0.24) / 0.76))
        : blend(finish, neutral, ease(p));
  return { ...pose, ...track };
}
