// Native 1:1 frame selection for generation references, no drawing or resizing.
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const records = [];
for (const id of [
  'tombtrapper-right',
  'tombtrapper-rear-right',
  'tombguard-front',
  'tombguard-front-right',
  'tombguard-right',
  'tombguard-back',
  'tombcrossbow-back',
  'jeokho-back',
  'seokmun-back',
  'gwakgi-rear-right',
  'gwakgi-back',
  'wolryeong-rear-right',
  'wolryeong-back',
]) {
  const j = jobs.find((j) => j.id === id),
    pose = id === 'tombtrapper-right' ? 8 : 0;
  const source =
    id === 'wolryeong-rear-right'
      ? 'wolryeong-rear-right-repair-v2.png'
      : (j.poseSources?.[pose] ?? j.source);
  const layout = j.poseSourceCells[pose];
  const { data, info } = await sharp(`${root}/${source}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const f = figureExtractor(
    data,
    info.width,
    info.height,
  )(nativeSourceCell(layout, info.width, info.height));
  if (f.id < 0) throw Error(id);
  const width = f.right - f.left + 64,
    height = f.bottom - f.top + 64,
    rgba = new Uint8ClampedArray(width * height * 4);
  copyFigurePixels(data, rgba, info.width, width, f, 32, 32, f.members);
  const reference = `reference-${id}.png`;
  await sharp(Buffer.from(rgba.buffer), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(`${root}/${reference}`);
  records.push({
    reference,
    source,
    pose,
    layout,
    bounds: [f.left, f.top, f.right, f.bottom],
    scale: 1,
    padding: 32,
  });
}
await writeFile(`${root}/repair-reference-packing.json`, JSON.stringify(records, null, 2) + '\n');
console.log(JSON.stringify(records.map((r) => r.reference)));
