import type { MotionAction, RigPose } from './directional-motion';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export type BladeProjection = { x: number; y: number; angle: number; lengthScale: number };

/** A yawing blade in a shallow horizontal plane, with a raised preparation.
 * Screen-space rotation alone made north-facing attacks start below the wrist
 * and lift upwards. Pitch is independent of aim, so ALL preparations are high.
 * Aim at contact stays authoritative; foreshortening is visual only.
 */
export function bladeProjection(
  facing: number,
  action: MotionAction,
  progress: number,
): BladeProjection {
  const p = clamp(progress);
  const sign = Math.cos(facing) < -1e-6 ? -1 : 1;
  const idle = { x: sign * 0.15, y: Math.sqrt(1 - 0.15 * 0.15) };
  // Align the projected contact with the screen-space aim. Its LENGTH still
  // shortens when the blade points into/out of the picture.
  const correction = facing - Math.atan2(0.38 * Math.sin(facing), Math.cos(facing));
  const project = (yaw: number, pitch: number) => {
    const theta = facing + yaw;
    const groundX = Math.cos(theta) * Math.cos(pitch);
    const groundY = 0.38 * Math.sin(theta) * Math.cos(pitch);
    return {
      x: groundX * Math.cos(correction) - groundY * Math.sin(correction),
      y: groundX * Math.sin(correction) + groundY * Math.cos(correction) - Math.sin(pitch),
    };
  };
  // A fixed follow-through pitch still pointed UP for south/diagonal views.
  // Aim-dependent lowering puts the finishing tip below the wrist everywhere.
  const finishGround = project(sign * 2.6, 0);
  const finishPitch = -Math.atan(Math.max(0, -finishGround.y) + 0.14);
  let vector = idle;
  if (action === 'windup') vector = project(-sign * (1.9 + 0.06 * (1 - smooth(p))), 1.1);
  if (action === 'strike') {
    if (p <= 0.5) {
      const drive = (p * 2) ** 2;
      vector = project(-sign * 1.9 * (1 - drive), 1.1 * (1 - drive));
    } else {
      const follow = 1 - (1 - (p - 0.5) * 2) ** 2;
      vector = project(sign * 2.6 * follow, finishPitch * follow);
    }
  }
  if (action === 'recover') {
    const finish = project(sign * 2.6, finishPitch);
    const settle = smooth(p);
    // Lower directly to the low guard. Never rotate backwards through a fresh
    // upward slash while returning to idle.
    vector = {
      x: finish.x + (idle.x - finish.x) * settle,
      y: finish.y + (idle.y - finish.y) * settle,
    };
  }
  const magnitude = Math.hypot(vector.x, vector.y);
  const lengthScale = Math.max(0.18, Math.min(1, magnitude));
  const angle = Math.atan2(vector.y, vector.x);
  return { x: Math.cos(angle) * lengthScale, y: Math.sin(angle) * lengthScale, angle, lengthScale };
}

/** Small chest/weight turn on top of the authored stance; no whole-body growth.
 * The fist lowers through the cut and the wrist still comes from the actual mesh.
 */
export function bladeTorsoRig(action: MotionAction, progress: number): Partial<RigPose> {
  const p = clamp(progress);
  if (action === 'windup')
    return { twist: -0.018 * smooth(p), lean: -0.014 * smooth(p), crouch: 0, handLift: 0 };
  if (action === 'strike') {
    const crossing = smooth(p);
    return {
      twist: -0.018 + 0.042 * crossing,
      lean: -0.014 + 0.034 * Math.sin(p * Math.PI),
      crouch: 0.016 * Math.sin(p * Math.PI),
      handLift: -0.014 * Math.sin(p * Math.PI),
    };
  }
  if (action === 'recover') {
    const settle = 1 - smooth(p);
    return { twist: 0.024 * settle, lean: -0.014 * settle, crouch: 0, handLift: 0 };
  }
  return {};
}
