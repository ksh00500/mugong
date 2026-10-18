import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const report = [];
for (const kind of ['darts', 'gauntlets']) {
  const source = `docs/source/held-weapons-v1/${kind}.png`,
    destination = `public/art/held-${kind}-v1.webp`;
  const before = await sharp(source).metadata();
  if (!before.hasAlpha) throw new Error(`Missing alpha: ${source}`);
  await sharp(source).webp({ quality: 94, alphaQuality: 100 }).toFile(destination);
  const after = await sharp(destination).metadata();
  report.push({
    source,
    destination,
    width: after.width,
    height: after.height,
    hasAlpha: after.hasAlpha,
  });
}
await writeFile('docs/source/held-weapons-v1/export.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
