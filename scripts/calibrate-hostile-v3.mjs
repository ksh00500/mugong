import { createRequire } from 'node:module';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH);
// Authored skull-span fractions on the source contact plates. Exclude buns,
// trailing hair, crowns and beards; prone poses measure the same skull.
const reviewed = [
  [
    [0.3, 0.3, 0.29, 0.3, 0.3],
    [0.29, 0.29, 0.28, 0.29, 0.29],
    [0.27, 0.27, 0.26, 0.27, 0.27],
    [0.27, 0.27, 0.27, 0.27, 0.27],
    [0.26, 0.27, 0.28, 0.27, 0.27],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.29, 0.3, 0.29, 0.29, 0.29],
  ],
  [
    [0.3, 0.3, 0.29, 0.3, 0.3],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.26, 0.26, 0.26, 0.26, 0.26],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.26, 0.26, 0.26, 0.26, 0.26],
  ],
  [
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.27, 0.28, 0.28, 0.28, 0.28],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.33, 0.33, 0.33, 0.33, 0.33],
    [0.23, 0.23, 0.23, 0.23, 0.23],
  ],
  [
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.32, 0.32, 0.32, 0.32, 0.32],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.28, 0.28, 0.28, 0.28, 0.28],
  ],
  [
    [0.28, 0.31, 0.3, 0.3, 0.28],
    [0.27, 0.28, 0.28, 0.28, 0.28],
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.26, 0.28, 0.28, 0.28, 0.26],
    [0.24, 0.24, 0.24, 0.24, 0.24],
    [0.24, 0.24, 0.24, 0.24, 0.24],
    [0.23, 0.23, 0.23, 0.23, 0.23],
  ],
  [
    [0.32, 0.32, 0.32, 0.32, 0.32],
    [0.26, 0.26, 0.26, 0.26, 0.26],
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.26, 0.26, 0.26, 0.26, 0.26],
    [0.27, 0.27, 0.27, 0.27, 0.27],
    [0.25, 0.25, 0.25, 0.25, 0.25],
  ],
  [
    [0.31, 0.31, 0.31, 0.31, 0.31],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.3, 0.3, 0.3, 0.3, 0.3],
    [0.23, 0.23, 0.23, 0.23, 0.23],
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.27, 0.27, 0.27, 0.27, 0.27],
  ],
  [
    [0.32, 0.32, 0.32, 0.32, 0.32],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.3, 0.3, 0.3, 0.3, 0.3],
    [0.24, 0.24, 0.24, 0.24, 0.24],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25, 0.25],
  ],
  [
    [0.29, 0.29, 0.29, 0.29, 0.29],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.27, 0.27, 0.27, 0.27, 0.27],
    [0.26, 0.26, 0.26, 0.26, 0.26],
    [0.24, 0.24, 0.24, 0.24, 0.24],
  ],
  [
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.25, 0.25, 0.25, 0.25, 0.25],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.27, 0.27, 0.27, 0.27, 0.27],
    [0.28, 0.28, 0.28, 0.28, 0.28],
    [0.26, 0.26, 0.26, 0.26, 0.26],
    [0.25, 0.25, 0.25, 0.25, 0.25],
  ],
];
const actionRows = [
  [
    [0.31, 0.32, 0.3, 0.32, 0.36, 0.49],
    [0.31, 0.31, 0.31, 0.31, 0.33, 0.52],
    [0.27, 0.27, 0.29, 0.3, 0.29, 0.4],
    [0.3, 0.3, 0.24, 0.32, 0.37, 0.47],
    [0.32, 0.33, 0.33, 0.33, 0.32, 0.5],
    [0.32, 0.32, 0.33, 0.31, 0.32, 0.48],
    [0.32, 0.32, 0.32, 0.31, 0.33, 0.48],
  ],
  [
    [0.3, 0.3, 0.33, 0.3, 0.35, 0.44],
    [0.31, 0.31, 0.33, 0.31, 0.33, 0.48],
    [0.29, 0.29, 0.32, 0.29, 0.3, 0.45],
    [0.29, 0.29, 0.29, 0.29, 0.3, 0.5],
    [0.28, 0.28, 0.28, 0.31, 0.3, 0.48],
    [0.31, 0.31, 0.33, 0.31, 0.32, 0.46],
    [0.3, 0.3, 0.3, 0.33, 0.32, 0.46],
  ],
  [
    [0.34, 0.34, 0.29, 0.36, 0.34, 0.5],
    [0.34, 0.34, 0.34, 0.34, 0.31, 0.48],
    [0.34, 0.34, 0.3, 0.34, 0.34, 0.48],
    [0.33, 0.33, 0.32, 0.33, 0.31, 0.5],
    [0.32, 0.32, 0.28, 0.34, 0.33, 0.5],
    [0.34, 0.34, 0.36, 0.34, 0.34, 0.5],
    [0.26, 0.26, 0.26, 0.26, 0.26, 0.43],
  ],
  [
    [0.31, 0.31, 0.26, 0.31, 0.31, 0.43],
    [0.31, 0.31, 0.31, 0.31, 0.31, 0.43],
    [0.3, 0.3, 0.33, 0.33, 0.31, 0.4],
    [0.31, 0.31, 0.24, 0.31, 0.31, 0.43],
    [0.29, 0.29, 0.29, 0.29, 0.29, 0.43],
    [0.32, 0.32, 0.32, 0.31, 0.32, 0.45],
    [0.31, 0.31, 0.31, 0.31, 0.31, 0.45],
  ],
  [
    [0.25, 0.25, 0.25, 0.27, 0.31, 0.5],
    [0.25, 0.25, 0.27, 0.28, 0.29, 0.5],
    [0.27, 0.27, 0.26, 0.3, 0.32, 0.5],
    [0.24, 0.24, 0.25, 0.27, 0.28, 0.48],
    [0.22, 0.22, 0.22, 0.26, 0.28, 0.43],
    [0.24, 0.24, 0.24, 0.27, 0.3, 0.5],
    [0.22, 0.22, 0.25, 0.26, 0.26, 0.44],
  ],
  [
    [0.33, 0.33, 0.33, 0.35, 0.33, 0.46],
    [0.32, 0.32, 0.31, 0.32, 0.32, 0.48],
    [0.31, 0.31, 0.31, 0.31, 0.32, 0.48],
    [0.31, 0.31, 0.31, 0.31, 0.32, 0.48],
    [0.28, 0.28, 0.29, 0.3, 0.29, 0.48],
    [0.32, 0.32, 0.32, 0.33, 0.32, 0.48],
    [0.25, 0.25, 0.25, 0.27, 0.25, 0.4],
  ],
  [
    [0.32, 0.32, 0.29, 0.33, 0.32, 0.48],
    [0.28, 0.28, 0.28, 0.3, 0.28, 0.48],
    [0.3, 0.3, 0.3, 0.3, 0.3, 0.47],
    [0.3, 0.3, 0.27, 0.29, 0.31, 0.44],
    [0.23, 0.23, 0.22, 0.25, 0.25, 0.42],
    [0.3, 0.3, 0.27, 0.3, 0.3, 0.48],
    [0.31, 0.31, 0.28, 0.31, 0.32, 0.48],
  ],
  [
    [0.31, 0.32, 0.29, 0.32, 0.32, 0.46],
    [0.31, 0.31, 0.28, 0.32, 0.3, 0.48],
    [0.3, 0.3, 0.32, 0.32, 0.29, 0.44],
    [0.28, 0.28, 0.28, 0.29, 0.29, 0.43],
    [0.3, 0.3, 0.3, 0.32, 0.32, 0.43],
    [0.26, 0.26, 0.26, 0.27, 0.28, 0.43],
    [0.27, 0.27, 0.27, 0.27, 0.28, 0.44],
  ],
  [
    [0.31, 0.31, 0.3, 0.31, 0.31, 0.49],
    [0.27, 0.27, 0.3, 0.32, 0.31, 0.48],
    [0.28, 0.28, 0.28, 0.28, 0.3, 0.44],
    [0.3, 0.3, 0.29, 0.32, 0.33, 0.48],
    [0.28, 0.28, 0.28, 0.32, 0.3, 0.47],
    [0.27, 0.27, 0.3, 0.29, 0.28, 0.45],
    [0.26, 0.26, 0.26, 0.29, 0.28, 0.48],
  ],
  [
    [0.28, 0.28, 0.25, 0.28, 0.29, 0.42],
    [0.26, 0.26, 0.31, 0.29, 0.28, 0.47],
    [0.31, 0.31, 0.31, 0.32, 0.31, 0.45],
    [0.28, 0.28, 0.25, 0.3, 0.29, 0.45],
    [0.31, 0.31, 0.31, 0.32, 0.31, 0.45],
    [0.28, 0.28, 0.27, 0.29, 0.29, 0.45],
    [0.27, 0.27, 0.27, 0.27, 0.27, 0.44],
  ],
];
const plates = {};
async function plate(path, rows, cols, ratios) {
  const { data, info } = await sharp('public' + path)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const cells = motionLayout(data, info.width, info.height, rows, cols),
    extract = figureExtractor(data, info.width, info.height),
    units = {};
  for (let i = 0; i < cells.length; i++) {
    const f = extract(cells[i]);
    units[`${Math.floor(i / cols)}-${i % cols}`] =
      Math.round((f.bottom - f.top) * ratios[Math.floor(i / cols)][i % cols] * 100) / 100;
  }
  plates[path] = { width: info.width, height: info.height, units };
}
for (let r = 0; r < 10; r++) {
  await plate(`/art/hostile-consistency-v3/region-${r}-directions.webp`, 7, 5, reviewed[r]);
  const newPath = `/art/hostile-consistency-v3/region-${r}-actions.webp`;
  const present = await readdir('public/art/hostile-consistency-v3');
  await plate(
    present.includes(`region-${r}-actions.webp`)
      ? newPath
      : `/art/animation-rebuild-v2/region-${r}.webp`,
    7,
    6,
    actionRows[r],
  );
  if (present.includes(`region-${r}-rear.webp`))
    await plate(
      `/art/hostile-consistency-v3/region-${r}-rear.webp`,
      7,
      4,
      reviewed[r].map((row, i) => [
        row[3] * 1.16,
        row[3] *
          0.95 *
          (r === 4
            ? [1.15, 0.95, 1.48, 1.15, 1.48, 1.15, 1.3][i]
            : r === 2
              ? [1.35, 1.15, 1.15, 1.5, 1.6, 1.5, 1.3][i]
              : 1.15),
        row[4] * 1.16,
        row[4] * 0.95 * (r === 7 && i === 3 ? 1.25 : 1.13),
      ]),
    );
}
const files = await readdir('public/art/hostile-consistency-v3');
for (const [n, rows, ratio] of [
  ['roles', 4, 0.29],
  ['identity', 3, 0.27],
  ['cavalry', 1, 0.16],
]) {
  if (files.includes(`${n}-directions.webp`))
    await plate(
      `/art/hostile-consistency-v3/${n}-directions.webp`,
      rows,
      5,
      Array.from({ length: rows }, () => Array(5).fill(ratio)),
    );
  if (files.includes(`${n}-rear.webp`))
    await plate(
      `/art/hostile-consistency-v3/${n}-rear.webp`,
      rows,
      4,
      Array.from({ length: rows }, () => [ratio * 1.14, ratio * 1.08, ratio * 1.14, ratio * 1.08]),
    );
  await plate(
    `/art/animation-rebuild-v2/${n}.webp`,
    rows,
    6,
    Array.from({ length: rows }, () => [
      ratio * 1.15,
      ratio * 1.15,
      ratio * 1.1,
      ratio * 1.2,
      ratio * 1.25,
      Math.min(0.52, ratio * 1.75),
    ]),
  );
}
// The same size path also renders recruited heroes. Review their bald/head,
// hood/bun and prone skull proportions separately from the hostile sheets.
const heroHeads = [
  [0.32, 0.33, 0.36, 0.32, 0.34],
  [0.43, 0.34, 0.33, 0.34, 0.32],
];
for (let group = 0; group < 2; group++) {
  await plate(
    `/art/hero-roster-v1/directions-${group}.webp`,
    5,
    8,
    heroHeads[group].map((h) => Array(8).fill(h)),
  );
  await plate(
    `/art/hero-roster-v1/actions-${group}.webp`,
    5,
    6,
    heroHeads[group].map((h) => [h, h, h, h, h * 1.03, Math.min(0.78, h * 2.05)]),
  );
}
await plate(
  '/art/animation-rebuild-v2/hero.webp',
  5,
  8,
  Array.from({ length: 5 }, () => Array(8).fill(0.32)),
);
await plate('/art/animation-rebuild-v2/hero-reactions.webp', 2, 8, [
  Array(8).fill(0.34),
  Array(8).fill(0.65),
]);
await writeFile('src/platform/anatomical-landmarks.json', JSON.stringify(plates, null, 2) + '\n');
await writeFile(
  'docs/verification/hostile-consistency-v3/anatomical-calibration.json',
  JSON.stringify(
    {
      method:
        'Authored skull-span fractions from the source comparison plates; estimates refined by actual rendered contact plates, not silhouette mass or skin color.',
      reviewed,
      actionRows,
    },
    null,
    2,
  ),
);
console.log(Object.keys(plates).length + ' character plates calibrated');
