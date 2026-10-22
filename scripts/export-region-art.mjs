import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

// Format conversion only: preserve dimensions, colour composition and transparent alpha.
// Supply MUGONG_SHARP_PATH for the bundled runtime; no new app dependency is required.
const require = createRequire(import.meta.url);
const sharp = require(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const manifestPath = 'docs/source/region-art-manifest.json';
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let originalBytes = 0,
  deliveryBytes = 0;
for (const region of manifest)
  for (const type of ['region', 'background']) {
    const asset = region[type];
    const input = asset.dest;
    const output = input.replace(/\.png$/, '.webp');
    const original = await readFile(input);
    const info = await sharp(original)
      .webp({ quality: type === 'region' ? 90 : 86, alphaQuality: 100, effort: 6 })
      .toFile(output);
    originalBytes += original.length;
    deliveryBytes += info.size;
    Object.assign(asset, {
      delivery: output.replaceAll('\\', '/'),
      width: info.width,
      height: info.height,
      bytes: info.size,
    });
  }
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify({
    originalBytes,
    deliveryBytes,
    reduction: Math.round((1 - deliveryBytes / originalBytes) * 100) + '%',
  }),
);
