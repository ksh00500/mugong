import type { WeaponStyle } from '../domain/model';
import type { MotionAction } from './directional-motion';
import { bladeProjection } from './blade-motion';

/** Grip/axis in tightly cropped inventory art. Axis is its painted blade direction.
 * Special dart/gauntlet entries use the single-hand combat atlas instead.
 */
export const WEAPON_GRIPS: Readonly<Record<string, readonly [number, number]>> = {
  'weapon-sword-0': [0.5, 0.17],
  'weapon-sword-1': [0.5, 0.18],
  'weapon-sword-2': [0.5, 0.18],
  'weapon-dao-0': [0.5, 0.14],
  'weapon-dao-1': [0.5, 0.16],
  'weapon-dao-2': [0.5, 0.16],
  // A staff balances around the middle of its shaft, unlike a sword hilt.
  'weapon-staff-0': [0.5, 0.5],
  'weapon-staff-1': [0.5, 0.52],
  'weapon-staff-2': [0.5, 0.5],
  'weapon-fan-0': [0.5, 0.93],
  'weapon-fan-1': [0.49, 0.87],
  'weapon-fan-2': [0.49, 0.84],
  'boss-0-1': [0.5, 0.19],
  'boss-2-1': [0.5, 0.19],
  'boss-5-2': [0.5, 0.19],
  'boss-7-1': [0.37, 0.18],
  'boss-7-4': [0.52, 0.17],
  'boss-8-4': [0.48, 0.17],
  'boss-9-4': [0.51, 0.77],
};
export const SINGLE_WEAPON_FRAMES: Readonly<
  Record<string, { texture: string; frame: string; grip: readonly [number, number] }>
> = {
  'weapon-dart-0': { texture: 'held-darts-isolated', frame: '0-0', grip: [0.5, 0.33] },
  'weapon-dart-1': { texture: 'held-darts-isolated', frame: '0-1', grip: [0.5, 0.29] },
  'weapon-dart-2': { texture: 'held-darts-isolated', frame: '0-2', grip: [0.5, 0.43] },
  'boss-1-2': { texture: 'held-darts-isolated', frame: '0-3', grip: [0.5, 0.29] },
  'weapon-gauntlet-0': { texture: 'held-gauntlets-isolated', frame: '0-0', grip: [0.5, 0.66] },
  'weapon-gauntlet-1': { texture: 'held-gauntlets-isolated', frame: '0-1', grip: [0.5, 0.66] },
  'weapon-gauntlet-2': { texture: 'held-gauntlets-isolated', frame: '0-2', grip: [0.5, 0.66] },
  'boss-4-1': { texture: 'held-gauntlets-isolated', frame: '0-3', grip: [0.5, 0.66] },
  'boss-4-4': { texture: 'held-gauntlets-isolated', frame: '0-4', grip: [0.5, 0.66] },
};

/** Weapon arcs use the same attack phase as the body, never sheet row changes.
 * Blades load into an authored preparation key pose at attack start.
 * Return a world blade/knuckle direction; body rotation is added by the caller.
 */
export function weaponAngle(
  style: WeaponStyle,
  facing: number,
  action: MotionAction,
  progress: number,
) {
  const p = Math.max(0, Math.min(1, progress)),
    smooth = p * p * (3 - 2 * p);
  const sign = Math.cos(facing) >= 0 ? 1 : -1;
  const resting = Math.PI / 2 - sign * 0.15;
  const near = (angle: number, reference: number) =>
    reference + Math.atan2(Math.sin(angle - reference), Math.cos(angle - reference));
  if (style === 'sword' || style === 'dao') {
    if (action === 'windup' || action === 'strike' || action === 'recover')
      return bladeProjection(facing, action, p).angle;
    if (action === 'idle' || action === 'walk' || action === 'hurt' || action === 'death')
      return bladeProjection(facing, 'idle', 0).angle;
  }
  // A cut crosses the target midway through the stroke, not after damage has
  // already happened. Throwing/punching use a restrained aim-centred motion.
  const arc =
    style === 'dart'
      ? 0.12
      : style === 'gauntlet'
        ? 0.16
        : style === 'staff'
          ? 0.85
          : style === 'fan'
            ? 0.7
            : 1.12;
  const ready = facing - sign * arc;
  if (action === 'windup') return resting + (near(ready, resting) - resting) * smooth;
  if (action === 'strike') return ready + sign * arc * 2 * smooth;
  if (action === 'recover') {
    const end = ready + sign * arc * 2;
    return end + (near(resting, end) - end) * smooth;
  }
  if (action === 'ultimate') return facing - sign * 1.25 + sign * 2.5 * smooth;
  if (action === 'defense') return facing - sign * 0.85;
  return resting;
}
