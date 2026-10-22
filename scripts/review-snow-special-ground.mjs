import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { nativeSourceCell } from './native-source-cell.mjs';
import { figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/snow-special-v1';
const art = JSON.parse(await readFile('src/game/snow-special-frames.json'));
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`));
const anchors = JSON.parse(await readFile(`${root}/ground-anchors.json`));
const decoded = new Map();
const proposed = {},
  report = [];
await mkdir(`${root}/ground-review`, { recursive: true });
for (const job of jobs) {
  const a = art.characters.find((a) => a.id === job.character);
  const layers = [],
    labels = [];
  proposed[job.id] = [];
  for (let p = 0; p < 12; p++) {
    const f = a.frames.find((f) => f.texture.endsWith(job.id) && f.sourcePose === p);
    if (!decoded.has(f.source))
      decoded.set(
        f.source,
        await sharp(`${root}/${f.source}`)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true }),
      );
    const source = decoded.get(f.source);
    const { data, info } = source;
    source.extract ??= figureExtractor(data, info.width, info.height);
    const members = new Set(
      source.extract(nativeSourceCell(f.sourceCell, info.width, info.height)).members,
    );
    const b = f.sourceBounds;
    const { left: sourceCellX, top: sourceCellY } = nativeSourceCell(
      f.sourceCell,
      info.width,
      info.height,
    );
    const [ax, ay] = anchors[job.id][p];
    const x = ax + sourceCellX,
      bottom = ay + sourceCellY;
    proposed[job.id][p] = [ax, ay];
    const left = (p % 4) * 400,
      top = Math.floor(p / 4) * 320;
    // Use the game's selected pixels; a source bounding box may contain pieces
    // of neighbouring actors that are excluded from the selected figure.
    const crop = await sharp(`public/art/snow-special-v1/${job.id}.webp`)
      .extract({
        left: f.x + f.bounds.left,
        top: f.y + f.bounds.top,
        width: b.right - b.left,
        height: b.bottom - b.top,
      })
      .resize({ width: Math.round((b.right - b.left) * 0.5) })
      .png()
      .toBuffer();
    layers.push({ input: crop, left: left + 20, top: top + 25 });
    labels.push(
      `<text x="${left + 12}" y="${top + 18}" font-size="14">${job.moves[Math.floor(p / 6)]} / ${p % 6}</text><path d="M${left + 20 + (x - b.left) * 0.5 - 6},${top + 25 + (bottom - b.top) * 0.5}h12m-6,-6v12" stroke="red" stroke-width="2"/>`,
    );
    report.push({
      job: job.id,
      pose: p,
      previous: anchors[job.id][p],
      proposed: proposed[job.id][p],
      groundFromSavedCoordinate: true,
    });
  }
  layers.push({
    input: Buffer.from(
      `<svg width="1600" height="960" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`,
    ),
    left: 0,
    top: 0,
  });
  await sharp({ create: { width: 1600, height: 960, channels: 4, background: '#eee5d1' } })
    .composite(layers)
    .png()
    .toFile(`${root}/ground-review/${job.id}.png`);
}
await writeFile(`${root}/ground-proposals.json`, JSON.stringify(proposed, null, 2) + '\n');
await writeFile(`${root}/ground-review.json`, JSON.stringify(report, null, 2) + '\n');
if (process.argv.includes('--apply'))
  await writeFile(`${root}/ground-anchors.json`, JSON.stringify(proposed, null, 2) + '\n');
console.log(
  JSON.stringify({
    reviewSheets: jobs.length,
    poses: report.length,
    applied: process.argv.includes('--apply'),
  }),
);
