/** Reviewed on the tight, isolated hero-roster-v1 frames (not the nominal sheet cells).
 * Each entry is a wrist/hand centre in source UV coordinates, before mirroring.
 * D0..7: source views; A0..5: walk, walk, preparation, contact, hurt, death.
 * Rear-view wrists hidden by a sleeve/hair stay behind the body. Do not infer
 * these points from aim, an alpha bounding box, or a different character's pose.
 */
export type HandPoint = readonly [number, number];
export const HERO_GRIPS: readonly {
  directions: readonly HandPoint[];
  actions: readonly HandPoint[];
}[] = [
  {
    directions: [
      [0.12, 0.78],
      [0.13, 0.78],
      [0.09, 0.79],
      [0.49, 0.79],
      [0.07, 0.75],
      [0.86, 0.76],
      [0.76, 0.8],
      [0.43, 0.8],
    ],
    actions: [
      [0.12, 0.77],
      [0.53, 0.79],
      [0.44, 0.55],
      [0.86, 0.71],
      [0.76, 0.74],
      [0.7, 0.8],
    ],
  },
  {
    directions: [
      [0.43, 0.79],
      [0.44, 0.79],
      [0.36, 0.78],
      [0.42, 0.79],
      [0.52, 0.79],
      [0.64, 0.76],
      [0.56, 0.8],
      [0.45, 0.79],
    ],
    actions: [
      [0.23, 0.78],
      [0.37, 0.78],
      [0.8, 0.6],
      [0.9, 0.53],
      [0.73, 0.67],
      [0.8, 0.77],
    ],
  },
  {
    directions: [
      [0.18, 0.77],
      [0.19, 0.77],
      [0.12, 0.77],
      [0.04, 0.77],
      [0.02, 0.77],
      [0.57, 0.77],
      [0.6, 0.8],
      [0.35, 0.77],
    ],
    actions: [
      [0.4, 0.71],
      [0.52, 0.73],
      [0.865, 0.51],
      [0.83, 0.515],
      [0.38, 0.6],
      [0.84, 0.73],
    ],
  },
  {
    directions: [
      [0.37, 0.8],
      [0.37, 0.82],
      [0.14, 0.81],
      [0.04, 0.8],
      [0.47, 0.8],
      [0.8, 0.82],
      [0.67, 0.83],
      [0.44, 0.8],
    ],
    actions: [
      [0.38, 0.72],
      [0.42, 0.77],
      [0.49, 0.51],
      [0.87, 0.625],
      [0.425, 0.69],
      [0.81, 0.8],
    ],
  },
  {
    directions: [
      [0.41, 0.8],
      [0.41, 0.8],
      [0.14, 0.8],
      [0.04, 0.8],
      [0.53, 0.8],
      [0.8, 0.82],
      [0.67, 0.83],
      [0.44, 0.8],
    ],
    actions: [
      [0.42, 0.78],
      [0.49, 0.77],
      [0.4, 0.55],
      [0.865, 0.6],
      [0.285, 0.67],
      [0.8, 0.8],
    ],
  },
  {
    directions: [
      [0.32, 0.79],
      [0.32, 0.79],
      [0.1, 0.8],
      [0.13, 0.79],
      [0.5, 0.74],
      [0.2, 0.79],
      [0.74, 0.8],
      [0.44, 0.8],
    ],
    actions: [
      [0.27, 0.74],
      [0.85, 0.65],
      [0.25, 0.3],
      [0.22, 0.455],
      [0.31, 0.6],
      [0.68, 0.78],
    ],
  },
  {
    directions: [
      [0.28, 0.74],
      [0.34, 0.73],
      [0.2, 0.68],
      [0.2, 0.72],
      [0.53, 0.73],
      [0.34, 0.8],
      [0.53, 0.85],
      [0.4, 0.7],
    ],
    actions: [
      [0.8, 0.66],
      [0.88, 0.62],
      [0.875, 0.56],
      [0.85, 0.615],
      [0.53, 0.75],
      [0.82, 0.8],
    ],
  },
  {
    directions: [
      [0.32, 0.82],
      [0.3, 0.82],
      [0.14, 0.82],
      [0.09, 0.82],
      [0.28, 0.8],
      [0.13, 0.8],
      [0.64, 0.8],
      [0.33, 0.82],
    ],
    actions: [
      [0.35, 0.79],
      [0.397, 0.77],
      [0.24, 0.345],
      [0.27, 0.54],
      [0.275, 0.7],
      [0.35, 0.8],
    ],
  },
  {
    directions: [
      [0.38, 0.82],
      [0.38, 0.82],
      [0.18, 0.82],
      [0.1, 0.83],
      [0.28, 0.8],
      [0.11, 0.79],
      [0.15, 0.82],
      [0.36, 0.82],
    ],
    actions: [
      [0.34, 0.77],
      [0.4, 0.77],
      [0.175, 0.375],
      [0.9, 0.615],
      [0.34, 0.595],
      [0.85, 0.75],
    ],
  },
  {
    directions: [
      [0.74, 0.7],
      [0.77, 0.7],
      [0.7, 0.72],
      [0.37, 0.71],
      [0.48, 0.68],
      [0.45, 0.72],
      [0.61, 0.85],
      [0.73, 0.74],
    ],
    actions: [
      [0.765, 0.685],
      [0.71, 0.64],
      [0.19, 0.275],
      [0.31, 0.59],
      [0.36, 0.7],
      [0.65, 0.8],
    ],
  },
];

export function heroGrip(appearance: number, view: number, pose: number | undefined): HandPoint {
  const grips = HERO_GRIPS[appearance];
  if (!grips) throw new Error(`Unreviewed hero appearance: ${appearance}`);
  return pose === undefined ? grips.directions[view] : grips.actions[pose];
}
