import ledger from '../platform/hero-weapon-poses.json';
import type { WeaponStyle } from '../domain/model';

export type HeroWeaponPose = {
  hand: [number, number];
  angle: number;
  lengthScale: number;
  layer: number;
  row: number;
  view: number;
  flip: boolean;
  key: string;
  opacity: number;
  spread: number;
};
export const HERO_ATTACK_EXPOSURES = ledger.times;
export function heroAttackExposure(elapsed: number) {
  let key = 0;
  for (let i = 1; i < ledger.times.length; i++) if (elapsed + 1e-8 >= ledger.times[i]) key = i;
  return key;
}
/** Exact recorded placements. Missing data is an authoring error, never a
 * request to fall back to aim-based angle/projection/hand detection. */
export function heroWeaponPose(
  appearance: number,
  style: WeaponStyle,
  direction: number,
  kind: 'direction' | 'actions' | 'attack',
  frame = 0,
): HeroWeaponPose {
  const character = ledger.characters[appearance];
  const poses = character?.[style];
  const entry =
    kind === 'direction' ? poses?.direction[direction] : poses?.[kind][frame]?.[direction];
  if (!entry)
    throw new Error(
      `Missing authored weapon pose: ${appearance}/${style}/${kind}/${frame}/${direction}`,
    );
  return {
    hand: [entry[0], entry[1]],
    angle: (entry[2] * Math.PI) / 180,
    lengthScale: entry[3],
    layer: entry[4],
    row: entry[5],
    view: entry[6],
    flip: !!entry[7],
    key: `${appearance}/${style}/${kind}/${frame}/${direction}`,
    opacity: entry[8],
    spread: entry[9],
  };
}

/** The smear joins the two deliberately drawn blade orientations. It never
 * invents a yaw trajectory or compresses the blade to fake perspective. */
export function authoredBladeRibbon(
  previous: HeroWeaponPose,
  current: HeroWeaponPose,
  wrist: { x: number; y: number },
  radius: number,
  rotation: number,
) {
  let delta = current.angle - previous.angle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const point = (t: number, r: number) => ({
    x: wrist.x + Math.cos(previous.angle + delta * t + rotation) * r,
    y: wrist.y + Math.sin(previous.angle + delta * t + rotation) * r,
  });
  return Array.from({ length: 6 }, (_, i) => ({
    points: [
      point(i / 6, radius),
      point((i + 1) / 6, radius),
      point((i + 1) / 6, radius * 0.76),
      point(i / 6, radius * 0.76),
    ],
    alpha: 0.13 + i * 0.055,
  }));
}
