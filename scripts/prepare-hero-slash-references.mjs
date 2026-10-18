import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH);
const root = 'docs/source/hero-slash-v1';
await mkdir(root, { recursive: true });
for (let i = 0; i < 10; i++) {
  const file = `docs/source/hero-roster-v1/directions-${Math.floor(i / 5)}.png`;
  const meta = await sharp(file).metadata();
  const top = Math.round((i % 5) * meta.height / 5);
  const bottom = Math.round(((i % 5) + 1) * meta.height / 5);
  await sharp(file).extract({ left: 0, top, width: meta.width, height: bottom - top })
    .png().toFile(`${root}/reference-${i}.png`);
}
