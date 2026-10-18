import { createRequire } from 'node:module';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
import { faceUnit, silhouetteUnit } from '../src/game/pose-calibration.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const out = 'docs/verification/hostile-consistency-v3';
await mkdir(out, { recursive: true });
const reports = [];
for (let region = 0; region < 10; region++) {
  const inputs = [
    [`public/art/hostile-consistency-v3/region-${region}-directions.webp`, 5],
    [
      [1, 9].includes(region)
        ? `public/art/hostile-consistency-v3/region-${region}-actions.webp`
        : `public/art/animation-rebuild-v2/region-${region}.webp`,
      6,
    ],
    [`public/art/hostile-consistency-v3/region-${region}-rear.webp`, 4],
  ];
  const frames = [];
  const composites = [];
  for (const [path, cols] of inputs) {
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const extract = figureExtractor(data, info.width, info.height);
    const cells = motionLayout(data, info.width, info.height, 7, cols);
    for (let i = 0; i < cells.length; i++) {
      const f = extract(cells[i]),
        row = Math.floor(i / cols),
        col = i % cols;
      const w = f.right - f.left,
        h = f.bottom - f.top;
      const buffer = await sharp(path)
        .extract({ left: f.left, top: f.top, width: w, height: h })
        .resize(150, 180, { fit: 'inside' })
        .png()
        .toBuffer();
      const meta = await sharp(buffer).metadata();
      const x = (cols === 5 ? col : cols === 6 ? 5 + col : 11 + col) * 170,
        y = row * 225;
      composites.push({
        input: buffer,
        left: x + Math.round((170 - meta.width) / 2),
        top: y + 32 + 180 - meta.height,
      });
      const face = faceUnit(data, info.width, f),
        mass = silhouetteUnit(data, info.width, f);
      const label = `${cols === 5 ? 'D' : cols === 6 ? 'A' : 'R'}${col} h${h} f${face.toFixed(1)} m${mass.toFixed(1)}`;
      composites.push({
        input: Buffer.from(
          `<svg width="170" height="25"><text x="3" y="19" font-size="13" fill="#fff">${label}</text></svg>`,
        ),
        left: x,
        top: y,
      });
      frames.push({
        path,
        row,
        col,
        width: w,
        height: h,
        face,
        mass,
        bounds: [f.left, f.top, f.right, f.bottom],
        component: f.id,
      });
    }
  }
  await sharp({ create: { width: 2550, height: 1575, channels: 4, background: '#364038' } })
    .composite(composites)
    .png()
    .toFile(`${out}/region-${region}-sources.png`);
  reports.push({ region, frames });
}
await writeFile(`${out}/source-metrics.json`, JSON.stringify(reports, null, 2));
console.log(
  JSON.stringify({ regions: reports.length, frames: reports.flatMap((r) => r.frames).length }),
);
