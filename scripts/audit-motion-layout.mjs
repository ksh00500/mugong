import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { figureBounds, motionLayout } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const manifest = JSON.parse(await readFile('docs/source/enemy-motion-manifest.json', 'utf8'));
for (const region of manifest)
  for (const asset of [region, ...(region.patches ?? [])]) {
    const { data, info } = await sharp(asset.dest)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rows = asset.slots?.length ?? 7;
    const layout = motionLayout(data, info.width, info.height, rows);
    const figures = layout.map((cell) => figureBounds(data, info.width, cell));
    const sizes = figures.map((c) => c.area);
    console.log(
      JSON.stringify({
        path: asset.dest,
        figures: sizes.length,
        smallest: Math.min(...sizes),
        largest: Math.max(...sizes),
      }),
    );
  }
