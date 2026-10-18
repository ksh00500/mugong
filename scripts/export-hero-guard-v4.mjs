// Asset export only; all artwork was made with the built-in imagegen tool.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const { data, info } = await sharp('docs/source/hero-weapon-v4/guard-6.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const figures = motionLayout(data, info.width, info.height, 1, 5).map(
  figureExtractor(data, info.width, info.height),
);
// Source pixel measurements, individually placed over the five empty grips.
const points = [
  [118, 450],
  [579, 454],
  [1023, 460],
  [1262, 441],
  [1918, 490],
];
const hands = figures.map((f, i) => [
  (points[i][0] - f.left) / (f.right - f.left),
  (points[i][1] - f.top) / (f.bottom - f.top),
]);
if (hands.some((p) => p.some((n) => n <= 0 || n >= 1)))
  throw new Error('Guard hand outside source');
await mkdir('public/art/hero-weapon-v4', { recursive: true });
await sharp('docs/source/hero-weapon-v4/guard-6.png')
  .webp({ lossless: true })
  .toFile('public/art/hero-weapon-v4/guard-6.webp');
// A new source requires its own scale calibration; keep the original sheets.
// The lavender roster and its slash drawings use the same .34 reference.
// Changing this convention for the guard would shrink it on every recovery.
const units = Object.fromEntries(figures.map((f, i) => [`0-${i}`, (f.bottom - f.top) * 0.34]));
await writeFile(
  'src/platform/hero-guard-calibration.json',
  JSON.stringify(
    {
      hands,
      flips: [false, false, false, true, false],
      landmarks: {
        '/art/hero-weapon-v4/guard-6.webp': { width: info.width, height: info.height, units },
      },
      sourceBounds: figures.map((f) => [f.left, f.top, f.right, f.bottom]),
      sourceHands: points,
    },
    null,
    2,
  ),
);
console.log({ width: info.width, height: info.height, hands });
