import { readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/dokmu-family-v1';
const choices = JSON.parse(await readFile(root + '/selected-corrections.json', 'utf8'));
for (const c of choices) {
  try {
    await access(root + '/' + c.source);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(c.source + ': pending');
      continue;
    }
    throw e;
  }
  const { data, info } = await sharp(root + '/' + c.source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const extract = figureExtractor(data, info.width, info.height);
  console.log(
    JSON.stringify({
      id: c.id,
      file: c.source,
      poses: c.poses.map((p) => {
        const x = Math.floor(((p % 3) * info.width) / 3),
          y = Math.floor((Math.floor(p / 3) * info.height) / 4),
          f = extract({
            left: x,
            top: y,
            right: Math.floor((((p % 3) + 1) * info.width) / 3),
            bottom: Math.floor(((Math.floor(p / 3) + 1) * info.height) / 4),
          });
        return {
          pose: p,
          component: f.id,
          clipped: f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height,
          bounds: [f.left - x, f.top - y, f.right - x, f.bottom - y],
          area: f.area,
        };
      }),
    }),
  );
}
