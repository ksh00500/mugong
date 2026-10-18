/** Render-only animation. These tracks never apply movement, damage or cooldowns. */
export type MotionAction =
  'idle' | 'walk' | 'windup' | 'strike' | 'recover' | 'ultimate' | 'defense' | 'hurt' | 'death';
export type RigPose = {
  stride: number;
  lift: number;
  lean: number;
  arm: number;
  twist: number;
  breath: number;
  collapse: number;
  reach: number;
  handLift: number;
  crouch: number;
};
export const MOTION_DIRECTIONS = [
  { view: 2, flip: false }, // east
  { view: 1, flip: false },
  { view: 0, flip: false },
  { view: 1, flip: true },
  { view: 2, flip: true },
  { view: 3, flip: true },
  { view: 4, flip: false },
  { view: 3, flip: false },
] as const;
export function directionIndex(angle: number, previous?: number) {
  const normalized = (((angle / (Math.PI / 4)) % 8) + 8) % 8;
  if (previous !== undefined) {
    const difference = ((normalized - previous + 12) % 8) - 4;
    // A small dead band avoids rapidly flipping around one sector boundary.
    if (Math.abs(difference) < 0.58) return previous;
  }
  return Math.round(normalized) % 8;
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export function sampleRig(
  action: MotionAction,
  progress: number,
  gait: number,
  time: number,
  reduced = false,
): RigPose {
  const p = clamp(progress),
    pose: RigPose = { stride: 0, lift: 0, lean: 0, arm: 0, twist: 0, breath: 0, collapse: 0, reach: 0, handLift: 0, crouch: 0 };
  if (reduced) {
    if (action === 'death') pose.collapse = 1;
    return pose;
  }
  const pulse = Math.sin(p * Math.PI);
  switch (action) {
    case 'idle':
      pose.breath = Math.sin(time * 2.5) * 0.004;
      break;
    case 'walk': {
      const step = Math.sin(gait * Math.PI * 2);
      pose.stride = step * 0.045;
      pose.lift = Math.abs(step) * 0.018;
      pose.arm = -step * 0.035;
      pose.twist = step * 0.014;
      pose.breath = -Math.abs(step) * 0.008;
      break;
    }
    case 'windup':
      pose.lean = -smooth(p) * 0.025;
      pose.arm = -smooth(p) * 0.095;
      pose.twist = -smooth(p) * 0.018;
      break;
    case 'strike': {
      // Start from the anticipation endpoint, sweep quickly, then settle into
      // recovery. No discontinuous pose jump at either simulation boundary.
      const sweep = smooth(p / 0.18),
        settle = smooth((p - 0.18) / 0.82);
      pose.lean = -0.025 + sweep * 0.065 - settle * 0.028;
      pose.arm = -0.095 + sweep * 0.215 - settle * 0.092;
      pose.twist = -0.018 + sweep * 0.046 - settle * 0.02;
      break;
    }
    case 'recover':
      pose.lean = (1 - smooth(p)) * 0.012;
      pose.arm = (1 - smooth(p)) * 0.028;
      pose.twist = (1 - smooth(p)) * 0.008;
      break;
    case 'ultimate':
      pose.arm = pulse * 0.13;
      pose.twist = pulse * 0.035;
      pose.lean = pulse * 0.025;
      break;
    case 'defense':
      pose.lean = -pulse * 0.018;
      pose.arm = -pulse * 0.065;
      pose.breath = pulse * 0.02;
      break;
    case 'hurt':
      pose.lean = -pulse * 0.05;
      pose.arm = pulse * 0.028;
      break;
    case 'death':
      pose.collapse = smooth(p);
      break;
  }
  return pose;
}
/** Local weights bend torso, hands and feet separately; no whole-sprite scale wobble. */
export function rigPoint(x: number, y: number, pose: RigPose, direction: number) {
  const side = x < 0.5 ? -1 : 1;
  const upper = 1 - smooth((y - 0.16) / 0.52);
  const legs = smooth((y - 0.62) / 0.33);
  const arms =
    smooth((Math.abs(x - 0.5) - 0.16) / 0.24) *
    smooth((y - 0.16) / 0.16) *
    (1 - smooth((y - 0.58) / 0.15));
  const horizontal = Math.cos((direction * Math.PI) / 4);
  const vertical = Math.sin((direction * Math.PI) / 4);
  let dx = upper * pose.lean * horizontal + side * arms * pose.arm;
  let dy = -upper * pose.lean * vertical * 0.3 + upper * pose.breath;
  dx += side * legs * pose.stride * (0.55 + Math.abs(horizontal) * 0.45);
  dy -= legs * Math.max(0, side * pose.stride) * 0.35 + legs * pose.lift * 0.2;
  dx += pose.twist * Math.sin(y * Math.PI) * (1 - legs);
  dx += arms * (pose.reach ?? 0) * horizontal;
  dy += arms * (pose.reach ?? 0) * vertical * .4 - arms * (pose.handLift ?? 0);
  dy += (1 - legs) * (pose.crouch ?? 0);
  // Collapse about the feet rather than changing gameplay position or hitbox.
  const collapse = pose.collapse;
  return {
    x: x + dx + (1 - y) * collapse * (horizontal < 0 ? -0.48 : 0.48),
    y: y + dy + (1 - y) * collapse * 0.74,
  };
}
export class MotionClock {
  private records = new Map<
    string,
    { x: number; y: number; distance: number; direction: number; time: number }
  >();
  sample(id: string, x: number, y: number, angle: number, time: number, walking: boolean) {
    let record = this.records.get(id);
    if (!record) {
      record = { x, y, distance: 0, direction: directionIndex(angle), time };
      this.records.set(id, record);
    }
    if (time !== record.time) {
      const distance = Math.hypot(x - record.x, y - record.y);
      // Teleports, knockback and dash don't fast-forward a walk cycle.
      if (walking && distance < 50) {
        const forward = Math.cos(angle) * (x - record.x) + Math.sin(angle) * (y - record.y);
        record.distance += distance * (forward < -0.05 ? -1 : 1);
      }
      record.x = x;
      record.y = y;
      record.time = time;
      record.direction = directionIndex(angle, record.direction);
    }
    return { direction: record.direction, gait: (((record.distance / 84) % 1) + 1) % 1 };
  }
  delete(id: string) {
    this.records.delete(id);
  }
  reset() {
    this.records.clear();
  }
  moved(id: string, x: number, y: number) {
    const record = this.records.get(id);
    return !!record && Math.hypot(x - record.x, y - record.y) > 0.05;
  }
}

/** The lower half is a quadruped, not a human rig: front and rear hooves
 * alternate while the saddle stays stable. World movement still owns the feet. */
export function cavalryRigPoint(x: number, y: number, pose: RigPose, direction: number) {
  const legs = smooth((y - 0.64) / 0.32);
  const side = x < 0.5 ? -1 : 1;
  const horizontal = Math.abs(Math.cos((direction * Math.PI) / 4));
  const hoof = side * pose.stride;
  const rider = 1 - smooth((y - 0.25) / 0.36);
  return {
    x:
      x +
      legs * hoof * (0.5 + horizontal) +
      rider * pose.lean * Math.cos((direction * Math.PI) / 4) * 0.5 +
      rider * (x - 0.5) * pose.arm * 0.4,
    y:
      y -
      legs * Math.max(0, hoof) * 0.55 -
      (1 - legs) * pose.lift * 0.4 +
      rider * pose.breath +
      rider * (pose.crouch ?? 0) - rider * Math.abs(x - .5) * (pose.handLift ?? 0) +
      (1 - y) * pose.collapse * 0.7,
  };
}
