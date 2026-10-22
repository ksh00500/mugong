import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const family = process.argv[2] ?? 'tianjian';
if (!['tianjian', 'dokmu', 'qingha', 'snow'].includes(family))
  throw Error('Unknown special family');
const root = `docs/source/${family}-special-v1`;
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const report = [];
for (const job of jobs)
  for (let m = 0; m < 2; m++) {
    const source = job.sources[m].source;
    let decoded;
    try {
      decoded = await sharp(await readFile(`${root}/${source}`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    } catch {
      continue;
    }
    const { data, info } = decoded;
    const candidates = [];
    for (const [columns, rows] of [
      [2, 3],
      [3, 2],
    ]) {
      const extract = figureExtractor(data, info.width, info.height);
      const figures = Array.from({ length: 6 }, (_, index) => {
        const cell = nativeSourceCell({ columns, rows, index }, info.width, info.height);
        try {
          const f = extract(cell);
          return {
            id: f.id,
            bounds: [f.left, f.top, f.right, f.bottom],
            area: f.area,
            width: f.right - f.left,
            height: f.bottom - f.top,
            edge: Math.min(f.left, f.top, info.width - f.right, info.height - f.bottom),
          };
        } catch {
          return { id: -1, edge: 0, width: 0, height: 0, area: 0 };
        }
      });
      const valid =
        figures.every(
          (f) =>
            f.id > 0 &&
            f.edge > 0 &&
            f.area > 10000 &&
            f.width > 100 &&
            f.height > 160 &&
            f.height < 650,
        ) && new Set(figures.map((f) => f.id)).size === 6;
      candidates.push({ columns, rows, valid, figures });
    }
    const selected = candidates.find((c) => c.valid && (family !== 'dokmu' || c.columns === 2));
    if (selected)
      for (let p = 0; p < 6; p++)
        job.poseSourceCells[m * 6 + p] = {
          columns: selected.columns,
          rows: selected.rows,
          index: Number.isInteger(job.poseReuse?.[m * 6 + p]) ? job.poseReuse[m * 6 + p] % 6 : p,
        };
    report.push({
      id: job.id,
      source,
      width: info.width,
      height: info.height,
      selected: selected ?? null,
      candidates: selected ? undefined : candidates,
    });
  }
await writeFile(`${root}/generation-jobs.json`, JSON.stringify(jobs, null, 2) + '\n');
await writeFile(`${root}/source-review.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      ready: report.length,
      expected: jobs.reduce((sum, job) => sum + job.sources.length, 0),
      failed: report.filter((r) => !r.selected).map((r) => r.source),
      sources: report.map((r) => ({
        source: r.source,
        grid: r.selected && [r.selected.columns, r.selected.rows],
        heights: r.selected?.figures.map((f) => f.height),
        edge: r.selected && Math.min(...r.selected.figures.map((f) => f.edge)),
      })),
    },
    null,
    2,
  ),
);
