import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { motionLayout, figureExtractor } from '../src/game/motion-layout.ts';
import { hands, northHands, rearHands, skullFractions, flipped } from '../docs/source/hero-slash-v1/anchors.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH);
const root = 'docs/source/hero-slash-v1';
const delivery = 'public/art/hero-slash-v1';
await mkdir(delivery, { recursive: true });
const report = [];
const anchors = [], landmarks = {};
for (let i = 0; i < 10; i++) {
  const file = `${root}/hero-${i}.png`;
  const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true }).catch(() => undefined);
  if (!raw) continue;
  const { data, info } = raw;
  const figures = motionLayout(data, info.width, info.height, 3, 5)
    .map(figureExtractor(data, info.width, info.height));
  if (new Set(figures.map(f => f.id)).size !== 15) throw new Error(`Merged figures: ${i}`);
  const parts = figures.map((f,j) => ({ f, data, info, source: `hero-${i}.png`, hand: hands[i][j] }));
  for (const [name, cols, first, points] of [
    ['north', 1, 4, northHands[i]], ['rear', 2, 3, rearHands[i]],
  ]) {
    const repair = await sharp(`${root}/${name}-${i}.png`).ensureAlpha().raw()
      .toBuffer({ resolveWithObject: true }).catch(() => undefined);
    if (!repair) continue;
    if (!points) throw new Error(`Unreviewed repair hands: ${name}/${i}`);
    const fs = motionLayout(repair.data, repair.info.width, repair.info.height, 3, cols)
      .map(figureExtractor(repair.data, repair.info.width, repair.info.height));
    fs.forEach((f,j) => {
      parts[Math.floor(j / cols) * 5 + first + j % cols] =
        { f, ...repair, source: `${name}-${i}.png`, hand: points[j] };
    });
  }
  const tw = Math.max(...parts.map(({f}) => f.right - f.left)) + 32;
  const th = Math.max(...parts.map(({f}) => f.bottom - f.top)) + 32;
  const pixels = Buffer.alloc(tw * 5 * th * 3 * 4);
  const meta = { hands: [], flips: [] }, units = {};
  parts.forEach(({ f, data, info, source, hand }, j) => {
    const uv = [(hand[0] - f.left) / (f.right - f.left), (hand[1] - f.top) / (f.bottom - f.top)];
    if (uv.some(n => !(n > 0 && n < 1))) throw new Error(`Hand outside figure: ${i}/${j}`);
    meta.hands.push(uv);
    meta.flips.push(flipped(i, Math.floor(j / 5), j % 5));
    units[`${Math.floor(j / 5)}-${j % 5}`] = (f.bottom - f.top) * skullFractions[i];
    for (const at of f.members) {
      const x = at % info.width, y = Math.floor(at / info.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const sx = x + dx, sy = y + dy;
        if (sx < f.left || sx >= f.right || sy < f.top || sy >= f.bottom) continue;
        const to = ((Math.floor(j / 5) * th + 16 + sy - f.top) * tw * 5 + j % 5 * tw + 16 + sx - f.left) * 4;
        data.copy(pixels, to, (sy * info.width + sx) * 4, (sy * info.width + sx) * 4 + 4);
      }
    }
    report.push({ appearance: i, row: Math.floor(j / 5), col: j % 5, source, hand, bounds: [f.left, f.top, f.right, f.bottom],
      sourceEdge: f.left <= 0 || f.top <= 0 || f.right >= info.width || f.bottom >= info.height });
  });
  await sharp(pixels, { raw: { width: tw * 5, height: th * 3, channels: 4 } })
    .webp({ lossless: true }).toFile(`${delivery}/hero-${i}.webp`);
  anchors[i] = meta;
  landmarks[`/art/hero-slash-v1/hero-${i}.webp`] = { width: tw * 5, height: th * 3, units };
}
await writeFile(`${root}/export.json`, JSON.stringify(report, null, 2) + '\n');
await writeFile('src/platform/hero-slash-anchors.json', JSON.stringify(anchors, null, 2) + '\n');
await writeFile('src/platform/hero-slash-landmarks.json', JSON.stringify(landmarks, null, 2) + '\n');
console.log(JSON.stringify(report));
