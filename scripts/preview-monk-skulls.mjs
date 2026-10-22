import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const measurements = JSON.parse(
  await readFile('docs/verification/monk-scale-v2/source-measurements.json', 'utf8'),
);
for (const family of ['region', 'identity']) {
  const rows = family === 'region' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2];
  const layers = [];
  for (const [r, row] of rows.entries()) {
    const entries = measurements.filter(
      (m) =>
        m.path.includes(family === 'region' ? 'region-4' : 'identity') &&
        m.frame.startsWith(`${row}-`),
    );
    for (const [c, m] of entries.entries()) {
      const b = m.bounds,
        w = b.right - b.left,
        h = b.bottom - b.top;
      const scale = 140 / m.skull.span;
      const factor = Math.min(scale, 190 / w, 190 / h);
      const image = await sharp('public' + m.path)
        .extract({ left: b.left, top: b.top, width: w, height: h })
        .resize(Math.round(w * factor), Math.round(h * factor))
        .png()
        .toBuffer();
      const x = c * 220,
        y = r * 240;
      layers.push({ input: image, left: x + Math.round((220 - w * factor) / 2), top: y + 10 });
      const svg = `<svg width="220" height="240"><rect x="${(220 - w * factor) / 2 + m.skull.left * factor}" y="${10 + m.skull.top * factor}" width="${(m.skull.right - m.skull.left + 1) * factor}" height="${h * 0.12 * factor}" fill="none" stroke="red"/><text x="8" y="223" font-size="16" fill="white">${m.frame} ${m.path.includes('directions') ? 'dir' : m.path.includes('rear') ? 'rear' : 'act'} skull:${m.skull.span}</text></svg>`;
      layers.push({ input: Buffer.from(svg), left: x, top: y });
    }
  }
  await sharp({
    create: { width: 3300, height: rows.length * 240, channels: 4, background: '#637267' },
  })
    .composite(layers)
    .png()
    .toFile(`docs/verification/monk-scale-v2/${family}-source-review.png`);
}
