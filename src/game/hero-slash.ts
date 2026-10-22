import anchors from '../platform/hero-slash-anchors.json';
import type { MotionAction } from './directional-motion';

export const HERO_SLASH_VIEWS = [2, 1, 0, 1, 2, 3, 4, 3] as const;
export function heroSlashGrip(appearance: number, row: number, view: number): [number, number] {
  const point = anchors[appearance]?.hands[row * 5 + view];
  if (!point) throw new Error(`Unreviewed slash hand: ${appearance}/${row}/${view}`);
  return [point[0], point[1]];
}
export function heroSlashFlip(appearance: number, row: number, direction: number) {
  const left = direction === 3 || direction === 4 || direction === 5;
  return left !== !!anchors[appearance]?.flips[row * 5 + HERO_SLASH_VIEWS[direction]];
}
export function heroSlashRow(action: MotionAction, progress = 0.5, crossing = true) {
  // Keep the loaded shoulder until the blade actually starts crossing the body.
  return action === 'windup' || (action === 'strike' && progress < (crossing ? 0.18 : 0.3))
    ? 0
    : action === 'strike' && (!crossing || progress < 0.66)
      ? 1
      : 2;
}
