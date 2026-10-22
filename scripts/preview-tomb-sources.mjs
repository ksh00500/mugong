// Diagnostic preview only. Native PNGs and gameplay atlases are not modified.
import { readFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { figureExtractor, copyFigurePixels } from '../src/game/motion-layout.ts';
import { nativeSourceCell } from './native-source-cell.mjs';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const root = 'docs/source/tomb-family-v1';
const jobs = JSON.parse(await readFile(`${root}/generation-jobs.json`, 'utf8'));
const sources = new Map();
const out = 'docs/verification/tomb-family-v1/source-preview';
await mkdir(out, { recursive: true });
for (const character of [...new Set(jobs.map((j) => j.character))]) {
  const overlays = [],
    labels = [];
  for (const j of jobs.filter((j) => j.character === character))
    for (let pose = 0; pose < 12; pose++) {
      const file = j.poseSources?.[pose] ?? j.source;
      try {
        await access(`${root}/${file}`);
      } catch (e) {
        if (e.code === 'ENOENT') continue;
        throw e;
      }
      if (!sources.has(file)) {
        const { data, info } = await sharp(`${root}/${file}`)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        sources.set(file, { data, info, extract: figureExtractor(data, info.width, info.height) });
      }
      const { data, info, extract } = sources.get(file);
      const layout = j.poseSourceCells[pose];
      const f = extract(nativeSourceCell(layout, info.width, info.height));
      if (f.id < 0) continue;
      const w = f.right - f.left,
        h = f.bottom - f.top;
      const rgba = new Uint8ClampedArray(w * h * 4);
      copyFigurePixels(data, rgba, info.width, w, f, 0, 0, f.members);
      const scale = 0.225;
      const b = await sharp(Buffer.from(rgba.buffer), { raw: { width: w, height: h, channels: 4 } })
        .resize(Math.round(w * scale), Math.round(h * scale))
        .png()
        .toBuffer();
      const x = pose * 160,
        y = j.view * 150;
      overlays.push({
        input: b,
        left: Math.round(x + 80 - (w * scale) / 2),
        top: Math.round(y + 130 - h * scale),
      });
      labels.push(`<text x="${x + 4}" y="${y + 14}">v${j.view} p${pose}</text>`);
    }
  overlays.push({
    input: Buffer.from(
      `<svg width="1920" height="750"><g font-size="11" font-family="sans-serif" fill="#20382d">${labels.join('')}</g></svg>`,
    ),
    left: 0,
    top: 0,
  });
  await sharp({ create: { width: 1920, height: 750, channels: 4, background: '#eee6d5' } })
    .composite(overlays)
    .png()
    .toFile(`${out}/${character}.png`);
}
console.log(out);
