import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/dokmu-special-v1';
const art = JSON.parse(await readFile('src/game/dokmu-special-frames.json'));
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`));
const anchors = JSON.parse(await readFile(`${root}/ground-anchors.json`));
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
    const { data, info } = await sharp(`${root}/${f.source}`)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const b = f.sourceBounds,
      pixels = [];
    for (let y = Math.max(b.top, b.bottom - 85); y < b.bottom; y++)
      for (let x = b.left; x < b.right; x++) {
        const i = (y * info.width + x) * 4,
          [r, g, blue, alpha] = data.subarray(i, i + 4);
        if (alpha >= 230 && r < 115 && g < 90 && blue < 85 && r > g + 3 && g > blue + 3)
          pixels.push([x, y]);
      }
    if (pixels.length < 100) throw Error(`Review boot mask manually: ${job.id}/${p}`);
    const bottom = Math.max(...pixels.map((p) => p[1]));
    const low = pixels.filter((p) => p[1] >= bottom - 55);
    const xs = low.map((p) => p[0]).sort((a, b) => a - b);
    const x = Math.round((xs[Math.floor(xs.length * 0.05)] + xs[Math.floor(xs.length * 0.95)]) / 2);
    const sourceCellX = (f.sourceCell.index % 2) * (info.width / 2);
    const sourceCellY = Math.floor(f.sourceCell.index / 2) * (info.height / 3);
    proposed[job.id][p] = [x - sourceCellX, bottom - sourceCellY];
    const left = (p % 4) * 400,
      top = Math.floor(p / 4) * 245;
    const crop = await sharp(`${root}/${f.source}`)
      .extract({ left: b.left, top: b.top, width: b.right - b.left, height: b.bottom - b.top })
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
      maskPixels: pixels.length,
    });
  }
  layers.push({
    input: Buffer.from(
      `<svg width="1600" height="735" xmlns="http://www.w3.org/2000/svg">${labels.join('')}</svg>`,
    ),
    left: 0,
    top: 0,
  });
  await sharp({ create: { width: 1600, height: 735, channels: 4, background: '#eee5d1' } })
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
