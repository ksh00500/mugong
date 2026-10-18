import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

// Delivery format conversion only; generated originals remain untouched.
const require = createRequire(import.meta.url);
const sharp = require(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const path = 'docs/source/enemy-motion-manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
let bytes = 0;
for (const asset of manifest.flatMap((region) => [region, ...(region.patches ?? [])])) {
  const delivery = asset.dest.replace(/\.png$/, '.webp');
  const info = await sharp(asset.dest)
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toFile(delivery);
  Object.assign(asset, { delivery, width: info.width, height: info.height, bytes: info.size });
  bytes += info.size;
}
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ regions: manifest.length, atlases: manifest.flatMap((region) => [region, ...(region.patches ?? [])]).length, bytes }));
