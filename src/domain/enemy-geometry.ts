import { FIELD } from './content';
import type { Enemy } from './model';

/** Keep one shot on the aimed line; alternate the unmatched edge of even volleys. */
export function fanOffset(index: number, count: number, spread: number, pattern: number) {
  if (count % 2) return (index - (count - 1) / 2) * spread;
  const offset = index === 0 ? 0 : Math.ceil(index / 2) * (index % 2 ? 1 : -1);
  return offset * spread * (pattern % 2 ? -1 : 1);
}

/** Locked world-space endpoint, shared by the warning and the moving strike. */
export function dashOrigin(e: Enemy, maximum: number) {
  if (e.strike) return { x: e.strike.toX, y: e.strike.toY };
  let reach = maximum;
  if (maximum && e.targetX !== undefined && e.targetY !== undefined && e.role) {
    const projected = (e.targetX - e.x) * Math.cos(e.aim) + (e.targetY - e.y) * Math.sin(e.aim);
    // Riders pass the target; assassins stop just beyond it rather than teleporting far past it.
    reach = Math.max(0, Math.min(maximum, projected + (e.role === 'rider' ? 60 : 25)));
  }
  return {
    x: Math.max(FIELD.left, Math.min(FIELD.right, e.x + Math.cos(e.aim) * reach)),
    y: Math.max(FIELD.top, Math.min(FIELD.bottom, e.y + Math.sin(e.aim) * reach)),
  };
}

export function segmentDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
  target: { x: number; y: number },
) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    length = dx * dx + dy * dy;
  const t = length
    ? Math.max(0, Math.min(1, ((target.x - from.x) * dx + (target.y - from.y) * dy) / length))
    : 0;
  return Math.hypot(target.x - from.x - dx * t, target.y - from.y - dy * t);
}
