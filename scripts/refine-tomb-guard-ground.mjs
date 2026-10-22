import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const anchors = JSON.parse(await readFile(`${root}/ground-anchors.json`, 'utf8'));
const sourceCache = new Map(),
  overrides = [];
for (const j of jobs.filter((j) => j.character === 'tombguard'))
  for (let pose = 0; pose < 12; pose++) {
    if (pose === 5) continue;
    const file = j.poseSources?.[pose] ?? j.source;
    if (!sourceCache.has(file)) {
      const { data, info } = await sharp(`${root}/${file}`)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      sourceCache.set(file, {
        data,
        info,
        extract: figureExtractor(data, info.width, info.height),
      });
    }
    const { data, info, extract } = sourceCache.get(file);
    const cell = nativeSourceCell(j.poseSourceCells[pose], info.width, info.height),
      f = extract(cell);
    const members = new Set(f.members),
      ay = anchors[j.id][pose][1] + cell.top,
      points = [];
    // Offline coordinates only: both brown/neutral boot soles, excluding red tassels.
    for (let y = Math.max(f.top, ay - 40); y < ay; y++) {
      let start = null;
      for (let x = f.left; x <= f.right; x++) {
        const p = y * info.width + x,
          i = p * 4,
          r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const boot =
          x < f.right &&
          members.has(p) &&
          r < 145 &&
          g < 130 &&
          b < 135 &&
          r >= g &&
          r >= b &&
          g > r * 0.68;
        if (boot && start === null) start = x;
        if (!boot && start !== null) {
          if (x - start >= 12) points.push(start, x);
          start = null;
        }
      }
    }
    if (!points.length) throw Error(`${j.id}/${pose}: inspect sole band`);
    const ax = Math.round((Math.min(...points) + Math.max(...points)) / 2 - cell.left);
    overrides.push({
      id: j.id,
      pose,
      point: [ax, anchors[j.id][pose][1]],
      reason:
        'Offline neutral/brown sole-band X midpoint of both boots, excluding red spear tassel; source sole Y retained. Fixed-scale contact sheet reviewed after export.',
    });
  }
await writeFile(`${root}/ground-anchor-overrides.json`, JSON.stringify(overrides, null, 2) + '\n');
console.log(`${overrides.length} explicit guard sole coordinates.`);
