import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { figureBounds, motionLayout } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const manifest = JSON.parse(await readFile('docs/source/direction-motion-manifest.json', 'utf8'));
for (const asset of manifest) {
  const { data, info } = await sharp(asset.delivery).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const layout = motionLayout(data, info.width, info.height, asset.rows, asset.columns);
  const figures = layout.map(cell => figureBounds(data, info.width, cell));
  // An omitted row can still produce 35 nonempty shards when sliced as seven rows.
  // Reject implausibly short fragments; existence/alpha counts alone aren't proof.
  const fragments = figures.flatMap((f, i) => f.bottom - f.top < info.height / asset.rows * 0.68 ? [i] : []);
  console.log(JSON.stringify({ index: asset.index, count: figures.length, minArea: Math.min(...figures.map(f => f.area)), fragments, heights: Array.from({ length: 7 }, (_, row) => figures.slice(row * 5, row * 5 + 5).map(f => f.bottom - f.top)) }));
  if (figures.length !== 35) throw new Error(`Invalid direction atlas: ${asset.index}`);
  if (fragments.length) throw new Error(`Truncated actor fragments in atlas ${asset.index}: ${fragments}`);
}
