// Offline authoring tool. These are deliberately edited key poses, not runtime
// aim/projection curves. Expansion only copies reviewed source wrists and
// mirrored direction variants into an exhaustive, editable placement ledger.
import { readFile, writeFile } from 'node:fs/promises';
import { HERO_GRIPS } from '../src/game/hero-grips.ts';
import { heroDirection } from '../src/game/hero-directions.ts';
const slash = JSON.parse(await readFile('src/platform/hero-slash-anchors.json', 'utf8'));
const guard = JSON.parse(await readFile('src/platform/hero-guard-calibration.json', 'utf8'));
const styles = ['sword', 'dao', 'staff', 'fan', 'dart', 'gauntlet'];
const views = [2, 1, 0, 1, 2, 3, 4, 3];
// Eight timed exposures: load, anticipation, smear, contact, contact hold,
// follow-through, settle, resting guard. Angles use screen coordinates.
const times = [0, 0.025, 0.055, 0.085, 0.11, 0.16, 0.21, 0.255];
const rows = {
  sword: [0, 0, 1, 1, 1, 2, 2, -1],
  dao: [0, 0, 1, 1, 1, 2, 2, -1],
  staff: [0, 0, 1, 1, 1, 1, 0, -1],
  fan: [2, 0, 1, 1, 1, 2, 2, -1],
  dart: [0, 0, 1, 1, 1, 2, 0, -1],
  gauntlet: [0, 0, 1, 1, 1, 1, 0, -1],
};
const angles = {
  sword: [
    [-125, -145, -45, 0, 0, 40, 65, 55],
    [-95, -120, 0, 45, 45, 90, 110, 65],
    [-40, -65, 35, 90, 90, 135, 155, 100],
    [-85, -60, 180, 135, 135, 90, 70, 115],
    [-55, -35, 225, 180, 180, 140, 115, 125],
    [-20, -5, 275, 225, 225, 170, 145, 135],
    [-130, -150, -120, -90, -90, -35, -10, 110],
    [-160, -175, -95, -45, -45, 10, 35, 45],
  ],
  dao: [
    [-115, -135, -35, 0, 0, 50, 75, 60],
    [-90, -115, 5, 45, 45, 100, 120, 70],
    [-30, -55, 40, 90, 90, 145, 165, 100],
    [-90, -65, 175, 135, 135, 80, 60, 110],
    [-65, -45, 215, 180, 180, 130, 105, 120],
    [-30, -15, 270, 225, 225, 160, 135, 135],
    [-140, -160, -125, -90, -90, -30, -5, 110],
    [-150, -165, -90, -45, -45, 20, 45, 45],
  ],
  staff: [
    [-12, -18, -6, 0, 0, 8, 18, 55],
    [33, 27, 39, 45, 45, 53, 63, 65],
    [78, 72, 84, 90, 90, 98, 108, 100],
    [147, 153, 141, 135, 135, 127, 117, 115],
    [192, 198, 186, 180, 180, 172, 162, 125],
    [237, 243, 231, 225, 225, 217, 207, 135],
    [-102, -108, -96, -90, -90, -82, -72, 110],
    [-57, -63, -51, -45, -45, -37, -27, 45],
  ],
  fan: [
    [-65, -80, -25, 0, 0, 35, 55, 55],
    [-20, -35, 20, 45, 45, 80, 100, 65],
    [25, 10, 65, 90, 90, 125, 145, 100],
    [200, 215, 160, 135, 135, 100, 80, 115],
    [245, 260, 205, 180, 180, 145, 125, 125],
    [290, 305, 250, 225, 225, 190, 170, 135],
    [-155, -170, -115, -90, -90, -55, -35, 110],
    [-110, -125, -70, -45, -45, -10, 10, 45],
  ],
  dart: [
    [-25, -35, -10, 0, 0, 10, 20, 55],
    [20, 10, 35, 45, 45, 55, 65, 65],
    [65, 55, 80, 90, 90, 100, 110, 100],
    [160, 170, 145, 135, 135, 125, 115, 115],
    [205, 215, 190, 180, 180, 170, 160, 125],
    [250, 260, 235, 225, 225, 215, 205, 135],
    [-115, -125, -100, -90, -90, -80, -70, 110],
    [-70, -80, -55, -45, -45, -35, -25, 45],
  ],
  gauntlet: [
    [-15, -25, -5, 0, 0, 5, 15, 0],
    [30, 20, 40, 45, 45, 50, 60, 45],
    [75, 65, 85, 90, 90, 95, 105, 90],
    [150, 160, 140, 135, 135, 130, 120, 135],
    [195, 205, 185, 180, 180, 175, 165, 180],
    [240, 250, 230, 225, 225, 220, 210, 225],
    [-105, -115, -95, -90, -90, -85, -75, -90],
    [-60, -70, -50, -45, -45, -40, -30, -45],
  ],
};
const resting = {
  sword: [25, 40, 55, 140, 155, 155, 125, 25],
  dao: [30, 45, 60, 135, 150, 150, 120, 30],
  staff: [55, 65, 100, 115, 125, 135, 110, 45],
  fan: [55, 65, 100, 115, 125, 135, 110, 45],
  dart: [55, 65, 100, 115, 125, 135, 110, 45],
  gauntlet: [0, 45, 90, 135, 180, 225, -90, -45],
};
// Rear wrists are occluded; sword guards also sit underneath the sleeve in
// standing/settling frames, so they cannot float above the character's arm.
const layers = [1, 1, 1, 1, 1, -1, -1, -1];
const pose = (hand, angle, length, layer, row, view, flip, opacity = 1, spread = 1) => [
  ...hand.map((n) => +n.toFixed(6)),
  angle,
  length,
  layer,
  row,
  view,
  +flip,
  opacity,
  spread,
];
const characters = HERO_GRIPS.map((grips, appearance) =>
  Object.fromEntries(
    styles.map((style) => {
      const direction = Array.from({ length: 8 }, (_, dir) => {
        const d = heroDirection(appearance, dir);
        const repaired = appearance === 6 && dir !== 6;
        const guardView = views[dir],
          guardFlip = [3, 4, 5].includes(dir) !== guard.flips[guardView];
        return pose(
          repaired ? guard.hands[guardView] : grips.directions[d.view],
          resting[style][dir],
          1,
          repaired && dir < 5 ? 1 : style === 'gauntlet' ? layers[dir] : -1,
          -1,
          repaired ? guardView : d.view,
          repaired ? guardFlip : d.flip,
        );
      });
      const actions = grips.actions.map((hand, row) =>
        Array.from({ length: 8 }, (_, dir) =>
          pose(
            hand,
            angles[style][dir][row === 2 ? 1 : row === 3 ? 3 : 7],
            1,
            layers[dir],
            row,
            -1,
            [3, 4, 5].includes(dir),
          ),
        ),
      );
      const attack = times.map((_, key) =>
        Array.from({ length: 8 }, (_, dir) => {
          if (rows[style][key] < 0) return direction[dir];
          const row = rows[style][key],
            view = views[dir],
            flip = [3, 4, 5].includes(dir) !== !!slash[appearance].flips[row * 5 + view];
          // Full blade length throughout the cut: no automatic foreshortening.
          return pose(
            slash[appearance].hands[row * 5 + view],
            angles[style][dir][key],
            1,
            key <= 4 ? 1 : layers[dir],
            row,
            view,
            flip,
            style === 'dart' && key >= 4 && key <= 5 ? 0 : 1,
            style === 'fan' && key <= 1 ? 0.55 : 1,
          );
        }),
      );
      return [style, { direction, actions, attack }];
    }),
  ),
);
await writeFile(
  'src/platform/hero-weapon-poses.json',
  JSON.stringify({
    version: 4,
    times,
    fields: [
      'handX',
      'handY',
      'angleDegrees',
      'lengthScale',
      'layer',
      'row',
      'view',
      'flip',
      'opacity',
      'spread',
    ],
    characters,
  }),
);
console.log(
  `Wrote ${10 * 6 * (8 + 6 * 8 + 8 * 8)} explicit weapon placements (8 timed attack exposures, 3 distinct attack drawings).`,
);
