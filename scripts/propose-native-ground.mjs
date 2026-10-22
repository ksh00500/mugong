// Offline source-pixel coordinates; does not rescale artwork.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const family = process.argv[2];
if (!['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(family))
  throw Error('Unknown family');
const root = `docs/source/${family}-family-v1`;
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
let overrides = [];
try {
  overrides = JSON.parse(await readFile(`${root}/ground-anchor-overrides.json`, 'utf8'));
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const sources = new Map(),
  anchors = {},
  review = [];
for (const j of jobs) {
  anchors[j.id] = [];
  for (let pose = 0; pose < 12; pose++) {
    const file = j.poseSources?.[pose] ?? j.source;
    if (!sources.has(file)) {
      const { data, info } = await sharp(`${root}/${file}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      sources.set(file, { data, info, extract: figureExtractor(data, info.width, info.height) });
    }
    const { data, info, extract } = sources.get(file),
      grid = j.poseSourceCells?.[pose] ?? { columns: 4, rows: 3, index: pose };
    const cell = nativeSourceCell(grid, info.width, info.height),
      { left: sx, top: sy } = cell;
    const f = extract(cell);
    if (f.id < 0 || f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height)
      throw Error(`${j.id}/${pose}: repair source first`);
    const override = overrides.find((o) => o.id === j.id && o.pose === pose);
    let ax = (f.left + f.right) / 2,
      ay = f.bottom - 2;
    if (pose !== 5 && !override) {
      const members = new Set(f.members),
        rows = [];
      for (let y = f.bottom - 1; y >= f.top + (f.bottom - f.top) * 0.55; y--) {
        const runs = [];
        let start = null;
        const left = Math.ceil(f.left + (f.right - f.left) * 0.08),
          right = Math.floor(f.right - (f.right - f.left) * 0.08);
        for (let x = left; x <= right; x++) {
          const p = y * info.width + x,
            i = p * 4;
          const dark =
            x < right &&
            members.has(p) &&
            data[i] < 140 &&
            data[i + 1] < 120 &&
            data[i + 2] < 130 &&
            data[i] >= data[i + 1] + 2 &&
            data[i] >= data[i + 2] + 2;
          if (dark && start === null) start = x;
          if (!dark && start !== null) {
            if (x - start >= 12) runs.push([start, x]);
            start = null;
          }
        }
        if (runs.length) rows.push({ y, runs });
        if (rows.length && rows[0].y - y > 45) break;
      }
      if (!rows.length) throw Error(`${j.id}/${pose}: boot point needs manual review`);
      ay = rows[0].y + 1;
      const xs = rows.flatMap((r) => r.runs.flatMap(([a, b]) => [a, b])).sort((a, b) => a - b);
      ax = (xs[Math.floor(xs.length * 0.1)] + xs[Math.floor(xs.length * 0.9)]) / 2;
    }
    anchors[j.id][pose] = override?.point ?? [Math.round(ax - sx), Math.round(ay - sy)];
    review.push({
      id: j.id,
      pose,
      source: file,
      point: anchors[j.id][pose],
      fromFigureBottom: f.bottom - (anchors[j.id][pose][1] + sy),
      manualReview: override?.reason ?? null,
    });
  }
}
await writeFile(`${root}/ground-anchors.json`, JSON.stringify(anchors, null, 2) + '\n');
await writeFile(`${root}/ground-proposals.json`, JSON.stringify(review, null, 2) + '\n');
console.log(JSON.stringify(review.filter((r) => r.fromFigureBottom > 12)));
