import { createRequire } from 'node:module';
import { readFile, copyFile, mkdir } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/character-info-v1';
await mkdir('public/art/character-info-v1', { recursive: true });
const jobs = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
const layers = [];
for (let at = 0; at < jobs.length; at++) {
  const job = jobs[at],
    original = `${root}/${job.id}.png`;
  if (job.source !== original) await copyFile(job.source, original);
  await sharp(original)
    .trim()
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`public/art/character-info-v1/${job.id}.webp`);
  layers.push({ input: `public/art/character-info-v1/${job.id}.webp`, left: at * 144 + 8, top: 8 });
}
await sharp({
  create: {
    width: 144 * jobs.length,
    height: 144,
    channels: 4,
    background: { r: 247, g: 240, b: 223, alpha: 1 },
  },
})
  .composite(layers)
  .png()
  .toFile(`${root}/review.png`);
console.log(`${jobs.length} icons exported`);
