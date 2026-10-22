import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const familyName = process.argv[2] ?? 'shaolin';
if (!['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(familyName))
  throw Error('Unknown native enemy family');
const root = `docs/source/${familyName}-family-v1`;
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const reports = [];
const sources = new Map();
async function readSource(source) {
  if (sources.has(source)) return sources.get(source);
  const png = await readFile(`${root}/${source}`);
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const extract = figureExtractor(data, info.width, info.height);
  let clear = 0;
  for (let i = 3; i < data.length; i += 4) if (!data[i]) clear++;
  const result = { info, extract, clearFraction: clear / (info.width * info.height) };
  sources.set(source, result);
  return result;
}
for (const job of jobs) {
  const main = await readSource(job.source);
  const poses = [];
  for (let pose = 0; pose < 12; pose++) {
    const source = job.poseSources?.[pose] ?? job.source;
    const { info, extract } = await readSource(source);
    const layout = job.poseSourceCells?.[pose] ?? { columns: 4, rows: 3, index: pose };
    const cell = nativeSourceCell(layout, info.width, info.height),
      { left: x, top: y } = cell;
    const f = extract(cell);
    poses.push({
      pose,
      reused: job.poseReuse?.[pose] ?? null,
      source,
      sourceCell: layout,
      id: f.id,
      bounds: [f.left - x, f.top - y, f.right - x, f.bottom - y],
      area: f.area,
      clipped: f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height,
    });
  }
  reports.push({
    id: job.id,
    width: main.info.width,
    height: main.info.height,
    clearFraction: main.clearFraction,
    poses,
  });
}
await writeFile(`${root}/source-review.json`, JSON.stringify(reports, null, 2) + '\n');
console.log(
  JSON.stringify(
    reports.map((r) => ({
      id: r.id,
      clearFraction: r.clearFraction,
      clipped: r.poses.filter((p) => p.clipped).map((p) => p.pose),
      shared: r.poses
        .filter(
          (p, i) =>
            p.reused === null &&
            r.poses.slice(0, i).some((q) => p.source === q.source && p.id === q.id),
        )
        .map((p) => p.pose),
    })),
  ),
);
