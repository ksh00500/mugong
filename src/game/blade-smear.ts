import type { MotionAction } from './directional-motion';
import type { WeaponStyle } from '../domain/model';
import { bladeProjection } from './blade-motion';

type Point = { x: number; y: number };
export type BladeRibbon = { points: Point[]; alpha: number };
/** Short local blade smear. This is blade length, never attack/hitbox range.
 * Samples the cut curve at the current rendered wrist; it is not past world position.
 */
export function bladeSmear(
  style: WeaponStyle,
  facing: number,
  action: MotionAction,
  progress: number,
  hand: Point,
  length: number,
  bodyTurn: number,
  reduced = false,
): BladeRibbon[] {
  if (reduced || (style !== 'sword' && style !== 'dao')) return [];
  if (action !== 'strike') return [];
  const end = Math.max(0, Math.min(1, progress));
  const start = Math.max(0, end - 0.34);
  if (end - start < 0.01) return [];
  const point = (p: number, radius: number) => {
    const blade = bladeProjection(facing, 'strike', p);
    const c = Math.cos(bodyTurn),
      s = Math.sin(bodyTurn);
    return {
      x: hand.x + (blade.x * c - blade.y * s) * radius,
      y: hand.y + (blade.x * s + blade.y * c) * radius,
    };
  };
  return Array.from({ length: 6 }, (_, i) => {
    const a = start + ((end - start) * i) / 6;
    const b = start + ((end - start) * (i + 1)) / 6;
    const thickness = 0.1 + (0.18 * (i + 1)) / 6;
    return {
      points: [
        point(a, length),
        point(b, length),
        point(b, length * (1 - thickness)),
        point(a, length * (1 - thickness)),
      ],
      alpha: (0.12 + i * 0.065) * Math.sin(end * Math.PI),
    };
  });
}
