import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH);
const anchors = JSON.parse(await readFile('src/platform/hero-slash-anchors.json', 'utf8'));
const root = 'docs/verification/hero-slash-v1';
await mkdir(root, { recursive: true });
for (let i = 0; i < 10; i++) {
  const { data, info } = await sharp(`public/art/hero-slash-v1/hero-${i}.webp`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const figures = motionLayout(data, info.width, info.height, 3, 5).map(figureExtractor(data, info.width, info.height));
  const layers = [], labels = [];
  for (let j = 0; j < 15; j++) {
    const f = figures[j], width = f.right - f.left, height = f.bottom - f.top;
    const scale = Math.min(210 / width, 260 / height), left = j % 5 * 240 + Math.round((240 - width * scale) / 2), top = Math.floor(j / 5) * 300 + 30;
    layers.push({ input: await sharp(data, { raw: info }).extract({ left: f.left, top: f.top, width, height })
      .resize(Math.round(width * scale), Math.round(height * scale)).png().toBuffer(), left, top });
    const [u,v] = anchors[i].hands[j], x = left + u * width * scale, y = top + v * height * scale;
    labels.push(`<text x="${j%5*240+6}" y="${Math.floor(j/5)*300+20}" fill="#20372c" font-size="16">${i} ${['ready','contact','follow'][Math.floor(j/5)]} ${['S','SE','E','NE','N'][j%5]}</text><path d="M${x-7},${y}h14M${x},${y-7}v14" stroke="#00a1da" stroke-width="2"/>`);
  }
  layers.push({ input: Buffer.from(`<svg width="1200" height="900">${labels.join('')}</svg>`), left: 0, top: 0 });
  await sharp({ create: { width: 1200, height: 900, channels: 4, background: '#eee6d7' } })
    .composite(layers).png().toFile(`${root}/source-${i}.png`);
}
