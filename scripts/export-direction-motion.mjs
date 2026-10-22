import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const path = 'docs/source/direction-motion-manifest.json';
const manifest = JSON.parse(await readFile(path, 'utf8'));
let bytes = 0;
for (const asset of manifest) {
  const delivery = asset.dest.replace(/\.png$/, '.webp');
  // Delivery format only. Generated source files stay intact.
  const info = await sharp(asset.dest).webp({ quality: 90, alphaQuality: 100, effort: 4 }).toFile(delivery);
  Object.assign(asset, { delivery, width: info.width, height: info.height, bytes: info.size });
  bytes += info.size;
}
await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ atlases: manifest.length, drawnViews: manifest.length * 35, bytes }));
