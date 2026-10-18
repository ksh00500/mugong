import { readFile, writeFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const family = process.argv[2];
if (!['shaolin', 'zhuge', 'tianjian', 'dokmu', 'hyeolma', 'desert', 'qingha', 'snow', 'bamboo', 'tomb'].includes(family))
  throw Error('Unknown family');
const root = `docs/source/${family}-family-v1`,
  jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const sources = new Map(),
  records = [],
  missing = [];
for (const j of jobs) {
  const used = new Set();
  const poseKeys = [];
  for (let pose = 0; pose < 12; pose++) {
    const file = j.poseSources?.[pose] ?? j.source;
    if (!sources.has(file)) {
      try {
        await access(`${root}/${file}`);
      } catch (e) {
        if (e.code === 'ENOENT') {
          missing.push(`${j.id}/${pose}`);
          continue;
        }
        throw e;
      }
      const { data, info } = await sharp(`${root}/${file}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      sources.set(file, { info, extract: figureExtractor(data, info.width, info.height) });
    }
    const { info, extract } = sources.get(file),
      g = j.poseSourceCells?.[pose] ?? { columns: 4, rows: 3, index: pose };
    const cell = nativeSourceCell(g, info.width, info.height),
      { left, top } = cell;
    const f = extract(cell);
    const key = file + '/' + f.id;
    const alias = j.poseReuse?.[pose];
    const reused = Number.isInteger(alias) && alias < pose && poseKeys[alias] === key;
    if (alias !== undefined && !reused) throw Error(`${j.id}/${pose}: invalid explicit pose reuse`);
    const shared = used.has(key) && !reused;
    poseKeys[pose] = key;
    used.add(key);
    records.push({
      id: j.id,
      pose,
      source: file,
      component: f.id,
      shared,
      reused: reused ? alias : null,
      clipped: f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height,
      bounds: [f.left - left, f.top - top, f.right - left, f.bottom - top],
      area: f.area,
    });
  }
}
await writeFile(`${root}/source-scan.json`, JSON.stringify({ records, missing }, null, 2) + '\n');
console.log(
  JSON.stringify({
    frames: records.length,
    missing: missing.length,
    issues: records.filter((r) => r.component < 0 || r.shared || r.clipped),
  }),
);
